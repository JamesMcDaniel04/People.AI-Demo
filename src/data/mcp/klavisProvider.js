import { randomBytes } from 'crypto';
import { KlavisClient, KlavisError, KlavisTimeoutError } from 'klavis';
import { TokenStore } from '../../utils/tokenStore.js';
import { RateLimiter } from '../../utils/rateLimiter.js';

const SERVER_CANONICAL_NAMES = {
  gmail: 'Gmail',
  google_calendar: 'Google Calendar',
  google_drive: 'Google Drive',
  slack: 'Slack',
  notion: 'Notion'
};

const CONFIG_KEY_MAP = {
  gmail: 'gmail',
  google_calendar: 'googleCalendar',
  google_drive: 'googleDrive',
  slack: 'slack',
  notion: 'notion'
};

const TOOL_FORMATS = ['openai', 'claude'];
const SERVER_KEYS = Object.keys(SERVER_CANONICAL_NAMES);
const DEFAULT_USER_ID = 'account-planner-system';

const DEFAULT_RATE_LIMITS = {
  perMinute: 60,
  perHour: 1000,
  perDay: 20000,
  maxConcurrent: 1
};

const DEFAULT_TOKEN_REFRESH_BUFFER_SECONDS = 120;

function normalizeServerKey(server) {
  if (!server) return null;
  const normalized = String(server).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (normalized === 'googlecalendar' || normalized === 'calendar') return 'google_calendar';
  if (normalized === 'googledrive' || normalized === 'drive') return 'google_drive';
  return normalized;
}

function parseScopes(scopes) {
  if (!scopes) return [];
  if (Array.isArray(scopes)) return scopes.filter(Boolean);
  if (typeof scopes === 'string') {
    return scopes.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function parseExpiresAt(authData, fallback) {
  if (!authData || typeof authData !== 'object') {
    return fallback || null;
  }
  const lowered = {};
  for (const [key, value] of Object.entries(authData)) {
    lowered[key.toLowerCase()] = value;
  }
  const direct = lowered.expires_at || lowered.expiry || lowered.expiration;
  if (direct) {
    const dt = new Date(direct);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toISOString();
    }
  }
  const expiresIn = lowered.expires_in || lowered.expiresin;
  if (expiresIn && Number.isFinite(Number(expiresIn))) {
    const expires = new Date(Date.now() + Number(expiresIn) * 1000);
    return expires.toISOString();
  }
  return fallback || null;
}

function sanitizeLimit(value, fallback) {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }
  return num;
}

function sanitizeWindowMs(windowMs = {}) {
  const sanitize = (val, fallback) => {
    if (val === null || val === undefined) return fallback;
    const num = Number(val);
    if (!Number.isFinite(num) || num <= 0) return fallback;
    return num;
  };
  return {
    minute: sanitize(windowMs.minute, 60 * 1000),
    hour: sanitize(windowMs.hour, 60 * 60 * 1000),
    day: sanitize(windowMs.day, 24 * 60 * 60 * 1000)
  };
}

function buildState() {
  return randomBytes(24).toString('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function buildRateLimiterOptions(config, alias) {
  const rateConfig = config?.mcp?.rateLimits || {};
  const defaults = rateConfig.default || rateConfig;
  const serverOverrides = rateConfig.servers?.[alias] || rateConfig.servers?.[CONFIG_KEY_MAP[alias]] || {};
  const perMinute = sanitizeLimit(serverOverrides.perMinute ?? defaults?.perMinute, DEFAULT_RATE_LIMITS.perMinute);
  const perHour = sanitizeLimit(serverOverrides.perHour ?? defaults?.perHour, DEFAULT_RATE_LIMITS.perHour);
  const perDay = sanitizeLimit(serverOverrides.perDay ?? defaults?.perDay, DEFAULT_RATE_LIMITS.perDay);
  const maxConcurrent = sanitizeLimit(serverOverrides.maxConcurrent ?? defaults?.maxConcurrent, DEFAULT_RATE_LIMITS.maxConcurrent);
  const windowMs = sanitizeWindowMs(serverOverrides.windowMs || defaults?.windowMs || {});
  return { perMinute, perHour, perDay, maxConcurrent, windowMs };
}

function extractAuthPayloadFromParams(params = {}) {
  const payload = {};
  const directToken = params.token || params.oauth_token;
  if (directToken) {
    payload.token = directToken;
  }
  const authKeys = ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'scope', 'id_token'];
  const data = {};
  for (const key of authKeys) {
    if (params[key] !== undefined) {
      data[key] = params[key];
    }
  }
  if (Object.keys(data).length > 0) {
    payload.data = data;
  }
  return Object.keys(payload).length ? payload : null;
}

export class KlavisProvider {
  constructor(config) {
    this.config = config;
    this.apiKey = config.mcp?.klavisApiKey || process.env.KLAVIS_API_KEY;
    this.klavis = new KlavisClient({ apiKey: this.apiKey });
    this.tokenStore = new TokenStore({ filename: 'klavis.json' });
    this.mcpServers = new Map();
    this.availableToolsByFormat = new Map();
    TOOL_FORMATS.forEach((format) => this.availableToolsByFormat.set(format, new Map()));
    this.serverConnections = new Map();
    this.rateLimiters = new Map();
    this.defaultRateLimiter = new RateLimiter();
    this.initialized = false;
    this.mockMode = false;
    const userId = this.config.mcp?.userId || process.env.MCP_USER_ID;
    this.defaultUserId = userId && String(userId).trim() ? userId.trim() : DEFAULT_USER_ID;
    const bufferSeconds = Number(this.config.mcp?.tokenRefresh?.bufferSeconds ?? process.env.MCP_TOKEN_REFRESH_BUFFER ?? DEFAULT_TOKEN_REFRESH_BUFFER_SECONDS);
    this.tokenRefreshBufferMs = Number.isFinite(bufferSeconds) && bufferSeconds >= 0 ? bufferSeconds * 1000 : DEFAULT_TOKEN_REFRESH_BUFFER_SECONDS * 1000;
  }

  async initialize() {
    console.log('🔄 Initializing Klavis MCP Provider...');

    try {
      this.setupRateLimiters();
      await this.testConnection();
      await this.loadSavedServerConnections();
      await this.discoverServersAndTools();
      this.initialized = true;
      console.log('✅ Klavis MCP Provider initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Klavis MCP Provider:', error.message);
      this.mockMode = true;
      this.initialized = true;
      console.log('⚠️ Klavis API unavailable, using mock mode for demonstration');
    }
  }

  setupRateLimiters() {
    this.rateLimiters.clear();
    for (const alias of SERVER_KEYS) {
      if (!this.isServerEnabled(alias)) continue;
      const options = buildRateLimiterOptions(this.config, alias);
      this.rateLimiters.set(alias, new RateLimiter(options));
    }
  }

  isServerEnabled(alias) {
    const configKey = CONFIG_KEY_MAP[alias];
    const serverConfig = this.config.mcp?.servers?.[configKey];
    return serverConfig?.enabled !== false;
  }

  async testConnection() {
    try {
      await this.klavis.mcpServer.getAllMcpServers();
      console.log('✅ Klavis API connection verified');
      return true;
    } catch (error) {
      throw new Error(`Klavis API test failed: ${error.message}`);
    }
  }

  async loadSavedServerConnections() {
    try {
      const connections = await this.tokenStore.getAllServerConnections();
      for (const entry of connections) {
        const alias = normalizeServerKey(entry.name || entry.server || entry.alias);
        if (!alias) continue;
        this.serverConnections.set(alias, {
          serverUrl: entry.serverUrl,
          instanceId: entry.instanceId,
          authData: entry.authData || entry.token,
          expiresAt: entry.expiresAt || null,
          scopes: parseScopes(entry.scopes),
          lastRefreshed: entry.lastRefreshed,
          savedAt: entry.savedAt
        });
        this.registerServerClient(alias);
      }
      if (connections.length > 0) {
        console.log(`🔐 Restored MCP connections for: ${connections.map((c) => c.name || c.alias).join(', ')}`);
      }
    } catch (error) {
      console.warn('⚠️ Failed restoring saved MCP connections:', error.message);
    }
  }

  async discoverServersAndTools() {
    for (const alias of SERVER_KEYS) {
      if (!this.isServerEnabled(alias)) continue;
      await this.#discoverToolsForServer(alias);
    }
  }

  async #discoverToolsForServer(alias) {
    if (this.mockMode) return;
    const canonical = SERVER_CANONICAL_NAMES[alias];
    for (const format of TOOL_FORMATS) {
      try {
        const response = await this.klavis.mcpServer.getTools(canonical, { format });
        const tools = Array.isArray(response?.tools) ? response.tools : Array.isArray(response) ? response : [];
        const map = this.availableToolsByFormat.get(format) || new Map();
        map.set(alias, tools);
        this.availableToolsByFormat.set(format, map);
        console.log(`🧰 Registered ${tools.length} tools for ${alias} (${format})`);
      } catch (error) {
        console.warn(`⚠️ Failed to list tools for ${alias} (${format}):`, error.message);
      }
    }
  }

  registerServerClient(alias) {
    const connection = this.serverConnections.get(alias);
    if (!connection?.serverUrl) return;
    this.mcpServers.set(alias, {
      serverUrl: connection.serverUrl,
      instanceId: connection.instanceId,
      callTool: async (toolName, args) => {
        return await this.#executeWithGuards(alias, () =>
          this.klavis.mcpServer.callTools({
            serverUrl: connection.serverUrl,
            toolName,
            arguments: args
          })
        );
      }
    });
  }

  async #executeWithGuards(alias, executor) {
    if (this.mockMode) {
      return executor();
    }

    const limiter = this.rateLimiters.get(alias) || this.defaultRateLimiter;
    return await limiter.schedule(async () => {
      await this.#ensureValidAuth(alias);
      try {
        return await executor();
      } catch (error) {
        if (this.#shouldAttemptRefresh(error)) {
          await this.refreshAuthData(alias, { force: true });
          return await executor();
        }
        throw this.#wrapError(error, alias);
      }
    }, { context: `mcp:${alias}` });
  }

  #shouldAttemptRefresh(error) {
    if (!error) return false;
    if (error instanceof KlavisTimeoutError) return false;
    const statusCode = Number(error.statusCode ?? error?.rawResponse?.status ?? error?.body?.statusCode);
    if ([401, 403].includes(statusCode)) return true;
    const message = String(error.message || '').toLowerCase();
    return message.includes('token') && message.includes('expire');
  }

  #wrapError(error, alias) {
    if (!error) {
      const fallback = new Error(`Unknown MCP error for ${alias}`);
      fallback.server = alias;
      return fallback;
    }
    if (error instanceof KlavisError || error instanceof KlavisTimeoutError) {
      error.server = alias;
      return error;
    }
    const wrapped = new Error(error.message || `MCP error for ${alias}`);
    wrapped.server = alias;
    wrapped.original = error;
    return wrapped;
  }

  async #ensureValidAuth(alias) {
    const connection = this.serverConnections.get(alias);
    if (!connection) {
      throw new Error(`Server ${alias} not connected`);
    }
    if (!connection.expiresAt) return;
    const expiresAtMs = new Date(connection.expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs)) return;
    if (expiresAtMs - this.tokenRefreshBufferMs <= Date.now()) {
      await this.refreshAuthData(alias);
    }
  }

  async refreshAuthData(alias) {
    if (this.mockMode) {
      return { mock: true };
    }
    const connection = this.serverConnections.get(alias);
    if (!connection?.instanceId) {
      throw new Error(`Server ${alias} not connected`);
    }
    try {
      const response = await this.klavis.mcpServer.getInstanceAuthData(connection.instanceId);
      const authData = response?.authData;
      if (!authData) {
        throw new Error('No auth data returned for refresh');
      }
      connection.authData = authData;
      connection.expiresAt = parseExpiresAt(authData, connection.expiresAt);
      connection.lastRefreshed = nowIso();
      await this.tokenStore.setServerConnection(alias, connection);
      this.registerServerClient(alias);
      return connection;
    } catch (error) {
      throw this.#wrapError(error, alias);
    }
  }

  async startOAuthFlow(serverInput, options = {}) {
    if (this.mockMode) {
      const state = buildState();
      return {
        oauthUrl: `https://mock.klavis/${serverInput}?state=${state}`,
        state,
        server: serverInput,
        instanceId: `mock-${serverInput}`
      };
    }

    const alias = normalizeServerKey(serverInput);
    if (!alias || !SERVER_CANONICAL_NAMES[alias]) {
      throw new Error(`Unsupported Klavis server: ${serverInput}`);
    }
    const canonical = SERVER_CANONICAL_NAMES[alias];
    const userId = String(options.userId || this.defaultUserId);
    const redirectUrl = options.redirectUri || this.config.mcp?.oauth?.redirectUri || 'http://localhost:3000/auth/callback';

    const createResponse = await this.klavis.mcpServer.createServerInstance({
      serverName: canonical,
      userId
    });
    const instanceId = createResponse?.instanceId;
    const serverUrl = createResponse?.serverUrl;
    if (!instanceId || !serverUrl) {
      throw new Error('Failed to create Klavis server instance');
    }

    const scopes = parseScopes(this.config.mcp?.servers?.[CONFIG_KEY_MAP[alias]]?.scopes);
    const oauthResponse = await this.klavis.mcpServer.getOAuthUrl({
      serverName: canonical,
      instanceId,
      scope: scopes.join(' '),
      redirectUrl
    });
    const state = buildState();
    const rawOAuthUrl = oauthResponse?.oauthUrl || createResponse?.oauthUrl;
    if (!rawOAuthUrl) {
      throw new Error('Klavis API did not return an OAuth URL');
    }
    const oauthUrl = new URL(rawOAuthUrl);
    if (redirectUrl) oauthUrl.searchParams.set('redirect_uri', redirectUrl);
    oauthUrl.searchParams.set('state', state);

    await this.tokenStore.saveOAuthState(state, {
      serverKey: alias,
      canonicalName: canonical,
      instanceId,
      serverUrl,
      scopes,
      redirectUrl,
      userId
    });

    return {
      oauthUrl: oauthUrl.toString(),
      state,
      server: alias,
      instanceId,
      scopes
    };
  }

  async completeOAuthFlow({ state, server, instanceId, code, token, params = {} } = {}) {
    if (!state) {
      throw new Error('state parameter is required');
    }
    if (this.mockMode) {
      return {
        status: 'mock',
        server,
        state
      };
    }

    const saved = await this.tokenStore.consumeOAuthState(state);
    if (!saved) {
      throw new Error('Invalid or expired OAuth state');
    }

    const alias = normalizeServerKey(server || saved.serverKey);
    if (!alias || !SERVER_CANONICAL_NAMES[alias]) {
      throw new Error(`Unsupported Klavis server: ${server}`);
    }

    if (params.error) {
      throw new Error(params.error_description || params.error);
    }

    const resolvedInstanceId = instanceId || params.instance_id || saved.instanceId;
    if (!resolvedInstanceId) {
      throw new Error('Missing instanceId in OAuth callback');
    }

    const authPayload = extractAuthPayloadFromParams({ ...params, code, token }) || (token ? { token } : null) || (code ? { data: { authorization_code: code } } : null);
    if (!authPayload) {
      throw new Error('No authentication payload provided by callback');
    }

    await this.klavis.mcpServer.setInstanceAuth({
      instanceId: resolvedInstanceId,
      authData: authPayload
    });

    let authData;
    try {
      const authResponse = await this.klavis.mcpServer.getInstanceAuthData(resolvedInstanceId);
      authData = authResponse?.authData || authPayload.data || authPayload;
    } catch (error) {
      authData = authPayload.data || authPayload;
      console.warn('⚠️ Failed to fetch auth data after OAuth completion:', error.message);
    }

    const connection = {
      serverUrl: saved.serverUrl,
      instanceId: resolvedInstanceId,
      authData,
      expiresAt: parseExpiresAt(authData, saved.expiresAt),
      scopes: parseScopes(authData?.scope || saved.scopes),
      lastRefreshed: nowIso()
    };

    this.serverConnections.set(alias, connection);
    await this.tokenStore.setServerConnection(alias, connection);
    this.registerServerClient(alias);
    await this.#discoverToolsForServer(alias);

    return {
      status: 'connected',
      server: alias,
      canonicalName: SERVER_CANONICAL_NAMES[alias],
      instanceId: resolvedInstanceId,
      expiresAt: connection.expiresAt,
      scopes: connection.scopes
    };
  }

  async callTool(toolName, parameters, serverName) {
    if (!this.initialized) {
      throw new Error('KlavisProvider not initialized');
    }

    const alias = normalizeServerKey(serverName);
    if (!alias) {
      throw new Error('serverName is required for tool calls');
    }

    if (this.mockMode) {
      console.log(`🔧 Mock tool call: ${toolName} on ${alias}`);
      return { success: true, mock: true, toolName, parameters, server: alias };
    }

    const server = this.mcpServers.get(alias);
    if (!server) {
      throw new Error(`Server ${alias} not connected`);
    }

    return await server.callTool(toolName, parameters);
  }

  getToolsForFormat(format = 'openai') {
    if (!this.initialized) {
      throw new Error('KlavisProvider not initialized');
    }
    const mapForFormat = this.availableToolsByFormat.get(format) || new Map();
    const allTools = [];
    for (const [serverName, tools] of mapForFormat.entries()) {
      const items = Array.isArray(tools) ? tools : [];
      allTools.push(...items.map((tool) => ({ ...tool, server: serverName })));
    }
    return allTools;
  }

  async getAccountInfo(accountName) {
    if (!this.initialized) {
      throw new Error('KlavisProvider not initialized');
    }

    try {
      const accountData = {};

      if (this.mcpServers.has('gmail')) {
        try {
          const emailData = await this.getEmailData(accountName);
          accountData.emails = emailData;
        } catch (error) {
          console.warn('Failed to get email data:', error.message);
        }
      }

      if (this.mcpServers.has('google_calendar')) {
        try {
          const calendarData = await this.getCalendarData(accountName);
          accountData.calendar = calendarData;
        } catch (error) {
          console.warn('Failed to get calendar data:', error.message);
        }
      }

      return accountData.emails || accountData.calendar ?
        this.buildAccountInfoFromData(accountName, accountData) :
        this.generateMockAccountInfo(accountName);
    } catch (error) {
      console.error(`Failed to get account info for ${accountName}:`, error.message);
      return this.generateMockAccountInfo(accountName);
    }
  }

  buildAccountInfoFromData(accountName, data) {
    const emailCount = data.emails?.length || 0;
    const meetingCount = data.calendar?.length || 0;

    return {
      accountName: accountName.charAt(0).toUpperCase() + accountName.slice(1),
      status: 'Active',
      healthScore: Math.min(95, 60 + (emailCount * 2) + (meetingCount * 5)),
      lastActivity: data.emails?.[0]?.timestamp || new Date().toISOString(),
      totalInteractions: emailCount + meetingCount,
      stage: 'Growth',
      revenue: {
        current: Math.floor(Math.random() * 500000) + 100000,
        potential: Math.floor(Math.random() * 1000000) + 200000
      },
      companyInfo: {
        industry: 'Technology',
        employees: Math.floor(Math.random() * 10000) + 100,
        founded: Math.floor(Math.random() * 30) + 1994
      },
      dataSource: 'klavis_mcp'
    };
  }

  async getInteractionHistory(accountName) {
    if (!this.initialized) {
      throw new Error('KlavisProvider not initialized');
    }

    try {
      const [emails, events] = await Promise.all([
        this.getEmailData(accountName).catch(() => []),
        this.getCalendarData(accountName).catch(() => [])
      ]);

      const emailInteractions = (emails || []).flatMap((thread) =>
        (thread.messages || []).map((msg) => ({
          type: 'email',
          date: msg.timestamp || new Date().toISOString(),
          subject: msg.subject || thread.topic || 'Email interaction',
          participants: [msg.from, ...(Array.isArray(msg.to) ? msg.to : [msg.to]).filter(Boolean)],
          summary: (msg.body && String(msg.body).slice(0, 120)) || 'Email message',
          sentiment: 'neutral'
        }))
      );

      const calendarInteractions = (events || []).map((ev) => ({
        type: 'meeting',
        date: ev.date,
        subject: ev.title || 'Meeting',
        participants: ev.attendees || [],
        summary: `Calendar event (${ev.duration || 'unknown duration'})`,
        sentiment: 'neutral'
      }));

      const interactions = [...emailInteractions, ...calendarInteractions]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 50);

      if (interactions.length === 0) {
        return this.generateMockInteractionHistory(accountName);
      }

      return interactions;
    } catch (error) {
      console.error(`Failed to build interaction history for ${accountName}:`, error.message);
      return this.generateMockInteractionHistory(accountName);
    }
  }

  async getStakeholders(accountName) {
    if (!this.initialized) {
      throw new Error('KlavisProvider not initialized');
    }

    try {
      const emails = await this.getEmailData(accountName).catch(() => []);
      const people = new Map();
      for (const thread of emails || []) {
        for (const msg of thread.messages || []) {
          const add = (email) => {
            if (!email) return;
            const addr = String(email).toLowerCase();
            if (!people.has(addr)) people.set(addr, { email: addr, count: 0 });
            people.get(addr).count += 1;
          };
          add(msg.from);
          if (Array.isArray(msg.to)) msg.to.forEach(add); else add(msg.to);
        }
      }

      const stakeholders = Array.from(people.values()).slice(0, 8).map((p, idx) => ({
        name: p.email.split('@')[0].replace('.', ' '),
        role: idx === 0 ? 'decision_maker' : idx % 3 === 0 ? 'technical' : 'influencer',
        relationshipStrength: p.count > 3 ? 'Strong' : p.count > 1 ? 'Medium' : 'Weak',
        lastEngagement: new Date().toISOString(),
        influence: p.count > 3 ? 8 : 5,
        sentiment: 'neutral'
      }));

      return stakeholders.length > 0 ? stakeholders : this.generateMockStakeholders(accountName);
    } catch (error) {
      console.error(`Failed to derive stakeholders for ${accountName}:`, error.message);
      return this.generateMockStakeholders(accountName);
    }
  }

  async getEmailData(accountName) {
    if (!this.initialized) {
      throw new Error('KlavisProvider not initialized');
    }

    const gmailServer = this.mcpServers.get('gmail');
    if (!gmailServer) {
      console.warn('Gmail server not available');
      return [];
    }

    try {
      const searchResult = await gmailServer.callTool('search_messages', {
        query: `from:*@${accountName}.com OR to:*@${accountName}.com`,
        maxResults: 25
      });

      if (!searchResult?.messages) {
        return [];
      }

      const emailThreads = [];
      for (const message of searchResult.messages.slice(0, 10)) {
        try {
          const messageDetail = await gmailServer.callTool('get_message', {
            messageId: message.id
          });

          emailThreads.push({
            thread_id: messageDetail.threadId,
            topic: messageDetail.subject || 'No Subject',
            messages: [{
              from: messageDetail.from,
              to: messageDetail.to,
              timestamp: messageDetail.date,
              subject: messageDetail.subject,
              body: messageDetail.body
            }]
          });
        } catch (msgError) {
          console.warn(`Failed to get message ${message.id}:`, msgError.message);
        }
      }

      return emailThreads;
    } catch (error) {
      console.error(`Failed to get email data for ${accountName}:`, error.message);
      return [];
    }
  }

  async getCallData(accountName) {
    if (!this.initialized) {
      throw new Error('KlavisProvider not initialized');
    }
    return [];
  }

  async getDocuments(accountName) {
    if (!this.initialized) {
      throw new Error('KlavisProvider not initialized');
    }

    const driveServer = this.mcpServers.get('google_drive');
    if (!driveServer) return [];
    try {
      const result = await driveServer.callTool('search_files', {
        query: accountName,
        pageSize: 20
      });
      const items = result.files || result.items || [];
      return items.map((doc) => ({
        id: doc.id,
        title: doc.name || doc.title,
        type: doc.mimeType || 'file',
        lastModified: doc.modifiedTime || doc.lastModified,
        summary: doc.summary || '',
        url: doc.webViewLink || doc.url
      }));
    } catch (error) {
      console.warn(`Drive search failed for ${accountName}:`, error.message);
      return [];
    }
  }

  async getCalendarData(accountName) {
    if (!this.initialized) {
      throw new Error('KlavisProvider not initialized');
    }

    const calendarServer = this.mcpServers.get('google_calendar');
    if (!calendarServer) {
      console.warn('Google Calendar server not available');
      return [];
    }

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const eventsResult = await calendarServer.callTool('list_events', {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        q: accountName,
        maxResults: 30
      });

      if (!eventsResult?.items) {
        return [];
      }

      return eventsResult.items.map((event) => ({
        id: event.id,
        title: event.summary || 'No Title',
        date: event.start?.dateTime || event.start?.date,
        duration: this.calculateDuration(event.start, event.end),
        attendees: event.attendees?.map((att) => att.email) || [],
        type: event.eventType || 'meeting',
        status: event.status || 'confirmed'
      }));
    } catch (error) {
      console.error(`Failed to get calendar data for ${accountName}:`, error.message);
      return [];
    }
  }

  calculateDuration(start, end) {
    if (!start || !end) return 'Unknown';

    const startTime = new Date(start.dateTime || start.date);
    const endTime = new Date(end.dateTime || end.date);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));

    if (durationMinutes < 60) {
      return `${durationMinutes} minutes`;
    }
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    return `${hours}h ${minutes}m`;
  }

  async getCRMData() {
    if (!this.initialized) {
      throw new Error('KlavisProvider not initialized');
    }
    return { opportunities: [], activities: [], notes: [], customFields: {} };
  }

  getStatus() {
    const servers = Array.from(this.mcpServers.keys());
    const countBy = (format) => {
      const map = this.availableToolsByFormat.get(format) || new Map();
      const obj = {};
      for (const [srv, tools] of map.entries()) obj[srv] = Array.isArray(tools) ? tools.length : 0;
      return obj;
    };
    const connections = Array.from(this.serverConnections.entries()).map(([alias, conn]) => ({
      server: alias,
      instanceId: conn.instanceId,
      expiresAt: conn.expiresAt || null,
      scopes: conn.scopes || [],
      lastRefreshed: conn.lastRefreshed || conn.savedAt || null
    }));
    return {
      initialized: !!this.initialized,
      mockMode: !!this.mockMode,
      servers,
      toolCounts: {
        openai: countBy('openai'),
        claude: countBy('claude')
      },
      connections
    };
  }

  async syncAccountData(accountName, updates = {}) {
    if (!this.initialized) {
      throw new Error('KlavisProvider not initialized');
    }

    if (this.mockMode) {
      return {
        success: true,
        updatedFields: Object.keys(updates || {}),
        conflicts: []
      };
    }

    const operations = Array.isArray(updates.operations) ? updates.operations : [];
    if (operations.length === 0) {
      return {
        success: true,
        updatedFields: [],
        conflicts: []
      };
    }

    const applied = [];
    const conflicts = [];

    for (const op of operations) {
      const alias = normalizeServerKey(op.server || op.provider || op.serverName);
      if (!alias || !this.mcpServers.has(alias)) {
        conflicts.push({ ...op, reason: 'server_not_connected' });
        continue;
      }

      try {
        if (op.expectedRevision && op.verificationTool) {
          const remote = await this.safeCallTool(alias, op.verificationTool, {
            accountName,
            recordId: op.recordId,
            ...op.verificationPayload
          }, { optional: true });
          const remoteRevision = remote?.revision || remote?.version || remote?.updatedAt;
          if (remoteRevision && remoteRevision !== op.expectedRevision) {
            conflicts.push({ ...op, reason: 'version_mismatch', remoteRevision });
            continue;
          }
        }

        const toolName = op.toolName || op.action;
        if (!toolName) {
          conflicts.push({ ...op, reason: 'missing_tool' });
          continue;
        }

        const params = { ...op.parameters, accountName };
        const result = await this.safeCallTool(alias, toolName, params);
        applied.push({
          operationId: op.id || `${toolName}:${Date.now()}`,
          toolName,
          server: alias,
          result
        });
      } catch (error) {
        conflicts.push({ ...op, reason: 'execution_failed', error: error.message });
      }
    }

    return {
      success: conflicts.length === 0,
      updatedFields: applied,
      conflicts
    };
  }

  async safeCallTool(alias, toolName, params, options = {}) {
    try {
      return await this.callTool(toolName, params, alias);
    } catch (error) {
      if (options.optional) {
        console.warn(`Optional tool call ${toolName} on ${alias} failed:`, error.message);
        return null;
      }
      throw error;
    }
  }

  async connectServer(serverName, tokenPayload = {}, options = {}) {
    if (!this.initialized) {
      throw new Error('KlavisProvider not initialized');
    }

    const alias = normalizeServerKey(serverName);
    if (!alias || !SERVER_CANONICAL_NAMES[alias]) {
      throw new Error(`Unsupported Klavis server: ${serverName}`);
    }

    if (this.mockMode) {
      const connection = {
        serverUrl: `https://mock.klavis/${alias}`,
        instanceId: `mock-${alias}`,
        authData: tokenPayload,
        expiresAt: null,
        scopes: parseScopes(options.scopes || tokenPayload.scopes),
        lastRefreshed: nowIso()
      };
      this.serverConnections.set(alias, connection);
      await this.tokenStore.setServerConnection(alias, connection);
      this.registerServerClient(alias);
      return true;
    }

    const instanceId = options.instanceId || tokenPayload.instanceId || `manual-${alias}`;
    const serverUrl = options.serverUrl || tokenPayload.serverUrl || `https://mcp.klavis.run/${alias}/${instanceId}`;

    const connection = {
      serverUrl,
      instanceId,
      authData: tokenPayload,
      expiresAt: parseExpiresAt(tokenPayload, null),
      scopes: parseScopes(options.scopes || tokenPayload.scopes),
      lastRefreshed: nowIso()
    };

    this.serverConnections.set(alias, connection);
    await this.tokenStore.setServerConnection(alias, connection);
    this.registerServerClient(alias);
    await this.#discoverToolsForServer(alias);
    return true;
  }

  generateMockAccountInfo(accountName) {
    return {
      accountName: accountName.charAt(0).toUpperCase() + accountName.slice(1),
      status: 'Active',
      healthScore: 72,
      lastActivity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      totalInteractions: Math.floor(Math.random() * 150) + 50,
      stage: 'Growth',
      revenue: {
        current: Math.floor(Math.random() * 500000) + 100000,
        potential: Math.floor(Math.random() * 1000000) + 200000
      },
      companyInfo: {
        industry: 'Technology',
        employees: Math.floor(Math.random() * 10000) + 100,
        founded: Math.floor(Math.random() * 30) + 1994
      }
    };
  }

  generateMockInteractionHistory(accountName) {
    const interactions = [];
    const types = ['email', 'call', 'meeting', 'demo', 'support'];
    const participants = ['john.smith@' + accountName + '.com', 'sarah.jones@' + accountName + '.com', 'mike.wilson@company.com'];

    for (let i = 0; i < 15; i++) {
      interactions.push({
        type: types[Math.floor(Math.random() * types.length)],
        date: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
        subject: `${types[Math.floor(Math.random() * types.length)].charAt(0).toUpperCase() + types[Math.floor(Math.random() * types.length)].slice(1)} regarding ${accountName} account`,
        participants: participants.slice(0, Math.floor(Math.random() * 2) + 1),
        outcome: Math.random() > 0.3 ? 'positive' : 'neutral'
      });
    }

    return interactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  generateMockStakeholders(accountName) {
    const base = accountName.charAt(0).toUpperCase() + accountName.slice(1);
    return [
      { name: `${base} Decision Maker`, role: 'decision_maker', relationshipStrength: 'Strong', lastEngagement: new Date().toISOString(), influence: 9, sentiment: 'positive' },
      { name: `${base} Champion`, role: 'champion', relationshipStrength: 'Medium', lastEngagement: new Date().toISOString(), influence: 7, sentiment: 'positive' },
      { name: `${base} Influencer`, role: 'influencer', relationshipStrength: 'Weak', lastEngagement: new Date().toISOString(), influence: 5, sentiment: 'neutral' },
      { name: `${base} Architect`, role: 'technical', relationshipStrength: 'Medium', lastEngagement: new Date().toISOString(), influence: 6, sentiment: 'neutral' }
    ];
  }
}

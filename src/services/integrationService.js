import axios from 'axios';
import crypto from 'crypto';
import { TokenStore } from '../utils/tokenStore.js';

const PROVIDERS = {
  PIPEDREAM: 'pipedream',
  PEOPLE_AI: 'peopleAI'
};

export class IntegrationService {
  constructor(config, options = {}) {
    this.config = config;
    this.tokenStore = options.tokenStore || new TokenStore({ filename: 'integrations.json' });
  }

  isEnabled(provider) {
    if (provider === PROVIDERS.PIPEDREAM) {
      return this.config?.integrations?.pipedream?.enabled === true;
    }
    if (provider === PROVIDERS.PEOPLE_AI) {
      return this.config?.integrations?.peopleAI?.enabled === true;
    }
    return false;
  }

  async createState(payload) {
    const state = crypto.randomUUID();
    await this.tokenStore.saveOAuthState(state, payload);
    return state;
  }

  async getOAuthUrl(provider, options = {}) {
    if (provider === PROVIDERS.PIPEDREAM) {
      return this.getPipedreamOAuthUrl(options);
    }
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  async handleOAuthCallback(provider, params) {
    if (provider === PROVIDERS.PIPEDREAM) {
      return this.handlePipedreamCallback(params);
    }
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  async getPipedreamOAuthUrl(options = {}) {
    const config = this.config?.integrations?.pipedream || {};
    if (!this.isEnabled(PROVIDERS.PIPEDREAM)) {
      throw new Error('Pipedream integration not enabled');
    }
    if (!config.clientId || !config.authUrl) {
      throw new Error('Missing Pipedream OAuth configuration');
    }
    const redirectUri = options.redirectUri || config.redirectUri || this.config?.security?.okta?.redirectUri;
    if (!redirectUri) {
      throw new Error('Pipedream redirect URI not configured');
    }
    const state = options.state || await this.createState({ provider: PROVIDERS.PIPEDREAM, redirectUri });
    const scopes = Array.isArray(config.scopes) && config.scopes.length > 0 ? config.scopes : ['openid', 'profile', 'email'];
    const url = new URL(config.authUrl);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('state', state);
    if (options.prompt) url.searchParams.set('prompt', options.prompt);
    return { url: url.toString(), state, redirectUri, scopes };
  }

  async handlePipedreamCallback({ code, state }) {
    if (!code) {
      throw new Error('Authorization code required');
    }
    const saved = await this.tokenStore.consumeOAuthState(state);
    if (!saved || saved.provider !== PROVIDERS.PIPEDREAM) {
      throw new Error('Invalid or expired OAuth state');
    }
    const config = this.config?.integrations?.pipedream || {};
    const tokenUrl = config.tokenUrl;
    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('code', code);
    params.set('redirect_uri', saved.redirectUri);
    params.set('client_id', config.clientId);
    params.set('client_secret', config.clientSecret || '');

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const tokens = response.data || {};
    tokens.receivedAt = new Date().toISOString();
    await this.tokenStore.setServerToken(PROVIDERS.PIPEDREAM, tokens);
    return tokens;
  }

  async getStoredTokens(provider) {
    return this.tokenStore.getServerToken(provider);
  }

  async pushPipedreamEvent(eventName, payload, options = {}) {
    const config = this.config?.integrations?.pipedream || {};
    if (!this.isEnabled(PROVIDERS.PIPEDREAM)) {
      throw new Error('Pipedream integration not enabled');
    }

    const body = {
      event: eventName,
      timestamp: new Date().toISOString(),
      payload
    };

    if (config.eventWebhookUrl) {
      await axios.post(config.eventWebhookUrl, body, {
        headers: { 'Content-Type': 'application/json' }
      });
      return { deliveredVia: 'webhook' };
    }

    const tokens = await this.getStoredTokens(PROVIDERS.PIPEDREAM);
    if (!tokens?.access_token || !config.baseUrl) {
      throw new Error('Pipedream access token unavailable and no webhook configured');
    }

    const targetUrl = options.url
      || (config.defaultSource ? `${config.baseUrl}/sources/${config.defaultSource}/event` : `${config.baseUrl}/v1/events`);

    await axios.post(targetUrl, body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.access_token}`
      }
    });

    return { deliveredVia: 'api', targetUrl };
  }

  async pushPeopleAI(payload, options = {}) {
    const config = this.config?.integrations?.peopleAI || {};
    if (!this.isEnabled(PROVIDERS.PEOPLE_AI)) {
      throw new Error('People.ai connector not enabled');
    }
    if (!config.apiKey) {
      throw new Error('People.ai API key missing');
    }
    const connectorId = options.connectorId || config.connectorId;
    if (!connectorId) {
      throw new Error('People.ai connector id missing');
    }
    const url = `${config.baseUrl.replace(/\/$/, '')}/connectors/${connectorId}/ingest`;
    const response = await axios.post(url, {
      receivedAt: new Date().toISOString(),
      pipedreamDestination: options.pipedreamDestination || config.pipedreamDestination,
      data: payload
    }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      }
    });
    return response.data;
  }

  async getStatus() {
    const pipedreamTokens = await this.getStoredTokens(PROVIDERS.PIPEDREAM);
    const pipedreamStatus = {
      enabled: this.isEnabled(PROVIDERS.PIPEDREAM),
      hasToken: !!pipedreamTokens?.access_token,
      expiresAt: pipedreamTokens?.expires_in ? new Date(Date.now() + pipedreamTokens.expires_in * 1000).toISOString() : null,
      webhookConfigured: !!this.config?.integrations?.pipedream?.eventWebhookUrl
    };

    const peopleStatus = {
      enabled: this.isEnabled(PROVIDERS.PEOPLE_AI),
      connectorId: this.config?.integrations?.peopleAI?.connectorId || null,
      pipedreamDestination: this.config?.integrations?.peopleAI?.pipedreamDestination || null
    };

    return {
      pipedream: pipedreamStatus,
      peopleAI: peopleStatus
    };
  }
}

export const INTEGRATION_PROVIDERS = PROVIDERS;

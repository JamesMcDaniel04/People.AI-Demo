import axios from 'axios';
import crypto from 'crypto';
import { TokenStore } from '../utils/tokenStore.js';

export class OktaAuthService {
  constructor(config, options = {}) {
    this.config = config;
    this.okta = config?.security?.okta || {};
    this.tokenStore = options.tokenStore || new TokenStore({ filename: 'okta.json' });
    this.enabled = this.okta?.enabled !== false && !!this.okta?.clientId && !!this.okta?.domain;
  }

  isEnabled() {
    return this.enabled;
  }

  authorityBase() {
    if (!this.okta?.domain) {
      throw new Error('Okta domain not configured');
    }
    const authServerId = this.okta?.authServerId || 'default';
    return `https://${this.okta.domain}/oauth2/${authServerId}`;
  }

  resolveScopes(scopes) {
    const configured = Array.isArray(this.okta?.scopes) && this.okta.scopes.length > 0
      ? this.okta.scopes
      : ['openid', 'profile', 'email'];
    if (!scopes) return configured;
    return Array.isArray(scopes) ? scopes : String(scopes).split(/[\s,]+/).filter(Boolean);
  }

  async createState(metadata = {}) {
    const state = crypto.randomUUID();
    await this.tokenStore.saveOAuthState(state, { provider: 'okta', ...metadata });
    return state;
  }

  async getAuthorizationUrl(options = {}) {
    if (!this.isEnabled()) {
      throw new Error('Okta OAuth not enabled');
    }

    const redirectUri = options.redirectUri || this.okta.redirectUri;
    if (!redirectUri) {
      throw new Error('Okta redirect URI not configured');
    }

    const state = options.state || await this.createState({ redirectUri, createdBy: options.createdBy || 'okta-service' });
    const scopes = this.resolveScopes(options.scopes);

    const authorizeUrl = new URL(`${this.authorityBase()}/v1/authorize`);
    authorizeUrl.searchParams.set('client_id', this.okta.clientId);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', scopes.join(' '));
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('state', state);
    if (this.okta.audience) {
      authorizeUrl.searchParams.set('audience', this.okta.audience);
    }
    if (options.prompt) authorizeUrl.searchParams.set('prompt', options.prompt);

    return {
      url: authorizeUrl.toString(),
      state,
      redirectUri,
      scopes
    };
  }

  async exchangeCodeForToken(code, redirectUri) {
    if (!this.isEnabled()) {
      throw new Error('Okta OAuth not enabled');
    }
    if (!code) {
      throw new Error('Authorization code required');
    }
    const tokenUrl = `${this.authorityBase()}/v1/token`;

    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('code', code);
    params.set('redirect_uri', redirectUri || this.okta.redirectUri);
    params.set('client_id', this.okta.clientId);

    const authHeader = Buffer.from(`${this.okta.clientId}:${this.okta.clientSecret || ''}`).toString('base64');

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authHeader}`
      }
    });

    const tokenSet = response.data || {};
    tokenSet.receivedAt = new Date().toISOString();
    await this.tokenStore.setServerToken('okta', tokenSet);
    return tokenSet;
  }

  async handleCallback({ code, state }) {
    if (!state) {
      throw new Error('Missing OAuth state');
    }
    const saved = await this.tokenStore.consumeOAuthState(state);
    if (!saved || saved.provider !== 'okta') {
      throw new Error('Invalid OAuth state');
    }
    const tokenSet = await this.exchangeCodeForToken(code, saved.redirectUri);
    const userInfo = await this.getUserInfo(tokenSet.access_token);
    return {
      tokens: tokenSet,
      user: userInfo,
      state: saved
    };
  }

  async refreshToken(refreshToken) {
    const tokenUrl = `${this.authorityBase()}/v1/token`;
    const params = new URLSearchParams();
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', refreshToken);
    params.set('client_id', this.okta.clientId);

    const authHeader = Buffer.from(`${this.okta.clientId}:${this.okta.clientSecret || ''}`).toString('base64');
    const response = await axios.post(tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authHeader}`
      }
    });
    const tokenSet = response.data || {};
    tokenSet.receivedAt = new Date().toISOString();
    if (tokenSet.refresh_token === undefined) {
      tokenSet.refresh_token = refreshToken;
    }
    await this.tokenStore.setServerToken('okta', tokenSet);
    return tokenSet;
  }

  async getStoredTokens() {
    return await this.tokenStore.getServerToken('okta');
  }

  async getUserInfo(accessToken) {
    if (!accessToken) {
      throw new Error('Access token required');
    }
    const userInfoUrl = `${this.authorityBase()}/v1/userinfo`;
    const response = await axios.get(userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }
}

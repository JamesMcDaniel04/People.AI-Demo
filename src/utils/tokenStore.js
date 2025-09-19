import { promises as fs } from 'fs';
import { join } from 'path';

function ensureShape(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  data.servers = data.servers && typeof data.servers === 'object' ? data.servers : {};
  data.oauthStates = data.oauthStates && typeof data.oauthStates === 'object' ? data.oauthStates : {};
  return data;
}

export class TokenStore {
  constructor(options = {}) {
    this.baseDir = options.baseDir || join(process.cwd(), '.tokens');
    this.filename = options.filename || 'klavis.json';
    this.fullPath = join(this.baseDir, this.filename);
  }

  async ensureDir() {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch {}
  }

  async load() {
    try {
      const raw = await fs.readFile(this.fullPath, 'utf-8');
      return ensureShape(JSON.parse(raw));
    } catch {
      return ensureShape({});
    }
  }

  async save(tokens) {
    const data = ensureShape(tokens);
    await this.ensureDir();
    await fs.writeFile(this.fullPath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  }

  async setServerConnection(server, details) {
    const data = await this.load();
    data.servers[server] = {
      ...details,
      savedAt: new Date().toISOString()
    };
    await this.save(data);
    return data.servers[server];
  }

  async setServerToken(server, tokenObj) {
    return this.setServerConnection(server, tokenObj);
  }

  async getServerConnection(server) {
    const data = await this.load();
    return data.servers[server] || null;
  }

  async getServerToken(server) {
    return this.getServerConnection(server);
  }

  async deleteServerConnection(server) {
    const data = await this.load();
    if (data.servers[server]) {
      delete data.servers[server];
      await this.save(data);
      return true;
    }
    return false;
  }

  async listServers() {
    const data = await this.load();
    return Object.keys(data.servers || {});
  }

  async getAllServerConnections() {
    const data = await this.load();
    return Object.entries(data.servers || {}).map(([name, payload]) => ({
      name,
      ...payload
    }));
  }

  async saveOAuthState(state, payload) {
    if (!state) {
      throw new Error('State is required');
    }
    const data = await this.load();
    data.oauthStates[state] = {
      ...payload,
      createdAt: new Date().toISOString()
    };
    await this.save(data);
    return data.oauthStates[state];
  }

  async getOAuthState(state) {
    const data = await this.load();
    return data.oauthStates[state] || null;
  }

  async consumeOAuthState(state) {
    const data = await this.load();
    const payload = data.oauthStates[state] || null;
    if (payload) {
      delete data.oauthStates[state];
      await this.save(data);
    }
    return payload;
  }
}

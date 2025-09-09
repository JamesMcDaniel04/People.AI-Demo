import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
      const data = await fs.readFile(this.fullPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return { servers: {} };
    }
  }

  async save(tokens) {
    await this.ensureDir();
    await fs.writeFile(this.fullPath, JSON.stringify(tokens, null, 2), 'utf-8');
    return true;
  }

  async setServerToken(server, tokenObj) {
    const data = await this.load();
    data.servers = data.servers || {};
    data.servers[server] = { ...tokenObj, savedAt: new Date().toISOString() };
    await this.save(data);
    return data.servers[server];
  }

  async getServerToken(server) {
    const data = await this.load();
    return data.servers?.[server] || null;
  }

  async listServers() {
    const data = await this.load();
    return Object.keys(data.servers || {});
  }
}


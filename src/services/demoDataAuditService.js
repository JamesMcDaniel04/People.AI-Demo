import { mkdir, readFile, writeFile, readdir, unlink } from 'fs/promises';
import path from 'path';
import { slugAccount } from './demoDataQualityService.js';

const toVersionId = (dateIso) => {
  const safe = (dateIso || new Date().toISOString())
    .replace(/[-:.]/g, '')
    .replace('T', '_')
    .replace('Z', 'Z');
  return `v${safe}`;
};

const nowIso = () => new Date().toISOString();

export class DemoDataAuditService {
  constructor(config = {}) {
    this.config = config;
    this.outputRoot = config.demo?.dataset?.outputDir || path.resolve(process.cwd(), 'data/generated');
    this.auditRoot = config.demo?.dataset?.auditDir || path.resolve(process.cwd(), 'logs/demo-audit');
    this.retentionDays = Number(config.demo?.dataset?.retentionDays || 90);
    this.maxVersions = Number(config.demo?.dataset?.maxVersions || 10);
  }

  async record(accountName, dataset, quality) {
    const slug = slugAccount(accountName);
    const generatedAt = dataset?.metadata?.generatedAt || nowIso();
    const versionId = dataset?.metadata?.version?.id || toVersionId(generatedAt);
    const outputDir = path.join(this.outputRoot, slug);
    const auditFile = path.join(this.auditRoot, `${slug}.json`);
    await Promise.all([
      mkdir(outputDir, { recursive: true }),
      mkdir(this.auditRoot, { recursive: true })
    ]);

    const datasetPath = path.join(outputDir, `${versionId}.json`);
    const latestPath = path.join(outputDir, 'latest.json');

    const payload = {
      versionId,
      generatedAt,
      accountName,
      profile: dataset?.profile,
      datasetConfig: dataset?.datasetConfig,
      metadata: dataset?.metadata,
      quality,
      counts: {
        emails: dataset?.emails?.length || 0,
        calls: dataset?.calls?.length || 0,
        documents: dataset?.documents?.length || 0,
        calendar: dataset?.calendar?.length || 0,
        crm: dataset?.crm?.length || 0
      }
    };

    try {
      await writeFile(datasetPath, JSON.stringify(dataset, null, 2), 'utf-8');
      await writeFile(latestPath, JSON.stringify(dataset, null, 2), 'utf-8');
    } catch (error) {
      console.warn('⚠️ Failed to persist demo dataset', { accountName, error: error.message });
    }

    let history = [];
    try {
      const existing = await readFile(auditFile, 'utf-8');
      history = JSON.parse(existing);
      if (!Array.isArray(history)) history = [];
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('⚠️ Failed to load audit history', { accountName, error: error.message });
      }
    }

    history.push({
      versionId,
      generatedAt,
      recordedAt: nowIso(),
      quality,
      counts: payload.counts,
      profile: dataset?.profile,
      datasetPath: path.relative(process.cwd(), datasetPath)
    });

    history = this.pruneHistory(history);

    try {
      await writeFile(auditFile, JSON.stringify(history, null, 2), 'utf-8');
    } catch (error) {
      console.warn('⚠️ Failed to write audit history', { accountName, error: error.message });
    }

    await this.removeExpiredVersions(outputDir, history);

    return {
      id: versionId,
      path: datasetPath,
      recordedAt: nowIso(),
      versionsStored: history.length
    };
  }

  pruneHistory(history) {
    const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
    const filtered = history
      .filter(entry => {
        const ts = new Date(entry.generatedAt || entry.recordedAt || nowIso()).getTime();
        return ts >= cutoff;
      })
      .sort((a, b) => new Date(a.generatedAt || a.recordedAt) - new Date(b.generatedAt || b.recordedAt));

    while (filtered.length > this.maxVersions) {
      filtered.shift();
    }

    return filtered;
  }

  async removeExpiredVersions(outputDir, history) {
    try {
      const files = await readdir(outputDir);
      const allowed = new Set(history.map(entry => `${entry.versionId}.json`));
      for (const file of files) {
        if (file === 'latest.json') continue;
        if (!allowed.has(file)) {
          try {
            await unlink(path.join(outputDir, file));
          } catch (error) {
            if (error.code !== 'ENOENT') {
              console.warn('⚠️ Failed to remove expired dataset version', { file, error: error.message });
            }
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('⚠️ Failed to prune dataset versions', { outputDir, error: error.message });
      }
    }
  }

  async getHistory(accountName) {
    const slug = slugAccount(accountName);
    const auditFile = path.join(this.auditRoot, `${slug}.json`);
    try {
      const raw = await readFile(auditFile, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async getLatestDataset(accountName) {
    const slug = slugAccount(accountName);
    const latestPath = path.join(this.outputRoot, slug, 'latest.json');
    try {
      const raw = await readFile(latestPath, 'utf-8');
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}

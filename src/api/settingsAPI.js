import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export function createSettingsAPI(orchestrator, baseConfig) {
  const router = Router();

  const settingsPath = path.resolve(process.cwd(), 'data/settings.json');

  function readSettings() {
    try {
      if (fs.existsSync(settingsPath)) {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      }
    } catch (e) {
      // ignore
    }
    return {};
  }

  function writeSettings(payload) {
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(payload, null, 2));
  }

  // Get combined settings view (current config + overrides)
  router.get('/', async (req, res) => {
    try {
      const cfg = orchestrator?.config || baseConfig;
      const overrides = readSettings();
      const current = {
        ai: {
          provider: cfg.ai.provider,
          models: cfg.ai.models,
          temperature: cfg.ai.temperature,
          systemPrompt: cfg.ai.systemPrompt || '',
          toolSystemPrompt: cfg.ai.toolSystemPrompt || ''
        },
        data: {
          source: cfg.data.source,
          mcp: {
            enabled: cfg.mcp.enabled,
            servers: cfg.mcp.servers
          }
        },
        logging: {
          level: cfg.logging.level
        }
      };
      res.json({ success: true, current, overrides });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Update settings overrides (partial)
  router.post('/', async (req, res) => {
    try {
      const existing = readSettings();
      const merged = deepMerge({ ...existing }, req.body || {});
      writeSettings(merged);
      res.json({ success: true, settings: merged });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Apply settings without full restart (limited scope)
  router.post('/reload', async (req, res) => {
    try {
      const overrides = readSettings();
      const newConfig = deepMerge(clone(baseConfig), overrides);

      // Recreate data manager and account planner with updated config
      await orchestrator.shutdown?.(); // stop services that can be restarted safely
      orchestrator.config = newConfig;
      await orchestrator.initialize();

      res.json({ success: true, message: 'Settings applied and services reloaded.' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Utilities (scoped)
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    for (const key of Object.keys(source)) {
      const srcVal = source[key];
      const tgtVal = target[key];
      if (Array.isArray(srcVal)) {
        target[key] = srcVal.slice();
      } else if (srcVal && typeof srcVal === 'object') {
        target[key] = deepMerge(tgtVal && typeof tgtVal === 'object' ? { ...tgtVal } : {}, srcVal);
      } else {
        target[key] = srcVal;
      }
    }
    return target;
  }

  return router;
}

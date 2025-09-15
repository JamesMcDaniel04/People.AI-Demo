#!/usr/bin/env node
import { getRedisService } from '../src/services/redisService.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  // Clear Redis keys for this app
  try {
    const redis = getRedisService({});
    const ok = await redis.initialize();
    if (ok) {
      const prefix = process.env.JOB_QUEUE_PREFIX || 'ai-account-planner';
      const keys = await redis.redis.keys(`${prefix}:*`);
      for (const k of keys) await redis.redis.del(k);
      console.log(`Redis cleared for prefix: ${prefix} (${keys.length} keys)`);
      await redis.disconnect();
    } else {
      console.log('Redis not enabled; skipping queue reset');
    }
  } catch (e) {
    console.log('Redis reset skipped:', e.message);
  }

  // Remove stored MCP tokens
  try {
    const tokenFile = path.resolve(process.cwd(), 'klavis.json');
    if (fs.existsSync(tokenFile)) {
      fs.unlinkSync(tokenFile);
      console.log('Removed klavis.json');
    }
  } catch (e) {
    console.log('Token cleanup skipped:', e.message);
  }

  // Warm: touch dataset and preload simple cache if needed (no-op for now)
  console.log('Demo reset complete.');
}

main().catch(e => { console.error(e); process.exit(1); });


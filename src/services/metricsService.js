import { performance } from 'perf_hooks';

class MetricsService {
  constructor() {
    this.counters = new Map();
    this.timings = new Map(); // name -> array of ms (bounded)
    this.maxSamples = 500;
  }

  inc(name, value = 1) {
    this.counters.set(name, (this.counters.get(name) || 0) + value);
  }

  time(name, fn) {
    const start = performance.now();
    const finish = (ok = true) => {
      const ms = performance.now() - start;
      const arr = this.timings.get(name) || [];
      arr.push(ms);
      if (arr.length > this.maxSamples) arr.shift();
      this.timings.set(name, arr);
      this.inc(ok ? `${name}:ok` : `${name}:err`);
      return ms;
    };
    return { finish };
  }

  snapshot() {
    const percentiles = (arr) => {
      if (!arr || arr.length === 0) return {};
      const s = [...arr].sort((a,b) => a-b);
      const pick = (p) => s[Math.floor(p * (s.length - 1))];
      return { p50: pick(0.50), p90: pick(0.90), p95: pick(0.95), p99: pick(0.99) };
    };
    const timings = {};
    for (const [k, arr] of this.timings.entries()) timings[k] = percentiles(arr);
    const counters = {};
    for (const [k, v] of this.counters.entries()) counters[k] = v;
    return { counters, timings };
  }
}

export const metrics = new MetricsService();


import { RateLimiter } from '../src/utils/rateLimiter.js';

describe('RateLimiter', () => {
  test('enforces quota windows across queued tasks', async () => {
    const limiter = new RateLimiter({
      perMinute: 2,
      perHour: Infinity,
      perDay: Infinity,
      windowMs: { minute: 50, hour: 1000, day: 1000 }
    });

    const timestamps = [];
    const tasks = [0, 1, 2].map(() => limiter.schedule(async () => {
      const now = Date.now();
      timestamps.push(now);
      return now;
    }));

    await Promise.all(tasks);

    expect(timestamps).toHaveLength(3);
    const gap = timestamps[2] - timestamps[0];
    expect(gap).toBeGreaterThanOrEqual(50);
  });

  test('executes immediately when under limits', async () => {
    const limiter = new RateLimiter({
      perMinute: 10,
      perHour: 100,
      perDay: 1000,
      windowMs: { minute: 20, hour: 1000, day: 1000 }
    });

    let counter = 0;
    await Promise.all(Array.from({ length: 3 }, () => limiter.schedule(async () => {
      counter += 1;
      return counter;
    })));

    expect(counter).toBe(3);
  });
});

/**
 * Simple time-window based rate limiter used to guard MCP calls.
 * The implementation intentionally serializes work to make it easier to
 * guarantee quota compliance while still supporting asynchronous tasks.
 */
export class RateLimiter {
  constructor(options = {}) {
    const defaults = {
      perMinute: Infinity,
      perHour: Infinity,
      perDay: Infinity,
      maxConcurrent: 1,
      windowMs: {
        minute: 60 * 1000,
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000
      }
    };

    this.perMinute = options.perMinute ?? defaults.perMinute;
    this.perHour = options.perHour ?? defaults.perHour;
    this.perDay = options.perDay ?? defaults.perDay;
    this.maxConcurrent = Math.max(1, options.maxConcurrent ?? defaults.maxConcurrent);
    const windowMs = options.windowMs || {};
    this.windowMs = {
      minute: windowMs.minute ?? defaults.windowMs.minute,
      hour: windowMs.hour ?? defaults.windowMs.hour,
      day: windowMs.day ?? defaults.windowMs.day
    };

    this.minuteEvents = [];
    this.hourEvents = [];
    this.dayEvents = [];
    this.currentlyRunning = 0;
    this.queue = Promise.resolve();
  }

  async schedule(task, meta = {}) {
    const runTask = async () => {
      await this.#waitForSlot(meta);
      try {
        return await task();
      } finally {
        this.currentlyRunning = Math.max(0, this.currentlyRunning - 1);
      }
    };

    this.queue = this.queue.then(runTask, runTask);
    return this.queue;
  }

  #cleanup(now) {
    const prune = (events, window) => {
      while (events.length && now - events[0] >= window) {
        events.shift();
      }
    };
    prune(this.minuteEvents, this.windowMs.minute);
    prune(this.hourEvents, this.windowMs.hour);
    prune(this.dayEvents, this.windowMs.day);
  }

  #withinLimits() {
    const minuteOk = this.perMinute === Infinity || this.minuteEvents.length < this.perMinute;
    const hourOk = this.perHour === Infinity || this.hourEvents.length < this.perHour;
    const dayOk = this.perDay === Infinity || this.dayEvents.length < this.perDay;
    const concurrencyOk = this.currentlyRunning < this.maxConcurrent;
    return minuteOk && hourOk && dayOk && concurrencyOk;
  }

  #record(now) {
    this.minuteEvents.push(now);
    this.hourEvents.push(now);
    this.dayEvents.push(now);
    this.currentlyRunning += 1;
  }

  #nextWait(now) {
    const waits = [];

    if (this.perMinute !== Infinity && this.minuteEvents.length >= this.perMinute) {
      const window = this.windowMs.minute - (now - this.minuteEvents[0]);
      waits.push(window);
    }

    if (this.perHour !== Infinity && this.hourEvents.length >= this.perHour) {
      const window = this.windowMs.hour - (now - this.hourEvents[0]);
      waits.push(window);
    }

    if (this.perDay !== Infinity && this.dayEvents.length >= this.perDay) {
      const window = this.windowMs.day - (now - this.dayEvents[0]);
      waits.push(window);
    }

    if (this.currentlyRunning >= this.maxConcurrent) {
      // Enforce a minimal wait to avoid hot-looping when concurrency is exhausted.
      waits.push(10);
    }

    return waits.length ? Math.max(5, Math.min(...waits)) : 0;
  }

  async #waitForSlot(meta) {
    const timeoutSafetyMs = 5 * 60 * 1000; // 5 minutes safety guard
    const start = Date.now();

    while (true) {
      const now = Date.now();
      this.#cleanup(now);

      if (this.#withinLimits()) {
        this.#record(now);
        return;
      }

      const wait = this.#nextWait(now);
      if (Date.now() - start > timeoutSafetyMs) {
        const context = meta?.context || 'rate-limit';
        throw new Error(`RateLimiter timeout while waiting for slot (${context})`);
      }
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}


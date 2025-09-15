class StatusService {
  constructor() {
    this.events = new Map(); // type -> array
    this.max = 100;
  }
  record(type, payload) {
    const arr = this.events.get(type) || [];
    arr.push({ ts: new Date().toISOString(), ...payload });
    if (arr.length > this.max) arr.shift();
    this.events.set(type, arr);
  }
  getRecent(type, limit = 20) {
    const arr = this.events.get(type) || [];
    return arr.slice(-limit);
  }
  getAll(limit = 20) {
    const out = {};
    for (const [k, v] of this.events.entries()) out[k] = v.slice(-limit);
    return out;
  }
}

export const statusService = new StatusService();


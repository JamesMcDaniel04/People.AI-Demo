import axios from 'axios';

export class NewsProvider {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.mockMode = false;
  }

  async initialize() {
    const enabled = this.config.external?.enabled === true || process.env.EXTERNAL_API_ENABLED === 'true';
    const baseURL = this.config.external?.baseURL;
    const apiKey = this.config.external?.apiKey || process.env.EXTERNAL_API_KEY;

    if (enabled && baseURL && apiKey) {
      // Support NewsAPI.org (X-Api-Key) and generic Bearer auth
      const useNewsApi = /newsapi\.org/.test(baseURL);
      const headers = useNewsApi
        ? { 'X-Api-Key': apiKey }
        : { 'Authorization': `Bearer ${apiKey}` };
      this.client = axios.create({ baseURL, timeout: 15000, headers });
      this.useNewsApi = useNewsApi;
    } else {
      this.mockMode = true;
    }
  }

  async getNews(accountName) {
    const simulate429 = process.env.SIMULATE_429_EXTERNAL === 'true';
    if (!this.client || this.mockMode) {
      // Return mock news items for demonstration
      const today = new Date().toISOString().split('T')[0];
      return [
        {
          title: `${accountName} announces regional expansion and new product partnerships`,
          date: today,
          sentiment: 'positive',
          source: 'mock-newswire',
          url: '#',
          summary: `Market signal suggests increased payment volume potential relevant to upsell/cross-sell.`
        },
        {
          title: `${accountName} quarterly update hints at budget realignment`,
          date: today,
          sentiment: 'neutral',
          source: 'mock-analyst',
          url: '#',
          summary: `May affect timeline for expansion; monitor procurement cadence and priorities.`
        }
      ];
    }

    const attempt = async (tries = 0) => {
      if (simulate429 && tries < 1) {
        const err = new Error('Simulated 429');
        err.response = { status: 429 };
        throw err;
      }
      // Support NewsAPI.org by default, or generic /news?q=
      const endpoint = this.config.external?.endpoints?.news || (this.useNewsApi ? '/everything' : '/news');
      const params = this.useNewsApi
        ? { q: accountName, sortBy: 'publishedAt', language: 'en', pageSize: 5 }
        : { q: accountName };
      const resp = await this.client.get(endpoint, { params });
      const items = resp.data?.articles || resp.data?.items || [];
      return items.map(n => ({
        title: n.title || n.headline,
        date: n.publishedAt || n.date || new Date().toISOString(),
        sentiment: n.sentiment || 'neutral',
        source: n.source?.name || n.source || 'news',
        url: n.url || n.link || '#',
        summary: n.description || n.summary || ''
      }));
    };

    let tries = 0;
    const maxTries = 4;
    const baseDelay = 1000;
    while (tries < maxTries) {
      try {
        return await attempt(tries);
      } catch (err) {
        const status = err?.response?.status || 0;
        if ([401, 429, 500, 502, 503].includes(status)) {
          const delay = Math.min(120000, baseDelay * Math.pow(2, tries));
          await new Promise(r => setTimeout(r, delay));
          tries++;
          continue;
        }
        console.warn('News API failed, falling back to mock:', err.message);
        this.mockMode = true;
        return this.getNews(accountName);
      }
    }
    console.warn('News API exhausted retries, using mock data');
    this.mockMode = true;
    return this.getNews(accountName);
  }

  getStatus() {
    return {
      enabled: !this.mockMode,
      mockMode: !!this.mockMode,
      baseURL: this.config.external?.baseURL || null
    };
  }
}

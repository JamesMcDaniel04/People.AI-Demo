import Ajv from 'ajv';

const DEFAULT_QUALITY_THRESHOLD = 0.75;

const accountSchema = {
  type: 'object',
  properties: {
    accountName: { type: 'string', minLength: 1 },
    status: { type: 'string' },
    healthScore: {
      oneOf: [
        { type: 'number', minimum: 0, maximum: 1 },
        {
          type: 'object',
          properties: {
            score: { type: 'number', minimum: 0, maximum: 1 }
          },
          required: ['score'],
          additionalProperties: true
        }
      ]
    },
    lastActivity: { type: 'string' },
    totalInteractions: { type: 'number', minimum: 0 },
    stage: { type: 'string' },
    revenue: {
      type: 'object',
      properties: {
        current: { type: ['number', 'null'] },
        potential: { type: ['number', 'null'] }
      },
      additionalProperties: true
    }
  },
  required: ['accountName'],
  additionalProperties: true
};

const stakeholderSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string' },
    role: { type: 'string' },
    department: { type: 'string' },
    influence_level: { type: ['string', 'null'] },
    engagement_score: { type: ['number', 'null'] }
  },
  anyOf: [
    { required: ['email'] },
    { required: ['name'] }
  ],
  additionalProperties: true
};

const interactionSchema = {
  type: 'object',
  properties: {
    id: { type: ['string', 'number'], nullable: true },
    type: { type: 'string', minLength: 2 },
    date: { type: 'string' },
    subject: { type: ['string', 'null'] },
    participants: {
      type: 'array',
      items: { type: 'string' }
    },
    duration: { type: ['number', 'string', 'null'] },
    sentiment: { type: ['string', 'null'] },
    topics: {
      type: 'array',
      items: { type: 'string' }
    },
    summary: { type: ['string', 'null'] },
    outcome: { type: ['string', 'null'] }
  },
  required: ['type'],
  additionalProperties: true
};

const emailSchema = {
  type: 'object',
  properties: {
    id: { type: ['string', 'null'] },
    thread_id: { type: ['string', 'null'] },
    subject: { type: 'string', minLength: 1 },
    date: { type: 'string' },
    recipients: {
      type: 'array',
      items: { type: 'string' }
    },
    summary: { type: ['string', 'null'] },
    sentiment: { type: ['string', 'null'] }
  },
  required: ['subject'],
  additionalProperties: true
};

const callSchema = {
  type: 'object',
  properties: {
    callId: { type: ['string', 'null'] },
    id: { type: ['string', 'null'] },
    date: { type: 'string' },
    duration: { type: ['number', 'string', 'null'] },
    participants: {
      type: 'array',
      items: { type: 'string' }
    },
    summary: { type: ['string', 'null'] },
    sentiment: { type: ['string', 'null'] },
    topics: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['date'],
  additionalProperties: true
};

const documentSchema = {
  type: 'object',
  properties: {
    id: { type: ['string', 'null'] },
    title: { type: 'string', minLength: 1 },
    type: { type: ['string', 'null'] },
    author: { type: ['string', 'null'] },
    date: { type: ['string', 'null'] }
  },
  required: ['title'],
  additionalProperties: true
};

const calendarSchema = {
  type: 'object',
  properties: {
    id: { type: ['string', 'null'] },
    title: { type: ['string', 'null'] },
    start: { type: 'string' },
    end: { type: ['string', 'null'] },
    attendees: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['start'],
  additionalProperties: true
};

const crmSchema = {
  type: 'object',
  properties: {
    id: { type: ['string', 'null'] },
    stage: { type: ['string', 'null'] },
    value: { type: ['number', 'null'] },
    closeDate: { type: ['string', 'null'] }
  },
  additionalProperties: true
};

const schemaMap = {
  accountInfo: accountSchema,
  stakeholders: stakeholderSchema,
  interactions: interactionSchema,
  emails: emailSchema,
  calls: callSchema,
  documents: documentSchema,
  calendar: calendarSchema,
  crm: crmSchema
};

export class DataValidationService {
  constructor(config = {}) {
    this.config = config;
    this.qualityThreshold = Number(config?.data?.pipeline?.qualityThreshold || DEFAULT_QUALITY_THRESHOLD);
    this.ajv = new Ajv({
      allErrors: true,
      coerceTypes: true,
      removeAdditional: 'failing',
      useDefaults: true,
      strict: false
    });

    this.validators = {};
    for (const [domain, schema] of Object.entries(schemaMap)) {
      this.validators[domain] = this.ajv.compile(schema);
    }
  }

  validateDomain(domain, records = []) {
    const validator = this.validators[domain];
    if (!validator) {
      return {
        domain,
        valid: records.slice(),
        invalid: [],
        qualityScore: records.length === 0 ? 1 : 1,
        thresholdBreached: false
      };
    }

    const valid = [];
    const invalid = [];

    for (const entry of records) {
      const recordCopy = entry.record ? { ...entry.record } : { ...entry };
      const ok = validator(recordCopy);
      if (ok) {
        const normalized = entry.record ? { ...entry, record: recordCopy } : recordCopy;
        valid.push(normalized);
      } else {
        invalid.push({
          ...(entry.record ? entry : { ...entry, record: recordCopy }),
          errors: this.formatErrors(validator.errors || [])
        });
      }
    }

    const total = records.length || 0;
    const score = total === 0 ? 1 : Number((valid.length / total).toFixed(3));
    const thresholdBreached = score < this.qualityThreshold;

    return {
      domain,
      valid,
      invalid,
      qualityScore: score,
      thresholdBreached
    };
  }

  summarizeResults(resultsByDomain) {
    const summary = {};
    for (const [domain, result] of Object.entries(resultsByDomain)) {
      summary[domain] = {
        total: (result.valid.length + result.invalid.length),
        valid: result.valid.length,
        invalid: result.invalid.length,
        qualityScore: result.qualityScore,
        thresholdBreached: result.thresholdBreached
      };
    }
    return summary;
  }

  formatErrors(errors) {
    return errors.map(err => ({
      message: err.message,
      path: err.instancePath || err.schemaPath,
      keyword: err.keyword
    }));
  }
}

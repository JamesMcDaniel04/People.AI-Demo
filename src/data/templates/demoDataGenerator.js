import { TemplateManager } from './templateManager.js';
import { DatasetAnonymizer } from './anonymizer.js';

const safeFirstNames = ['Avery', 'Jordan', 'Riley', 'Hayden', 'Rowan', 'Emerson', 'Quinn', 'Sydney', 'Sloane', 'Peyton', 'Reese', 'Lex'];
const safeLastNames = ['Hayes', 'Brooks', 'Mercer', 'Rowe', 'Adler', 'Jensen', 'Lowell', 'Sutton', 'Harlow', 'Kerr', 'Alden', 'Parker'];
const stages = ['Discovery', 'Evaluation', 'Solution Alignment', 'Commercial Review', 'Security Review', 'Pilot', 'Negotiation'];
const influenceLevels = ['Executive Sponsor', 'Economic Buyer', 'Influencer', 'Champion', 'Evaluator'];
const engagementLevels = [0.62, 0.68, 0.71, 0.76, 0.8, 0.85];

const densityMap = {
  high: 16,
  'medium-high': 12,
  medium: 9,
  low: 6
};

const createSeededRandom = (seed) => {
  let h = 0;
  const seedStr = String(seed || 'seed');
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
};

const pick = (rand, list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
const randBetween = (rand, min, max) => min + rand() * (max - min);
const randIntBetween = (rand, min, max) => Math.floor(randBetween(rand, min, max + 1));

const slugify = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'account';

const clone = (value) => JSON.parse(JSON.stringify(value));

const buildTimeline = (rand, count, months) => {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - months);
  const rangeMs = now.getTime() - start.getTime();
  const dates = [];
  for (let i = 0; i < count; i++) {
    const jitter = rand();
    const offset = ((i + jitter) / (count + 1)) * rangeMs;
    dates.push(new Date(start.getTime() + offset));
  }
  return dates.sort((a, b) => a - b);
};

const formatISO = (date, rand) => {
  const d = new Date(date.getTime());
  d.setHours(Math.min(20, 8 + Math.floor(rand() * 9)));
  d.setMinutes(Math.floor(rand() * 60));
  d.setSeconds(Math.floor(rand() * 60));
  return d.toISOString();
};

const buildName = (rand) => `${pick(rand, safeFirstNames)} ${pick(rand, safeLastNames)}`;

const buildEmail = (name, domain) => {
  const local = String(name || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.');
  return `${local}@${domain}`;
};

const densityFor = (datasetConfig) => densityMap[datasetConfig?.interactionDensity] || 10;

const createStakeholders = (rand, seed, accountDomain, context) => {
  const stakeholders = [];
  const personaTemplates = seed.personas?.customerStakeholders || [];
  personaTemplates.forEach((persona, index) => {
    const name = buildName(rand);
    stakeholders.push({
      id: `stakeholder-${index + 1}`,
      name,
      role: persona.archetype,
      department: persona.archetype?.includes('Finance') ? 'Finance' : persona.archetype?.includes('Technology') ? 'Technology' : 'Business',
      persona_type: persona.archetype,
      influence_level: pick(rand, influenceLevels),
      engagement_score: pick(rand, engagementLevels),
      priorities: persona.priorities || [],
      objections: persona.objections || [],
      email: buildEmail(name, accountDomain),
      industry: context.industry,
      region: context.region,
      anonymized: true
    });
  });
  return stakeholders;
};

const createInternalTeam = (rand, seed) => {
  const members = [];
  const templates = seed.personas?.internalTeam || [];
  templates.forEach((persona, index) => {
    const name = buildName(rand);
    members.push({
      id: `internal-${index + 1}`,
      name,
      role: persona.role,
      focus: persona.focus,
      email: buildEmail(name, 'stripe.demo'),
      anonymized: true
    });
  });
  return members;
};

const createEmailThreads = (rand, seed, stakeholders, internalTeam, datasetConfig, context, accountDomain, timeline) => {
  const base = densityFor(datasetConfig);
  const mixFactor = context.communicationMix?.email ?? 0.32;
  const threadCount = Math.max(6, Math.round(base * mixFactor));
  const themes = seed.opportunityThemes || [];
  const risks = seed.riskSignals || [];
  const playbooks = seed.engagementPlaybooks || [];
  const emails = [];
  for (let i = 0; i < threadCount; i++) {
    const theme = pick(rand, themes.length > 0 ? themes : [{ name: 'Joint Planning', value: 'Align on success metrics' }]);
    const risk = pick(rand, risks.length > 0 ? risks : [{ label: 'Timeline drift', mitigation: 'Align weekly checkpoints.' }]);
    const playbook = pick(rand, playbooks.length > 0 ? playbooks : [{ channel: 'email', persona: 'C-Level', cadence: 'Bi-weekly' }]);
    const sender = pick(rand, internalTeam);
    const recipient = pick(rand, stakeholders);
    const subject = `${theme.name}: ${playbook.objective || 'Next steps'}`;
    const startDate = timeline[Math.min(i, timeline.length - 1)] || timeline[timeline.length - 1];
    const messageCount = 3 + randIntBetween(rand, 0, 2);
    const messages = [];
    for (let j = 0; j < messageCount; j++) {
      const from = j % 2 === 0 ? sender.email : recipient.email;
      const to = j % 2 === 0 ? [recipient.email] : [sender.email];
      const body = j === 0
        ? `Thanks for collaborating on ${theme.name}. ${theme.value} remains the key outcome.`
        : j === messageCount - 1
          ? `Summarizing actions: ${risk.mitigation} and tracking ${playbook.cadence?.toLowerCase() || 'the agreed cadence'}.`
          : `Sharing context on ${theme.name} with focus on ${risk.label.toLowerCase()}.`;
      messages.push({
        message_id: `msg-${i + 1}-${j + 1}`,
        from,
        to,
        subject,
        timestamp: formatISO(startDate, rand),
        body
      });
    }
    emails.push({
      thread_id: `thread-${i + 1}`,
      topic: theme.name,
      summary: `${sender.name} and ${recipient.name} align on ${theme.value.toLowerCase()}.`,
      cadence: playbook.cadence,
      sentiment: rand() > 0.2 ? 'Positive' : 'Neutral',
      action_items: [`Schedule follow-up on ${theme.name}`, `Review ${risk.label} mitigation`],
      messages
    });
  }
  return emails;
};

const createCalls = (rand, seed, stakeholders, internalTeam, datasetConfig, timeline) => {
  const base = densityFor(datasetConfig);
  const mixFactor = seed.context?.communicationMix?.calls ?? 0.2;
  const callCount = Math.max(3, Math.round(base * mixFactor * 0.6));
  const playbooks = seed.engagementPlaybooks || [];
  const calls = [];
  for (let i = 0; i < callCount; i++) {
    const playbook = pick(rand, playbooks.length > 0 ? playbooks : [{ persona: 'Executive', objective: 'Align on priorities', channel: 'call' }]);
    const internal = pick(rand, internalTeam);
    const external = pick(rand, stakeholders);
    const date = timeline[Math.min(i, timeline.length - 1)] || timeline[timeline.length - 1];
    const turns = [];
    const turnCount = 4 + randIntBetween(rand, 0, 3);
    for (let t = 0; t < turnCount; t++) {
      const speaker = t % 2 === 0 ? internal.name : external.name;
      const text = t % 2 === 0
        ? `We are targeting ${playbook.objective?.toLowerCase() || 'the defined outcomes'} with next steps on ${playbook.cadence?.toLowerCase() || 'agreed cadence'}.`
        : `We need confidence around ${playbook.persona?.toLowerCase() || 'our internal stakeholders'} and roadmap alignment.`;
      turns.push({ speaker, text });
    }
    calls.push({
      call_id: `call-${i + 1}`,
      type: `${playbook.persona || 'Stakeholder'} Sync`,
      date: formatISO(date, rand),
      duration: `${30 + randIntBetween(rand, 0, 25)} minutes`,
      participants: [internal.name, external.name],
      transcript: turns,
      actionItems: [
        { id: `call-${i + 1}-action-1`, owner: internal.name, action: `Send recap on ${playbook.objective || 'meeting focus'}.`, due: formatISO(new Date(date.getTime() + 3 * 86400000), rand) },
        { id: `call-${i + 1}-action-2`, owner: external.name, action: 'Share internal approvals status.', due: formatISO(new Date(date.getTime() + 5 * 86400000), rand) }
      ]
    });
  }
  return calls;
};

const createDocuments = (rand, seed, internalTeam, accountName) => {
  const assets = seed.recommendedAssets || [];
  const documents = [];
  assets.forEach((asset, index) => {
    const author = pick(rand, internalTeam);
    documents.push({
      id: `doc-${index + 1}`,
      title: asset.title,
      type: asset.type,
      author: author.name,
      date: new Date(Date.now() - randIntBetween(rand, 2, 30) * 86400000).toISOString(),
      summary: `${asset.usage || 'Enablement asset'} tailored for ${accountName}.`,
      tags: [seed.metadata.industry, 'Strategy', asset.type].filter(Boolean)
    });
  });
  if (documents.length < 3) {
    const missing = 3 - documents.length;
    for (let i = 0; i < missing; i++) {
      const author = pick(rand, internalTeam);
      documents.push({
        id: `doc-extra-${i + 1}`,
        title: `Joint Plan - ${accountName} ${i + 1}`,
        type: 'Brief',
        author: author.name,
        date: new Date(Date.now() - randIntBetween(rand, 5, 45) * 86400000).toISOString(),
        summary: 'Shared alignment on milestones, roles, and success metrics.',
        tags: [seed.metadata.industry, 'Joint Plan']
      });
    }
  }
  return documents;
};

const createCalendarEvents = (rand, seed, internalTeam, stakeholders, timeline) => {
  const playbooks = seed.engagementPlaybooks || [];
  const events = [];
  playbooks.forEach((playbook, index) => {
    const internal = pick(rand, internalTeam);
    const external = pick(rand, stakeholders);
    const date = timeline[Math.min(index, timeline.length - 1)] || timeline[timeline.length - 1];
    const title = `${playbook.persona || 'Stakeholder'} ${playbook.channel === 'calendar' ? 'Workshop' : 'Check-in'}`;
    events.push({
      id: `cal-${index + 1}`,
      title,
      start: formatISO(date, rand),
      end: formatISO(new Date(date.getTime() + 60 * 60000), rand),
      attendees: [internal.email, external.email],
      objective: playbook.objective,
      notes: `${playbook.persona} focus with cadence ${playbook.cadence || 'bi-weekly'}.`
    });
  });
  if (events.length === 0) {
    const internal = pick(rand, internalTeam);
    const external = pick(rand, stakeholders);
    const date = timeline[Math.floor(timeline.length / 2)] || new Date();
    events.push({
      id: 'cal-1',
      title: 'Steering Committee Review',
      start: formatISO(date, rand),
      end: formatISO(new Date(date.getTime() + 60 * 60000), rand),
      attendees: [internal.email, external.email],
      objective: 'Review progress and unblock decisions.',
      notes: 'Cadence: monthly steering committee.'
    });
  }
  return events;
};

const createCrmRecords = (rand, seed, stakeholders, datasetConfig, accountName, context) => {
  const amount = Math.round(randBetween(rand, 1.8, 4.5) * 1_000_000);
  const stage = context.pipelineStage || pick(rand, stages);
  const owner = stakeholders.length > 0 ? stakeholders[0].name : 'Owner';
  return [
    {
      id: `opp-${slugify(accountName)}`,
      accountName,
      stage,
      amount,
      currency: 'USD',
      probability: Math.round(randBetween(rand, 0.55, 0.85) * 100) / 100,
      closeDate: new Date(Date.now() + randIntBetween(rand, 15, 80) * 86400000).toISOString(),
      nextStep: 'Finalize commercial terms and confirm implementation plan.',
      owner,
      stakeholders: stakeholders.slice(0, 3).map(s => s.name),
      forecastCategory: 'Best Case',
      scoring: {
        trustBaseline: seed.metadata.trustBaseline,
        target: datasetConfig?.trustTarget || 0.85
      }
    }
  ];
};

const summarizeAccount = (seed, stakeholders, emails, calls, crmRecords) => {
  const totalInteractions = emails.length + calls.length;
  const healthScore = Math.min(0.98, Math.max(0.55, (seed.metadata.trustBaseline + (totalInteractions * 0.007))));
  const lastActivityDates = [];
  emails.forEach(thread => {
    const lastMessage = thread.messages?.[thread.messages.length - 1];
    if (lastMessage?.timestamp) lastActivityDates.push(new Date(lastMessage.timestamp));
  });
  calls.forEach(call => {
    if (call.date) lastActivityDates.push(new Date(call.date));
  });
  const lastActivity = lastActivityDates.sort((a, b) => b - a)[0] || new Date();
  return {
    accountName: seed.context.accountName,
    industry: seed.metadata.industry,
    region: seed.context.region,
    status: 'Active Program',
    healthScore: { score: Number(healthScore.toFixed(2)), trend: 'improving' },
    lastActivity: lastActivity.toISOString(),
    totalInteractions,
    stage: seed.context.pipelineStage,
    revenue: {
      current: crmRecords[0]?.amount ? Number((crmRecords[0].amount * 0.35).toFixed(0)) : null,
      potential: crmRecords[0]?.amount || null
    },
    opportunityThemes: seed.opportunityThemes.map(theme => ({ id: theme.id, name: theme.name, priority: theme.priority })),
    riskSignals: seed.riskSignals.map(risk => ({ id: risk.id, label: risk.label, mitigation: risk.mitigation })),
    internalTeamSize: seed.personas?.internalTeam?.length || 0
  };
};

const buildInteractionHistory = (emails, calls) => {
  const interactions = [];
  emails.forEach(thread => {
    const lastMessage = thread.messages?.[thread.messages.length - 1];
    if (lastMessage) {
      interactions.push({
        type: 'email',
        date: lastMessage.timestamp,
        subject: lastMessage.subject || thread.topic,
        participants: [lastMessage.from, ...(Array.isArray(lastMessage.to) ? lastMessage.to : [lastMessage.to])],
        sentiment: thread.sentiment,
        summary: thread.summary,
        threadId: thread.thread_id
      });
    }
  });
  calls.forEach(call => {
    interactions.push({
      type: 'call',
      date: call.date,
      subject: call.type,
      participants: call.participants,
      duration: call.duration,
      summary: call.transcript?.[0]?.text || 'Strategic sync',
      callId: call.call_id
    });
  });
  return interactions.sort((a, b) => new Date(b.date) - new Date(a.date));
};

export class DemoDataGenerator {
  constructor(options = {}) {
    this.templateManager = options.templateManager || new TemplateManager({
      defaultProfileId: options.defaultProfileId
    });
    this.anonymizeByDefault = options.anonymize ?? options.anonymizeByDefault ?? true;
    this.anonymizer = options.anonymizer || new DatasetAnonymizer({
      maskNames: options.maskNames ?? false,
      maskEmails: options.maskEmails ?? true
    });
  }

  generateAccount(accountName, options = {}) {
    const seed = this.templateManager.buildSeed(accountName, {
      profileId: options.profileId,
      industry: options.industry,
      overrides: options.overrides
    });

    const rand = createSeededRandom(`${accountName}:${seed.profile.id}`);
    const accountSlug = slugify(accountName);
    const accountDomain = `${accountSlug}.demo`; // Always synthetic domain
    const stakeholders = createStakeholders(rand, seed, accountDomain, seed.context);
    const internalTeam = createInternalTeam(rand, seed);
    const timeline = buildTimeline(rand, densityFor(seed.datasetConfig) + 4, seed.datasetConfig?.timelineMonths || 6);
    const emails = createEmailThreads(rand, seed, stakeholders, internalTeam, seed.datasetConfig, seed.context, accountDomain, timeline);
    const calls = createCalls(rand, seed, stakeholders, internalTeam, seed.datasetConfig, timeline);
    const documents = createDocuments(rand, seed, internalTeam, accountName);
    const calendar = createCalendarEvents(rand, seed, internalTeam, stakeholders, timeline);
    const crm = createCrmRecords(rand, seed, stakeholders, seed.datasetConfig, accountName, seed.context);
    const interactions = buildInteractionHistory(emails, calls);
    const accountInfo = summarizeAccount(seed, stakeholders, emails, calls, crm);

    const dataset = {
      accountInfo,
      stakeholders,
      internalTeam,
      interactions,
      emails,
      calls,
      documents,
      calendar,
      crm,
      profile: seed.profile,
      datasetConfig: seed.datasetConfig,
      metadata: {
        template: seed.metadata,
        generatedAt: new Date().toISOString(),
        anonymized: this.anonymizeByDefault || !!options.anonymize,
        accountSlug,
        trustBaseline: seed.metadata.trustBaseline
      }
    };

    const shouldAnonymize = options.anonymize !== undefined ? options.anonymize : this.anonymizeByDefault;
    if (shouldAnonymize) {
      return this.anonymizer.apply(dataset, { accountName, accountSlug });
    }
    return dataset;
  }

  listTemplates() {
    return this.templateManager.listTemplates();
  }

  listProfiles() {
    return this.templateManager.listProfiles();
  }
}

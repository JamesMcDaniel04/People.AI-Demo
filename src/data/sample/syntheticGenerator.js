// Lightweight synthetic data generator for demo/assessment mode
// Produces realistic-but-fake emails, calls, and personas for any account name

function seededRand(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length) % arr.length];
}

function toDomain(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export class SyntheticGenerator {
  constructor() {}

  generateAll(accountName) {
    const personas = this.generatePersonas(accountName);
    const emails = this.generateEmails(accountName, personas);
    const calls = this.generateCalls(accountName, personas);
    return { personas, emails, calls };
  }

  generatePersonas(accountName) {
    const domain = toDomain(accountName) + ".com";
    // Stripe team (AE, SE, CSM)
    const stripeTeam = [
      { id: 'stripe_ae_alex_chen', name: 'Alex Chen', role: 'Account Executive, Stripe', email: 'alex.chen@stripe.com', style: 'ROI-focused' },
      { id: 'stripe_se_john_miller', name: 'John Miller', role: 'Solutions Engineer, Stripe', email: 'john.miller@stripe.com', style: 'Technical, detailed' },
      { id: 'stripe_csm_maria_garcia', name: 'Maria Garcia', role: 'Customer Success Manager, Stripe', email: 'maria.garcia@stripe.com', style: 'Relationship-oriented' }
    ];

    // Customer stakeholders (4-5)
    const customers = [
      { id: 'cust_cfo_sarah_wilson', name: 'Sarah Wilson', role: 'CFO', persona_type: 'Economic Buyer' },
      { id: 'cust_cto_lisa_park', name: 'Lisa Park', role: 'CTO', persona_type: 'Technical Champion' },
      { id: 'cust_vpproc_emma_brown', name: 'Emma Brown', role: 'VP Procurement', persona_type: 'Economic Buyer / Procurement Gatekeeper' },
      { id: 'cust_cto_nina_rivers', name: 'Nina Rivers', role: 'CTO', persona_type: 'Technical Champion' },
      { id: 'cust_finops_daniel_perez', name: 'Daniel Perez', role: 'Finance Ops Manager', persona_type: 'End User' }
    ].map(c => ({
      ...c,
      company: accountName,
      email: `${c.name.toLowerCase().replace(/\s+/g, '.')}@${domain}`
    }));

    return { stripe_team: stripeTeam, customer_stakeholders: customers };
  }

  generateEmails(accountName, personas) {
    const seedBase = process.env.SEED ? `${process.env.SEED}:${accountName}` : accountName;
    const rand = seededRand(seedBase);
    const domain = toDomain(accountName) + ".com";
    const stripe = personas?.stripe_team || [];
    const cust = personas?.customer_stakeholders || [];

    const subjects = [
      `Initial Outreach – ${accountName} global payments` ,
      `Discovery call follow-up and materials`,
      `Pricing discussion and proposed tiers`,
      `Implementation planning and sandbox setup`,
      `Executive briefing – strategic alignment`,
      `European market entry – local methods`,
      `QBR prep – success metrics`,
    ];

    const bodySnips = [
      `We can consolidate providers and simplify reconciliation across regions.`,
      `Idempotency keys and webhook retry guidance attached.`,
      `Here’s the ROI model and migration plan for ${accountName}.`,
      `We recommend a pilot focusing on EU auth-rate improvements.`,
      `Proposed next steps and owners attached for review.`,
    ];

    const threads = [];
    const threadCount = 10 + Math.floor(rand() * 6); // 10-15

    for (let i = 0; i < threadCount; i++) {
      const fromP = pick(rand, stripe);
      const toP = pick(rand, cust);
      const from = fromP.email;
      const to = toP.email;
      const subject = subjects[i % subjects.length];
      const msgCount = 3 + Math.floor(rand() * 4); // ensure >=3 messages
      const messages = [];
      const start = new Date(Date.now() - (20 + i) * 24 * 60 * 60 * 1000);
      for (let m = 0; m < msgCount; m++) {
        messages.push({
          from: m % 2 === 0 ? from : to,
          to: m % 2 === 0 ? to : from,
          timestamp: new Date(start.getTime() + m * 3 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' '),
          subject,
          body: pick(rand, bodySnips)
        });
      }
      threads.push({
        thread_id: `SYN-${accountName}-${i+1}`,
        topic: subject,
        messages,
        account: accountName,
        personas: [fromP.id, toP.id]
      });
    }
    return threads;
  }

  generateCalls(accountName, personas) {
    const seedBase = process.env.SEED ? `${process.env.SEED}:${accountName}:calls` : (accountName + '-calls');
    const rand = seededRand(seedBase);
    const cust = personas?.customer_stakeholders || [];
    const stripe = personas?.stripe_team || [];
    const scenarios = [
      { type: 'Discovery Call', speakers: ['AE', 'CTO'] },
      { type: 'Technical Deep Dive', speakers: ['SE', 'CTO'] },
      { type: 'Executive Briefing', speakers: ['AE', 'CFO', 'CSM'] },
      { type: 'QBR', speakers: ['CSM', 'CFO'] },
      { type: 'Pricing Negotiation', speakers: ['AE', 'Procurement'] },
    ];
    const talk = [
      'We aim to unify payment providers and reduce operational overhead.',
      'Auth rate and checkout conversion are our top KPIs.',
      'Idempotency and webhook reliability are critical to us.',
      'We need clarity on cross-border pricing and terms.',
      'We will track blended rate and dispute rate monthly.',
    ];
    const actions = [
      'Share EU rollout plan and KPI targets',
      'Schedule technical review on webhooks and retries',
      'Send updated pricing tiers with cross-border rates',
      'Draft migration checklist and owners',
      'Prepare executive summary for QBR dashboard'
    ];

    const toName = r => r.name.split(' ')[0];
    const mapRole = r => r.role.includes('AE') ? 'AE' : r.role.includes('Solutions Engineer') ? 'SE' : r.role.includes('Customer Success') ? 'CSM' : r.role.includes('CFO') ? 'CFO' : r.role.includes('CTO') ? 'CTO' : 'Stakeholder';

    const calls = [];
    const count = 3 + Math.floor(rand() * 3); // 3-5
    for (let i = 0; i < count; i++) {
      const scenario = scenarios[i % scenarios.length];
      const participants = [];
      // Add Stripe AE/SE/CSM and a couple customer stakeholders
      participants.push(`${toName(stripe[0])} - AE (Stripe)`);
      participants.push(`${toName(stripe[1])} - SE (Stripe)`);
      participants.push(`${toName(stripe[2])} - CSM (Stripe)`);
      const c1 = pick(rand, cust); const c2 = pick(rand, cust);
      participants.push(`${c1.name} - ${c1.role} (${accountName})`);
      participants.push(`${c2.name} - ${c2.role} (${accountName})`);

      const transcript = [];
      const turns = 3 + Math.floor(rand() * 3);
      for (let t = 0; t < turns; t++) {
        const speaker = pick(rand, [
          `${toName(stripe[0])} (AE)`,
          `${toName(stripe[1])} (SE)`,
          `${toName(stripe[2])} (CSM)`,
          `${c1.name.split(' ')[0]} (${mapRole(c1)})`,
          `${c2.name.split(' ')[0]} (${mapRole(c2)})`,
        ]);
        transcript.push({ speaker, text: pick(rand, talk) });
      }

      const date = new Date(Date.now() - (10 + i) * 24 * 60 * 60 * 1000);
      calls.push({
        call_id: `SYN-CALL-${i+1}`,
        type: scenario.type,
        date: `${date.toISOString().slice(0, 16).replace('T', ' ')}`,
        participants,
        duration: `${30 + Math.floor(rand() * 31)} minutes`,
        transcript,
        actionItems: [
          { id: `AI-${i+1}-1`, owner: participants[0], action: pick(rand, actions), due: new Date(date.getTime() + 5*24*60*60*1000).toISOString().slice(0,10) },
          { id: `AI-${i+1}-2`, owner: participants[3], action: pick(rand, actions), due: new Date(date.getTime() + 10*24*60*60*1000).toISOString().slice(0,10) }
        ]
      });
    }
    return calls;
  }
}

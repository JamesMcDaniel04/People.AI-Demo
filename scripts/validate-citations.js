#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const planPath = process.argv[2] || path.join(process.cwd(), 'data', 'golden', 'plan.json');
const account = process.argv[3] || 'stripe';

if (!fs.existsSync(planPath)) {
  console.error('Plan not found:', planPath);
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

function loadDataset(accountName) {
  const sampleDir = path.join(process.cwd(), 'src', 'data', 'sample');
  const emails = JSON.parse(fs.readFileSync(path.join(sampleDir, 'emails.json'), 'utf8')).emails || [];
  const calls = JSON.parse(fs.readFileSync(path.join(sampleDir, 'calls.json'), 'utf8')).calls || [];
  const emailIds = new Set(emails.map(e => e.thread_id));
  const callIds = new Set(calls.map(c => c.call_id));
  return { emailIds, callIds };
}

const { emailIds, callIds } = loadDataset(account);

function checkSources(items, where) {
  let ok = true;
  for (const it of items || []) {
    const sources = it.sources || [];
    for (const s of sources) {
      if (s.type === 'email' && !emailIds.has(s.id)) { console.error(`Unknown email id in ${where}:`, s.id); ok = false; }
      if (s.type === 'call' && !callIds.has(s.id)) { console.error(`Unknown call id in ${where}:`, s.id); ok = false; }
    }
  }
  return ok;
}

let ok = true;
ok = checkSources(plan?.dataInsights?.keyInsights, 'dataInsights') && ok;
ok = checkSources(plan?.opportunityAnalysis?.identifiedOpportunities, 'opportunityAnalysis') && ok;
ok = checkSources(plan?.riskAssessment?.identifiedRisks, 'riskAssessment') && ok;

if (!ok) {
  console.error('❌ Citation validation failed');
  process.exit(1);
}
console.log('✅ Citation validation passed');


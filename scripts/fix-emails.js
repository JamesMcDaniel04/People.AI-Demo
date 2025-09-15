#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src', 'data', 'sample', 'emails.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
let patched = 0;
for (const thread of data.emails || []) {
  if (!Array.isArray(thread.messages)) thread.messages = [];
  while (thread.messages.length < 3) {
    const last = thread.messages[thread.messages.length - 1] || {};
    // Synthesize a simple, realistic follow-up message
    const from = Array.isArray(last.to) ? last.to[0] : (last.to || 'noreply@example.com');
    const to = last.from || 'team@example.com';
    const subject = last.subject || thread.topic || 'Follow-up';
    const prevTs = new Date(last.timestamp || Date.now());
    const ts = new Date(prevTs.getTime() + 60 * 60 * 1000);
    thread.messages.push({
      from,
      to,
      timestamp: ts.toISOString().slice(0, 16).replace('T', ' '),
      subject,
      body: 'Quick follow-up: attaching requested details and next steps.'
    });
    patched++;
  }
}
if (patched > 0) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`Patched ${patched} synthesized messages to satisfy >=3 messages per thread.`);
} else {
  console.log('No patch needed: all threads have >=3 messages.');
}


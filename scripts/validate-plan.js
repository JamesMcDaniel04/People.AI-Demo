#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });
const repo = process.cwd();
const schemaPath = path.join(repo, 'schemas', 'account_plan.schema.json');
const schema = ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));

const planPath = process.argv[2] || path.join(repo, 'data', 'golden', 'plan.json');
if (!fs.existsSync(planPath)) {
  console.error(`Plan file not found: ${planPath}`);
  process.exit(1);
}
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
if (!schema(plan)) {
  console.error('❌ Plan schema validation failed');
  console.error(schema.errors);
  process.exit(1);
}
console.log('✅ Plan schema validation passed');


#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function validate(name, data, schema) {
  const valid = schema(data);
  if (!valid) {
    console.error(`❌ ${name} validation failed`);
    console.error(schema.errors);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${name} validation passed`);
  }
}

const repo = process.cwd();
const schemasDir = path.join(repo, 'schemas');
const sampleDir = path.join(repo, 'src', 'data', 'sample');

// Load schemas
const emailSchema = ajv.compile(loadJSON(path.join(schemasDir, 'sample_emails.schema.json')));
const callSchema = ajv.compile(loadJSON(path.join(schemasDir, 'sample_calls.schema.json')));
const personaSchema = ajv.compile(loadJSON(path.join(schemasDir, 'sample_personas.schema.json')));

// Validate sample data
validate('emails.json', loadJSON(path.join(sampleDir, 'emails.json')), emailSchema);
validate('calls.json', loadJSON(path.join(sampleDir, 'calls.json')), callSchema);
validate('personas.json', loadJSON(path.join(sampleDir, 'personas.json')), personaSchema);

console.log('🎉 Sample dataset validation complete');


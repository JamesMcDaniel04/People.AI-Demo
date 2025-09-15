import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

test('sample data passes schemas', () => {
  const ajv = new Ajv({ allErrors: true });
  const schemasDir = path.join(process.cwd(), 'schemas');
  const sampleDir = path.join(process.cwd(), 'src', 'data', 'sample');

  const emailSchema = ajv.compile(JSON.parse(fs.readFileSync(path.join(schemasDir, 'sample_emails.schema.json'), 'utf8')));
  const callsSchema = ajv.compile(JSON.parse(fs.readFileSync(path.join(schemasDir, 'sample_calls.schema.json'), 'utf8')));
  const personasSchema = ajv.compile(JSON.parse(fs.readFileSync(path.join(schemasDir, 'sample_personas.schema.json'), 'utf8')));

  const emails = JSON.parse(fs.readFileSync(path.join(sampleDir, 'emails.json'), 'utf8'));
  const calls = JSON.parse(fs.readFileSync(path.join(sampleDir, 'calls.json'), 'utf8'));
  const personas = JSON.parse(fs.readFileSync(path.join(sampleDir, 'personas.json'), 'utf8'));

  expect(emailSchema(emails)).toBe(true);
  expect(callsSchema(calls)).toBe(true);
  expect(personasSchema(personas)).toBe(true);
});

test('golden plan passes schema', () => {
  const ajv = new Ajv({ allErrors: true });
  const schema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'schemas', 'account_plan.schema.json'), 'utf8'));
  const plan = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'golden', 'plan.json'), 'utf8'));
  const validate = ajv.compile(schema);
  expect(validate(plan)).toBe(true);
});


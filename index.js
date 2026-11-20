import { appendFileSync } from 'node:fs';

const payloadRaw = process.env.INPUT_PAYLOAD;
const outputPath = process.env.GITHUB_OUTPUT;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function canonicalize(v) {
  if (v === null) return 'null';
  const t = typeof v;
  if (t === 'string') return JSON.stringify(v);
  if (t === 'number') {
    if (!Number.isFinite(v)) throw new Error('Invalid input: non-finite number');
    return String(v);
  }
  if (t === 'boolean') return v ? 'true' : 'false';
  if (t !== 'object') throw new Error('Invalid input: unsupported value type');
  if (Array.isArray(v)) {
    let s = '[';
    for (let i = 0; i < v.length; i++) {
      if (i) s += ',';
      s += canonicalize(v[i]);
    }
    return s + ']';
  }
  if (!isPlainObject(v)) throw new Error('Invalid input: unsupported object type');
  const keys = Object.keys(v).sort();
  let s = '{';
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const val = v[k];
    if (val === undefined || typeof val === 'function' || typeof val === 'symbol') {
      throw new Error('Invalid input: non-JSON value');
    }
    if (i) s += ',';
    s += JSON.stringify(k) + ':' + canonicalize(val);
  }
  return s + '}';
}

function validateJsonValue(v) {
  if (v === null) return;
  const t = typeof v;
  if (t === 'string' || t === 'boolean') return;
  if (t === 'number') {
    if (!Number.isFinite(v)) throw new Error('Invalid input: non-finite number');
    return;
  }
  if (t !== 'object') throw new Error('Invalid input: unsupported value type');
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) validateJsonValue(v[i]);
    return;
  }
  if (!isPlainObject(v)) throw new Error('Invalid input: unsupported object type');
  const keys = Object.keys(v);
  for (let i = 0; i < keys.length; i++) {
    const val = v[keys[i]];
    if (val === undefined || typeof val === 'function' || typeof val === 'symbol') {
      throw new Error('Invalid input: non-JSON value');
    }
    validateJsonValue(val);
  }
}

try {
  if (typeof payloadRaw !== 'string') throw new Error('Invalid input: missing INPUT_PAYLOAD');
  if (typeof outputPath !== 'string' || outputPath.length === 0) throw new Error('Invalid input: missing GITHUB_OUTPUT');

  const parsed = JSON.parse(payloadRaw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid input: payload must be an object');
  if (!Object.prototype.hasOwnProperty.call(parsed, 'values')) throw new Error('Invalid input: missing values');
  if (!Array.isArray(parsed.values)) throw new Error('Invalid input: values must be an array');

  const values = parsed.values;
  for (let i = 0; i < values.length; i++) validateJsonValue(values[i]);

  const seen = new Set();
  const unique = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const key = canonicalize(v);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(v);
    }
  }

  const result = { unique, removed: values.length - unique.length };
  appendFileSync(outputPath, `result=${JSON.stringify(result)}\n`);
} catch (err) {
  throw err instanceof Error ? err : new Error('Invalid input');
}
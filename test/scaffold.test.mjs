import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  applyConfig,
  DEFAULT_ORIGIN,
  DEFAULT_PUBLISHED_ORIGIN,
  parseArgs,
  ScaffoldError,
  SECUREFLOWS_JS_RANGE,
  toPackageName,
} from '../src/scaffold.js';

test('parseArgs reads directory, workspace and app-id', () => {
  const opts = parseArgs(['my-app', '--workspace=acme', '--app-id=acme-web']);
  assert.equal(opts.dir, 'my-app');
  assert.equal(opts.workspace, 'acme');
  assert.equal(opts.appId, 'acme-web');
  assert.equal(opts.origin, DEFAULT_ORIGIN);
  assert.equal(opts.publishedOrigin, DEFAULT_PUBLISHED_ORIGIN);
});

test('parseArgs accepts --appId as well as --app-id', () => {
  const opts = parseArgs(['my-app', '--workspace=acme', '--appId=acme-web']);
  assert.equal(opts.appId, 'acme-web');
});

test('parseArgs requires directory, workspace and app-id', () => {
  assert.throws(() => parseArgs(['--workspace=a', '--app-id=b']), ScaffoldError);
  assert.throws(() => parseArgs(['dir', '--app-id=b']), ScaffoldError);
  assert.throws(() => parseArgs(['dir', '--workspace=a']), ScaffoldError);
});

test('parseArgs rejects a non-URL or non-http origin', () => {
  assert.throws(() => parseArgs(['d', '--workspace=a', '--app-id=b', '--origin=nope']), ScaffoldError);
  assert.throws(
    () => parseArgs(['d', '--workspace=a', '--app-id=b', '--origin=ftp://x.com']),
    ScaffoldError,
  );
});

test('parseArgs strips trailing slashes so /callback never doubles up', () => {
  const opts = parseArgs([
    'd',
    '--workspace=a',
    '--app-id=b',
    '--published-origin=https://app.example.com/',
  ]);
  assert.equal(opts.publishedOrigin, 'https://app.example.com');
});

test('parseArgs rejects unknown options', () => {
  assert.throws(() => parseArgs(['d', '--workspace=a', '--app-id=b', '--nope=1']), ScaffoldError);
});

test('--help short-circuits required-argument validation', () => {
  const opts = parseArgs(['--help']);
  assert.equal(opts.help, true);
});

test('toPackageName produces a valid npm name', () => {
  assert.equal(toPackageName('My App'), 'my-app');
  assert.equal(toPackageName('.hidden'), 'hidden');
  assert.equal(toPackageName('___'), 'secureflows-app');
});

function makeTemplate(dir, configBody) {
  fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'config', 'secureflows.ts'), configBody, 'utf8');
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'my-secureflows-app', dependencies: { 'secureflows-js': '^0.1.14' } }, null, 2),
    'utf8',
  );
}

const TEMPLATE_CONFIG = [
  'export const SECUREFLOWS_ORIGIN = "https://www.secure-flows.com";',
  'export const SECUREFLOWS_WORKSPACE = "REPLACE_WORKSPACE";',
  'export const SECUREFLOWS_APP_ID = "REPLACE_APP_ID";',
  'export const SECUREFLOWS_PUBLISHED_ORIGIN = "https://REPLACE_PREVIEW_HOST";',
].join('\n');

test('applyConfig substitutes every placeholder and pins secureflows-js', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-scaffold-'));
  try {
    makeTemplate(dir, TEMPLATE_CONFIG);
    const opts = parseArgs([
      dir,
      '--workspace=acme',
      '--app-id=acme-web',
      '--published-origin=https://app.example.com',
    ]);
    const written = applyConfig(dir, opts, fs);

    const config = fs.readFileSync(path.join(dir, 'src', 'config', 'secureflows.ts'), 'utf8');
    assert.doesNotMatch(config, /REPLACE_/, 'no placeholder may survive');
    assert.match(config, /SECUREFLOWS_WORKSPACE = "acme"/);
    assert.match(config, /SECUREFLOWS_APP_ID = "acme-web"/);
    assert.match(config, /SECUREFLOWS_PUBLISHED_ORIGIN = "https:\/\/app\.example\.com"/);

    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    assert.equal(pkg.dependencies['secureflows-js'], SECUREFLOWS_JS_RANGE);
    assert.equal(pkg.name, path.basename(dir).toLowerCase());
    assert.deepEqual(written, ['src/config/secureflows.ts', 'package.json']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('applyConfig rewrites the origin when targeting staging', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-scaffold-'));
  try {
    makeTemplate(dir, TEMPLATE_CONFIG);
    const opts = parseArgs([
      dir,
      '--workspace=a',
      '--app-id=b',
      '--origin=https://secure-flows-staging.onrender.com',
    ]);
    applyConfig(dir, opts, fs);
    const config = fs.readFileSync(path.join(dir, 'src', 'config', 'secureflows.ts'), 'utf8');
    assert.match(config, /SECUREFLOWS_ORIGIN = "https:\/\/secure-flows-staging\.onrender\.com"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('applyConfig fails loudly if the template placeholders drift', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-scaffold-'));
  try {
    // Template renamed its placeholders: nothing matches, so nothing would be substituted.
    makeTemplate(dir, 'export const SECUREFLOWS_WORKSPACE = "SOMETHING_ELSE";');
    const opts = parseArgs([dir, '--workspace=a', '--app-id=b']);
    assert.throws(() => applyConfig(dir, opts, fs), /out of sync/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('applyConfig fails if only some placeholders are substituted', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-scaffold-'));
  try {
    makeTemplate(
      dir,
      ['export const SECUREFLOWS_WORKSPACE = "REPLACE_WORKSPACE";', 'const X = "REPLACE_SOMETHING_NEW";'].join('\n'),
    );
    const opts = parseArgs([dir, '--workspace=a', '--app-id=b']);
    assert.throws(() => applyConfig(dir, opts, fs), /unsubstituted placeholder/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

#!/usr/bin/env node
// Scaffolds a working secureFlows integration. Zero runtime dependencies (Node built-ins only) so
// `npx create-secureflows-app` is a fast, single-package download with no transitive supply chain.
//
// Why this exists: SKILL.md previously had to describe these files in prose ("reproduce the
// starter files exactly"), and an agent reproducing them by hand is where the documented
// integration bugs come from. Scaffolding them as code removes that step entirely — the correct
// callback/session/logout wiring is copied, not re-derived.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyConfig,
  parseArgs,
  ScaffoldError,
  USAGE,
} from '../src/scaffold.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const templateDir = path.join(packageRoot, 'template');

function copyTemplate(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const fromPath = path.join(from, entry.name);
    // bundle-template.mjs stores the template's .gitignore as `gitignore` because npm renames a
    // packaged `.gitignore` to `.npmignore`. Restore the real name here.
    const name = entry.name === 'gitignore' ? '.gitignore' : entry.name;
    const toPath = path.join(to, name);
    if (entry.isDirectory()) {
      copyTemplate(fromPath, toPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(fromPath, toPath);
    }
  }
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof ScaffoldError) {
      console.error(`create-secureflows-app: ${error.message}\n`);
      console.error(USAGE);
      process.exit(2);
    }
    throw error;
  }

  if (opts.help) {
    console.log(USAGE);
    return;
  }

  if (!fs.existsSync(templateDir)) {
    console.error(
      'create-secureflows-app: bundled template/ is missing. If you are running from a monorepo ' +
        'checkout, run `npm run bundle-template` in create-secureflows-app/ first.',
    );
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), opts.dir);
  // Refuse to scaffold into a non-empty directory rather than merging into it — silently writing
  // over someone's existing source is not recoverable from a CLI.
  if (fs.existsSync(targetDir)) {
    const existing = fs.readdirSync(targetDir).filter(n => n !== '.git' && n !== '.DS_Store');
    if (existing.length > 0) {
      console.error(
        `create-secureflows-app: ${targetDir} already exists and is not empty — refusing to overwrite it. ` +
          'Choose a different directory name, or empty this one first.',
      );
      process.exit(1);
    }
  }

  copyTemplate(templateDir, targetDir);
  const written = applyConfig(targetDir, opts, fs);

  const appName = path.basename(targetDir);
  console.log(`\n  Created ${appName} at ${targetDir}\n`);
  console.log('  Config written:');
  console.log(`    workspace         ${opts.workspace}`);
  console.log(`    appId             ${opts.appId}`);
  console.log(`    origin            ${opts.origin}`);
  console.log(`    published origin  ${opts.publishedOrigin}`);
  console.log(`    (${written.join(', ')})\n`);
  console.log('  Next:\n');
  console.log(`    cd ${path.relative(process.cwd(), targetDir) || '.'}`);
  console.log('    npm install');
  console.log('    npm run dev\n');
  // The one step that cannot be automated and that silently breaks sign-in when skipped: hosted
  // login rejects any redirect_uri not registered for this appId (exact match, no wildcards).
  console.log('  Before sign-in will work, register this exact callback URL in the dashboard');
  console.log('  (Applications -> your app -> redirect URIs):\n');
  console.log(`    ${opts.publishedOrigin.replace(/\/+$/, '')}/callback\n`);
  console.log('    https://www.secure-flows.com/app/workspaces\n');
  console.log('  Deploying elsewhere? Re-run with --published-origin=https://your-host and');
  console.log('  register that host’s /callback too.\n');
}

main();

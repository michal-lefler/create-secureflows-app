// Copies templates/web-app-secureflows into create-secureflows-app/template so it ships inside
// the published npm package. Without this, an npx install has no monorepo checkout next to it and
// the scaffolder would have nothing to copy — same lesson as mcp-server/scripts/bundle-openapi.mjs.
//
// Runs via the "prepack" lifecycle hook, so both `npm pack` and a real `npm publish` always ship a
// current bundle rather than a stale one committed by hand. In the private monorepo, template/ is
// gitignored for exactly that reason: it is generated, never edited directly. Edit
// templates/web-app-secureflows instead — it is the single source of truth.
//
// This repo is a public mirror of that private monorepo. There is no repoRoot/templates here —
// template/ is committed directly instead, kept current by the monorepo's sync script. If that
// committed copy is present, skip re-copying rather than failing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..');

const src = path.join(repoRoot, 'templates', 'web-app-secureflows');
const dest = path.join(packageRoot, 'template');

// Never ship: build output, installed deps, the template's own lockfile (it pins secureflows-js to
// whatever the monorepo had at bundle time, which would silently override the dependency version
// the scaffolder writes into package.json), or macOS cruft.
const EXCLUDE = new Set(['node_modules', 'dist', '.DS_Store', 'package-lock.json']);

if (!fs.existsSync(src)) {
  if (fs.existsSync(dest)) {
    console.log(`bundle-template: no monorepo checkout at ${src}, keeping committed template/`);
    process.exit(0);
  }
  console.error(`bundle-template: source template not found at ${src}`);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });

let count = 0;
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue;
    const fromPath = path.join(from, entry.name);
    const toPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(fromPath, toPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(fromPath, toPath);
      count += 1;
    }
  }
}

copyDir(src, dest);

// A scaffolded project must not ship a .gitignore named such that npm strips it. npm silently
// renames a packaged `.gitignore` to `.npmignore` on publish, which would leave every scaffolded
// app without one — so store it under a neutral name and restore it at scaffold time (see
// bin/create-secureflows-app.js).
const gitignore = path.join(dest, '.gitignore');
if (fs.existsSync(gitignore)) {
  fs.renameSync(gitignore, path.join(dest, 'gitignore'));
}

console.log(`bundle-template: copied ${count} file(s) -> create-secureflows-app/template`);

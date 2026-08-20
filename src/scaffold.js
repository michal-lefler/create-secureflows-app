// Pure scaffolding logic, kept out of bin/ so it can be unit-tested without spawning a process
// or touching the real filesystem (applyConfig takes its fs module as an argument).

import path from 'node:path';

/**
 * secureflows-js range written into scaffolded apps.
 *
 * MUST stay >= the version whose public API this template targets. 0.2.0 removed the low-level
 * URL-building/navigation helpers from the SDK's public surface, so an app scaffolded against the
 * current template should not silently resolve to a 0.1.x that still exposes them.
 */
export const SECUREFLOWS_JS_RANGE = '^0.2.0';

export const DEFAULT_ORIGIN = 'https://www.secure-flows.com';
/** Vite's default dev host — the origin a freshly scaffolded app actually runs on. */
export const DEFAULT_PUBLISHED_ORIGIN = 'http://localhost:5173';

export const USAGE = `Usage:
  npx create-secureflows-app <directory> --workspace=<name> --app-id=<id> [options]

Required:
  --workspace=<name>          Workspace name from the secureFlows dashboard
  --app-id=<id>               Application id from the secureFlows dashboard
                              (--appId is accepted too)

Options:
  --origin=<url>              secureFlows origin (default: ${DEFAULT_ORIGIN})
                              Use https://secure-flows-staging.onrender.com to target staging.
  --published-origin=<url>    Origin this app will be served from, used to build the hosted-login
                              redirect URI (default: ${DEFAULT_PUBLISHED_ORIGIN}).
                              Its /callback must be registered in the dashboard allowlist.
  -h, --help                  Show this help

Example:
  npx create-secureflows-app my-app --workspace=acme --app-id=acme-web
`;

export class ScaffoldError extends Error {}

function requireUrl(value, flag) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new ScaffoldError(`${flag} must be an absolute URL (got "${value}")`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ScaffoldError(`${flag} must be an http(s) URL (got "${value}")`);
  }
  // Trailing slashes would produce "https://host//callback" once /callback is appended.
  return value.replace(/\/+$/, '');
}

export function parseArgs(argv) {
  const opts = {
    dir: '',
    workspace: '',
    appId: '',
    origin: DEFAULT_ORIGIN,
    publishedOrigin: DEFAULT_PUBLISHED_ORIGIN,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg.startsWith('--workspace=')) {
      opts.workspace = arg.slice('--workspace='.length).trim();
    } else if (arg.startsWith('--app-id=')) {
      opts.appId = arg.slice('--app-id='.length).trim();
    } else if (arg.startsWith('--appId=')) {
      // The dashboard and SKILL.md both spell it appId; accept either rather than making someone
      // re-run over a hyphen.
      opts.appId = arg.slice('--appId='.length).trim();
    } else if (arg.startsWith('--origin=')) {
      opts.origin = arg.slice('--origin='.length).trim();
    } else if (arg.startsWith('--published-origin=')) {
      opts.publishedOrigin = arg.slice('--published-origin='.length).trim();
    } else if (arg.startsWith('-')) {
      throw new ScaffoldError(`unknown option "${arg}"`);
    } else if (!opts.dir) {
      opts.dir = arg;
    } else {
      throw new ScaffoldError(`unexpected extra argument "${arg}"`);
    }
  }

  if (opts.help) {
    return opts;
  }
  if (!opts.dir) {
    throw new ScaffoldError('a target directory is required');
  }
  if (!opts.workspace) {
    throw new ScaffoldError('--workspace is required (get it from the secureFlows dashboard)');
  }
  if (!opts.appId) {
    throw new ScaffoldError('--app-id is required (get it from the secureFlows dashboard)');
  }

  opts.origin = requireUrl(opts.origin, '--origin');
  opts.publishedOrigin = requireUrl(opts.publishedOrigin, '--published-origin');

  return opts;
}

/** npm package names: lowercase, no spaces, no leading dot/underscore. */
export function toPackageName(dirName) {
  const cleaned = dirName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+/, '')
    .replace(/-+$/, '');
  return cleaned || 'secureflows-app';
}

/**
 * Rewrites the copied template in place: substitutes the config placeholders and points
 * package.json at this app's name and the right secureflows-js range.
 *
 * `fsMod` is injected so tests can drive this against a memfs-style stub or a temp dir.
 * Returns the list of files it modified.
 */
export function applyConfig(targetDir, opts, fsMod) {
  const written = [];

  const configPath = path.join(targetDir, 'src', 'config', 'secureflows.ts');
  if (!fsMod.existsSync(configPath)) {
    throw new ScaffoldError(`template is missing ${path.relative(targetDir, configPath)}`);
  }
  let config = fsMod.readFileSync(configPath, 'utf8');
  const before = config;
  config = config
    .replace(/"REPLACE_WORKSPACE"/g, JSON.stringify(opts.workspace))
    .replace(/"REPLACE_APP_ID"/g, JSON.stringify(opts.appId))
    .replace(/"https:\/\/REPLACE_PREVIEW_HOST"/g, JSON.stringify(opts.publishedOrigin))
    .replace(/"https:\/\/www\.secure-flows\.com"/g, JSON.stringify(opts.origin));
  if (config === before) {
    // The template's placeholders were renamed without updating this — fail loudly rather than
    // emit an app that still says REPLACE_WORKSPACE and fails at runtime with a confusing error.
    throw new ScaffoldError(
      'no placeholders were substituted in src/config/secureflows.ts — the bundled template and this ' +
        'scaffolder are out of sync.',
    );
  }
  if (/REPLACE_[A-Z_]+/.test(config)) {
    const leftover = config.match(/REPLACE_[A-Z_]+/g).join(', ');
    throw new ScaffoldError(`unsubstituted placeholder(s) left in config: ${leftover}`);
  }
  fsMod.writeFileSync(configPath, config, 'utf8');
  written.push('src/config/secureflows.ts');

  const pkgPath = path.join(targetDir, 'package.json');
  if (fsMod.existsSync(pkgPath)) {
    const pkg = JSON.parse(fsMod.readFileSync(pkgPath, 'utf8'));
    pkg.name = toPackageName(path.basename(targetDir));
    if (pkg.dependencies && pkg.dependencies['secureflows-js']) {
      pkg.dependencies['secureflows-js'] = SECUREFLOWS_JS_RANGE;
    }
    fsMod.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    written.push('package.json');
  }

  return written;
}

# create-secureflows-app

[![secureFlows](https://img.shields.io/badge/secureFlows-www.secure--flows.com-1a73e8)](https://www.secure-flows.com) [![CI](https://github.com/michal-lefler/create-secureflows-app/actions/workflows/ci.yml/badge.svg)](https://github.com/michal-lefler/create-secureflows-app/actions/workflows/ci.yml)

Scaffolds a working [secureFlows](https://www.secure-flows.com) integration — React + TypeScript +
Vite, with hosted login, an unguarded `/callback` route, and correct session/sign-out handling
already wired up.

> This repo is a public mirror, published periodically from the private secureFlows monorepo
> where development actually happens. Issues and PRs are welcome; large changes may take a
> release cycle to land upstream first.

```bash
npx create-secureflows-app my-app --workspace=<workspace> --app-id=<appId>
cd my-app
npm install
npm run dev
```

`workspace` and `appId` come from the [workspace dashboard](https://www.secure-flows.com/app/workspaces)
(a one-time admin step — no code).

## Why this exists

The integration itself is small, but a handful of details are easy to get subtly wrong and fail at
runtime rather than at build time: `/callback` must be unguarded, sign-out must be a top-level
redirect rather than `fetch`, `401`/`410`/`403` must clear the stored token, and a `403` carrying
`BILLING_GRACE_LOCK` must *not* be treated as a sign-out.

Those rules used to live only as prose that an AI agent (or a person) had to reproduce by hand —
which is exactly where the bugs came from. Here they are shipped as code that already works, so
there is nothing to re-derive.

## Options

| Flag | Default | Notes |
|---|---|---|
| `--workspace=<name>` | *(required)* | Workspace name from the dashboard |
| `--app-id=<id>` | *(required)* | Application id from the dashboard (`--appId` also accepted) |
| `--origin=<url>` | `https://www.secure-flows.com` | Use `https://secure-flows-staging.onrender.com` for staging |
| `--published-origin=<url>` | `http://localhost:5173` | Origin the app is served from; its `/callback` must be allowlisted |

## One manual step: allowlist the callback URL

secureFlows rejects any `redirect_uri` that is not registered for your `appId` — **exact match, no
wildcards**. After scaffolding, register:

```
<published-origin>/callback
```

in the dashboard under Applications → your app → redirect URIs. The scaffolder prints the exact URL
to register when it finishes. Sign-in fails until this is done, so it is worth doing first.

When you deploy somewhere else, re-run with `--published-origin=https://your-host` (or edit
`src/config/secureflows.ts`) and register that host's `/callback` too.

## What you get

```
src/
  config/secureflows.ts       workspace / appId / origins (the only file the scaffolder rewrites)
  lib/callbackUri.ts          allowlisted callback + post-logout redirect URIs
  lib/secureFlowsSession.tsx  provider: restores an existing token, exposes login/logout
  lib/sessionRestoreError.ts  distinguishes signed-out from billing-lock and transient errors
  lib/signedOutLocalState.ts  clears local state on sign-out
  SecureFlowsCallback.tsx     the unguarded /callback handler
  main.tsx                    renders the callback handler alone on /callback
  App.tsx                     signed-out CTA / signed-in UI
```

Scaffolded projects verify clean against `secureflows_lint_integration` (hosted MCP:
[`https://www.secure-flows.com/mcp`](https://www.secure-flows.com/mcp)).

## Relationship to the monorepo

`template/` in the published package is **generated** at pack time from
`templates/web-app-secureflows/` in the [secureFlows monorepo](https://github.com/michal-lefler/secureFlows)
by `scripts/bundle-template.mjs`. Edit the monorepo template — never `template/`, which is
gitignored and overwritten on every pack.

# Web app starter (React + secureflows-js)

**Copy this entire folder** when an integrator prompt says “use secureFlows” (Lovable, Cursor, Base44, etc.).

## Auth model (stable hosted login)

One flow everywhere: preview and published app behave the same.

1. App loads and restores an existing session token if present
2. No token → show **Continue with secureFlows**
3. Click → full-page redirect to secureFlows hosted login
4. Return to **`/callback?sessionToken=…`** (allowlisted in dashboard)
5. `SecureFlowsCallback` parses token → redirect to `/`
6. Main app loads with session

If an old/stale token cannot be restored (`401`/`410`, empty-body `403`, or legacy JSON `403` Access denied from an expired JWT after long idle), the app clears it silently and shows **Continue with secureFlows** — never keep retrying Session API with error banners. Billing `403` (`BILLING_GRACE_LOCK`) and other non-signed-out restore errors keep the token and the **signed-in** shell (Sign out + banner) — they must not surface the Continue CTA. Gate that CTA on a stored token (`hasToken`), not on `session === null`.

On mid-flow signed-out (e.g. Save hits `401`/`410`), call **`handleSignedOut()`** from `useSecureFlows()` — not `sf.logout()` alone. Clearing only the token leaves the signed-in shell up and makes **Sign out** a no-op (`logoutWithRedirect` returns early with no token).
If a preview silently blocks the redirect after sign-in click, the SDK rejects with `HostedLoginNavigationError`; the app shows that message, stops "Redirecting...", and keeps the same **Continue with secureFlows** CTA.

**No popup.** **No `RequireAuth`.** **No Supabase.**

## Setup

1. Copy this folder as the app root.
2. Edit `src/config/secureflows.ts` — `REPLACE_WORKSPACE`, `REPLACE_APP_ID`, preview host.
3. Register **`https://<deployment-host>/callback`** in the [workspace dashboard](https://www.secure-flows.com/app/workspaces).
4. `npm install && npm run dev`

## Files agents must not reinvent

| File | Role |
|------|------|
| `src/main.tsx` | Routes `/callback` to `SecureFlowsCallback` only |
| `src/SecureFlowsCallback.tsx` | Unguarded OAuth return handler |
| `src/lib/secureFlowsSession.tsx` | Restores token on load; `hasToken` + `handleSignedOut()`; login from Continue CTA |
| `src/App.tsx` | Continue CTA only when `!hasToken`; restore errors stay signed-in with a banner |
| `src/lib/signedOutLocalState.ts` | Shared “clear token + UI” helper used by `handleSignedOut` |
| `src/config/secureflows.ts` | Constants |

## Do not add

- `RequireAuth` / global protected route wrappers
- Platform auth (Supabase, etc.)
- Auto redirect to hosted login on mount
- Popup-only login without `/callback`

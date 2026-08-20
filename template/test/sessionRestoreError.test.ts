import test from 'node:test';
import assert from 'node:assert/strict';

import { SecureFlowsHttpError } from 'secureflows-js';

import { isRestoreSignedOutError } from '../src/lib/sessionRestoreError.js';

// Regression coverage for the bug code review caught repeatedly across sf-integration-eval
// trials: SecureFlowsProvider's restore effect used to call sf.logout() on ANY fetchSession
// failure, wiping a still-valid token on a BILLING_GRACE_LOCK response or a transient network
// blip. isRestoreSignedOutError is the extracted decision that now gates that call.
// App must then keep the signed-in shell (hasToken), not treat session === null as Continue CTA.
// Companion: mid-flow Save signed-out must clear token AND UI — see signedOutLocalState.test.ts.

test('401 is a signed-out error', () => {
  assert.equal(isRestoreSignedOutError(new SecureFlowsHttpError(401, 'Unauthorized')), true);
});

test('410 is a signed-out error', () => {
  assert.equal(isRestoreSignedOutError(new SecureFlowsHttpError(410, 'Gone')), true);
});

test('403 with an empty body is a signed-out error (stale idle JWT)', () => {
  assert.equal(isRestoreSignedOutError(new SecureFlowsHttpError(403, 'Forbidden', '')), true);
});

test('403 with legacy JSON "Access denied" is a signed-out error', () => {
  const body = JSON.stringify({ error: 'Access denied' });
  assert.equal(isRestoreSignedOutError(new SecureFlowsHttpError(403, 'Forbidden', body)), true);
});

test('403 BILLING_GRACE_LOCK is NOT a signed-out error — must not clear the token', () => {
  const body = JSON.stringify({ code: 'BILLING_GRACE_LOCK' });
  assert.equal(isRestoreSignedOutError(new SecureFlowsHttpError(403, 'Forbidden', body)), false);
});

test('a 5xx is NOT a signed-out error', () => {
  assert.equal(isRestoreSignedOutError(new SecureFlowsHttpError(500, 'Internal Server Error')), false);
});

test('a plain network/generic error is NOT a signed-out error', () => {
  assert.equal(isRestoreSignedOutError(new TypeError('Failed to fetch')), false);
  assert.equal(isRestoreSignedOutError(new Error('boom')), false);
});

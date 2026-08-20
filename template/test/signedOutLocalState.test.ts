import test from 'node:test';
import assert from 'node:assert/strict';

import { clearSignedOutLocalState } from '../src/lib/signedOutLocalState.js';

// Regression for sf-integration-eval trial many-20260801T035125Z-1 code-review fail: Save-time
// signed-out called sf.logout() only, left React session set → signed-in shell + dead Sign out
// (logoutWithRedirect no-ops with no token). clearSignedOutLocalState is the extracted "both"
// step SecureFlowsProvider.handleSignedOut uses.

test('clearSignedOutLocalState clears token and app session UI', () => {
  const calls: string[] = [];
  clearSignedOutLocalState({
    clearToken: () => calls.push('token'),
    clearSessionUi: () => calls.push('ui'),
  });
  assert.deepEqual(calls, ['token', 'ui']);
});

test('clearSignedOutLocalState always clears UI even if token clear is a no-op', () => {
  let uiCleared = false;
  clearSignedOutLocalState({
    clearToken: () => {
      /* already cleared */
    },
    clearSessionUi: () => {
      uiCleared = true;
    },
  });
  assert.equal(uiCleared, true);
});

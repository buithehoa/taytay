import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCommandRegistry } from '../../src/commands/index.js';
import { ConnectScreen } from '../../src/components/ConnectScreen.js';

test('dispatch runs /connect and returns the ConnectScreen with no output', async () => {
  const registry = createCommandRegistry();
  const result = await registry.dispatch('/connect');
  assert.equal(result.output, '');
  assert.equal(result.screen, ConnectScreen);
  assert.equal(result.exit, undefined);
});

test('/connect fuzzy-matches in the dropdown', () => {
  const registry = createCommandRegistry();
  const matches = registry.fuzzyMatch('con').map((c) => c.names[0]);
  assert.ok(matches.includes('connect'));
});

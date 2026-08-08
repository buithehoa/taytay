import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStubConnector } from '../../src/services/connectors.js';

test('stub connector connect() resolves after the given delay', async () => {
  const connector = createStubConnector(5);
  const start = Date.now();
  await connector.connect();
  assert.ok(Date.now() - start >= 4, 'should wait roughly the configured delay');
});

test('stub connector disconnect() resolves', async () => {
  const connector = createStubConnector(5);
  await connector.disconnect();
});

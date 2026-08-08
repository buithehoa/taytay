import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConnectionStore } from '../../src/services/connectionStore.js';
import type { ServiceConnector } from '../../src/services/connectors.js';

class ManualConnector implements ServiceConnector {
  connectCalls = 0;
  disconnectCalls = 0;
  private resolveNext: (() => void) | null = null;
  private rejectNext: ((err: Error) => void) | null = null;

  connect(): Promise<void> {
    this.connectCalls += 1;
    return new Promise((resolve, reject) => {
      this.resolveNext = resolve;
      this.rejectNext = reject;
    });
  }

  disconnect(): Promise<void> {
    this.disconnectCalls += 1;
    return new Promise((resolve, reject) => {
      this.resolveNext = resolve;
      this.rejectNext = reject;
    });
  }

  async settle(): Promise<void> {
    this.resolveNext?.();
    await new Promise((resolve) => setImmediate(resolve));
  }

  async fail(): Promise<void> {
    this.rejectNext?.(new Error('boom'));
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test('unknown service defaults to disconnected', () => {
  const store = createConnectionStore();
  assert.equal(store.getStatus('lastfm'), 'disconnected');
});

test('toggle from disconnected goes connecting then connected', async () => {
  const store = createConnectionStore();
  const connector = new ManualConnector();

  store.toggle('lastfm', connector);
  assert.equal(store.getStatus('lastfm'), 'connecting');

  await connector.settle();
  assert.equal(store.getStatus('lastfm'), 'connected');
  assert.equal(connector.connectCalls, 1);
});

test('a rejected connect moves the status to error, and toggling retries', async () => {
  const store = createConnectionStore();
  const connector = new ManualConnector();

  store.toggle('lastfm', connector);
  await connector.fail();
  assert.equal(store.getStatus('lastfm'), 'error');

  store.toggle('lastfm', connector);
  assert.equal(store.getStatus('lastfm'), 'connecting');
  assert.equal(connector.connectCalls, 2);

  await connector.settle();
  assert.equal(store.getStatus('lastfm'), 'connected');
});

test('toggle from connected goes disconnecting then disconnected', async () => {
  const store = createConnectionStore();
  const connector = new ManualConnector();

  store.toggle('lastfm', connector);
  await connector.settle();

  store.toggle('lastfm', connector);
  assert.equal(store.getStatus('lastfm'), 'disconnecting');
  assert.equal(connector.disconnectCalls, 1);

  await connector.settle();
  assert.equal(store.getStatus('lastfm'), 'disconnected');
});

test('toggle is ignored while an operation is in flight', () => {
  const store = createConnectionStore();
  const connector = new ManualConnector();

  store.toggle('lastfm', connector);
  store.toggle('lastfm', connector);
  assert.equal(connector.connectCalls, 1);
  assert.equal(store.getStatus('lastfm'), 'connecting');
});

test('subscribers are notified on every transition; unsubscribe stops notifications', async () => {
  const store = createConnectionStore();
  const connector = new ManualConnector();
  let calls = 0;
  const unsubscribe = store.subscribe(() => {
    calls += 1;
  });

  store.toggle('lastfm', connector); // -> connecting
  assert.equal(calls, 1);

  await connector.settle(); // -> connected
  assert.equal(calls, 2);

  unsubscribe();
  store.toggle('lastfm', connector); // -> disconnecting
  assert.equal(calls, 2);
});

test('services are tracked independently', async () => {
  const store = createConnectionStore();
  const lastfm = new ManualConnector();

  store.toggle('lastfm', lastfm);
  await lastfm.settle();

  assert.equal(store.getStatus('lastfm'), 'connected');
  assert.equal(store.getStatus('spotify'), 'disconnected');
});

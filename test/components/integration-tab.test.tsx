import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { IntegrationTab, IntegrationService } from '../../src/components/IntegrationTab.js';
import { createConnectionStore } from '../../src/services/connectionStore.js';
import { createStubConnector } from '../../src/services/connectors.js';

const ARROW_UP = '\u001B[A';
const ARROW_DOWN = '\u001B[B';

const tick = (ms = 30) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function makeServices(delayMs = 10): IntegrationService[] {
  return [
    { id: 'lastfm', label: 'LastFm', connector: createStubConnector(delayMs) },
    { id: 'spotify', label: 'Spotify', connector: createStubConnector(delayMs) },
  ];
}

function rowFor(frame: string, label: string): string {
  const line = frame.split('\n').find((l) => l.includes(label));
  assert.ok(line !== undefined, `expected a row containing ${label}`);
  return line;
}

test('renders both services with Connect controls, first row focused', async () => {
  const { lastFrame, unmount } = render(
    <IntegrationTab services={makeServices()} store={createConnectionStore()} />,
  );
  await tick();

  const frame = lastFrame() ?? '';
  assert.ok(frame.includes('▸ LastFm'));
  assert.ok(frame.includes('Spotify'));
  assert.ok(rowFor(frame, 'LastFm').includes('Connect'));
  assert.ok(rowFor(frame, 'Spotify').includes('Connect'));
  unmount();
});

test('down/up arrows move focus and clamp at the ends', async () => {
  const { stdin, lastFrame, unmount } = render(
    <IntegrationTab services={makeServices()} store={createConnectionStore()} />,
  );
  await tick();

  stdin.write(ARROW_DOWN);
  await tick();
  assert.ok((lastFrame() ?? '').includes('▸ Spotify'));

  stdin.write(ARROW_DOWN); // already at the last row — clamps
  await tick();
  assert.ok((lastFrame() ?? '').includes('▸ Spotify'));

  stdin.write(ARROW_UP);
  await tick();
  assert.ok((lastFrame() ?? '').includes('▸ LastFm'));

  stdin.write(ARROW_UP); // already at the first row — clamps
  await tick();
  assert.ok((lastFrame() ?? '').includes('▸ LastFm'));
  unmount();
});

test('space toggles the focused row: connecting spinner, then Connected', async () => {
  const store = createConnectionStore();
  const { stdin, lastFrame, unmount } = render(
    <IntegrationTab services={makeServices(40)} store={store} />,
  );
  await tick();

  stdin.write(' ');
  await tick(10);
  assert.equal(store.getStatus('lastfm'), 'connecting');
  assert.ok(
    !rowFor(lastFrame() ?? '', 'LastFm').includes('Connect'),
    'connecting row shows a spinner instead of the Connect label',
  );

  await tick(60);
  assert.equal(store.getStatus('lastfm'), 'connected');
  assert.ok(rowFor(lastFrame() ?? '', 'LastFm').includes('Connected'));
  unmount();
});

test('enter toggles a connected row back through disconnecting to Connect', async () => {
  const store = createConnectionStore();
  const services = makeServices(40);
  const { stdin, lastFrame, unmount } = render(
    <IntegrationTab services={services} store={store} />,
  );
  await tick();

  stdin.write('\r');
  await tick(60);
  assert.equal(store.getStatus('lastfm'), 'connected');

  stdin.write('\r');
  await tick(10);
  assert.equal(store.getStatus('lastfm'), 'disconnecting');

  await tick(60);
  assert.equal(store.getStatus('lastfm'), 'disconnected');
  assert.ok(rowFor(lastFrame() ?? '', 'LastFm').includes('Connect'));
  unmount();
});

test('a failed connect shows the error state and the row still reads Connect', async () => {
  const store = createConnectionStore();
  const services: IntegrationService[] = [
    {
      id: 'lastfm',
      label: 'LastFm',
      connector: {
        connect: () => Promise.reject(new Error('nope')),
        disconnect: () => Promise.resolve(),
      },
    },
  ];
  const { stdin, lastFrame, unmount } = render(
    <IntegrationTab services={services} store={store} />,
  );
  await tick();

  stdin.write(' ');
  await tick();
  assert.equal(store.getStatus('lastfm'), 'error');
  assert.ok(rowFor(lastFrame() ?? '', 'LastFm').includes('Connect'));
  assert.ok(!rowFor(lastFrame() ?? '', 'LastFm').includes('Connected'));
  unmount();
});

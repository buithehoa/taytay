import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { ConnectScreen } from '../../src/components/ConnectScreen.js';

const ESC = '\u001B';
const TAB = '\t';

const tick = (ms = 30) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

test('renders title, tabs, integration rows, and the footer hint', async () => {
  const { lastFrame, unmount } = render(<ConnectScreen onClose={() => {}} />);
  await tick();

  const frame = lastFrame() ?? '';
  assert.ok(frame.includes('Settings'));
  assert.ok(frame.includes('Integration'));
  assert.ok(frame.includes('Other'));
  assert.ok(frame.includes('LastFm'));
  assert.ok(frame.includes('Spotify'));
  assert.ok(
    frame.includes('Esc to cancel · ↑/↓ to select · Space/Enter to toggle · Tab to switch tabs'),
  );
  unmount();
});

test('tab switches to the Other placeholder and back', async () => {
  const { stdin, lastFrame, unmount } = render(<ConnectScreen onClose={() => {}} />);
  await tick();

  stdin.write(TAB);
  await tick();
  const otherFrame = lastFrame() ?? '';
  assert.ok(otherFrame.includes('Nothing here yet.'));
  assert.ok(!otherFrame.includes('LastFm'));

  stdin.write(TAB);
  await tick();
  assert.ok((lastFrame() ?? '').includes('LastFm'));
  unmount();
});

test('escape calls onClose', async () => {
  let closed = 0;
  const { stdin, unmount } = render(
    <ConnectScreen
      onClose={() => {
        closed += 1;
      }}
    />,
  );
  await tick();

  stdin.write(ESC);
  await tick();
  assert.equal(closed, 1);
  unmount();
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/App.js';
import { defaultHandler } from '../../src/commands/index.js';

const ESC = '\u001B';

const tick = (ms = 60) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

test('/connect opens the Settings screen; Esc returns a usable prompt and an in-flight connect survives Esc, resuming on reopen', async () => {
  const { stdin, lastFrame, unmount } = render(<App handler={defaultHandler} />);
  await tick();

  stdin.write('/connect');
  await tick();
  stdin.write('\r');
  await tick();

  const settingsFrame = lastFrame() ?? '';
  assert.ok(settingsFrame.includes('Settings'), 'screen replaces the prompt');
  assert.ok(settingsFrame.includes('LastFm'));
  assert.ok(settingsFrame.includes('Esc to cancel'));

  // Toggle LastFm (default stub connector, ~800ms delay) then close immediately —
  // the store lives outside the screen's lifecycle, so the in-flight connect
  // should keep running in the background after Esc.
  stdin.write(' ');
  await tick();

  const connectingFrame = lastFrame() ?? '';
  const connectingRow =
    connectingFrame.split('\n').find((line) => line.includes('LastFm')) ?? '';
  assert.ok(
    !connectingRow.includes('Connect'),
    'connect is still in flight (spinner, not the Connect label) when Esc is pressed',
  );

  stdin.write(ESC);
  await tick();

  const promptFrame = lastFrame() ?? '';
  assert.ok(!promptFrame.includes('Settings'), 'Esc closes the screen');

  // The prompt should be genuinely usable, not just absent of "Settings" text.
  stdin.write('/connect');
  await tick();
  stdin.write('\r');
  await tick();

  // Wait past the 800ms stub connector delay so the background connect settles.
  await tick(900);

  const reopenedFrame = lastFrame() ?? '';
  assert.ok(reopenedFrame.includes('Settings'), 'reopened screen replaces the prompt');
  const lastfmRow = (reopenedFrame.split('\n').find((line) => line.includes('LastFm')) ?? '');
  assert.ok(
    lastfmRow.includes('Connected'),
    'the default connectionStore kept the connect running while the screen was closed',
  );

  stdin.write(ESC);
  await tick();

  const closedAgainFrame = lastFrame() ?? '';
  assert.ok(!closedAgainFrame.includes('Settings'), 'Esc closes the reopened screen');

  stdin.write('hello');
  await tick();
  stdin.write('\r');
  await tick();

  const helloFrame = lastFrame() ?? '';
  assert.ok(
    helloFrame.includes('you typed: hello'),
    'PromptInput is remounted, focused, and its submit path works after Esc',
  );

  unmount();
});

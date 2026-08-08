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

test('/connect opens the Settings screen and Esc returns to the prompt', async () => {
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

  stdin.write(ESC);
  await tick();

  const promptFrame = lastFrame() ?? '';
  assert.ok(!promptFrame.includes('Settings'), 'Esc closes the screen');
  unmount();
});

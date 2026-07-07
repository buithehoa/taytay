import { Writable, PassThrough } from 'node:stream';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { render } from 'ink';
import { PromptInput } from '../../src/components/PromptInput.js';
import { createCommandRegistry } from '../../src/commands/index.js';

class CaptureStream extends Writable {
  columns = 80;
  rows = 24;
  isTTY = false;

  output = '';

  _write(
    chunk: string | Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.output += chunk.toString();
    callback();
  }
}

function makeStdin() {
  const stdin = new PassThrough() as PassThrough & {
    isTTY: boolean;
    ref: () => void;
    unref: () => void;
    setRawMode: (enabled: boolean) => void;
  };
  stdin.isTTY = true;
  stdin.ref = () => {};
  stdin.unref = () => {};
  stdin.setRawMode = () => {};
  return stdin;
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

test('unfocused empty prompt keeps its bordered input height', async () => {
  const stdout = new CaptureStream();
  const stderr = new CaptureStream();
  const instance = render(
    <PromptInput
      isFocused={false}
      onSubmit={() => {}}
      registry={createCommandRegistry()}
    />,
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: makeStdin() as unknown as NodeJS.ReadStream,
      stderr: stderr as unknown as NodeJS.WriteStream,
      debug: true,
      patchConsole: false,
      exitOnCtrlC: false,
    },
  );

  await new Promise((resolve) => {
    setTimeout(resolve, 50);
  });
  const renderedOutput = stdout.output;
  instance.unmount();
  instance.cleanup();

  const visibleLines = stripAnsi(renderedOutput).replace(/\n$/, '').split('\n');

  assert.equal(visibleLines.length, 3);
  assert.match(visibleLines[0], /^─+$/);
  assert.match(visibleLines[1], /^ *$/);
  assert.match(visibleLines[2], /^─+$/);
});

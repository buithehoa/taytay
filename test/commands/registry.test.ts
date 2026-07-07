import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidElement } from 'react';
import { createCommandRegistry, CommandRegistry } from '../../src/commands/index.js';
import type { Command } from '../../src/commands/Command.js';

function makeCommand(name: string): Command {
  return {
    names: [name],
    description: '',
    execute: () => ({ output: name }),
  };
}

test('dispatch runs /echo with its argument', async () => {
  const registry = createCommandRegistry();
  const result = await registry.dispatch('/echo hello');
  assert.ok(isValidElement(result.output));
  if (isValidElement(result.output)) {
    assert.equal((result.output.props as { children: string }).children, 'hello');
  }
});

test('dispatch runs /exit and signals exit', async () => {
  const registry = createCommandRegistry();
  const result = await registry.dispatch('/exit');
  assert.deepEqual(result, { output: '', exit: true });
});

test('dispatch runs /quit as an alias for exit', async () => {
  const registry = createCommandRegistry();
  const result = await registry.dispatch('/quit');
  assert.deepEqual(result, { output: '', exit: true });
});

test('dispatch returns an error for an unknown command', async () => {
  const registry = createCommandRegistry();
  const result = await registry.dispatch('/nonsense');
  assert.deepEqual(result, { output: 'Error: Unknown command: /nonsense' });
});

test('fuzzyMatch with an empty query returns all commands in registration order', () => {
  const registry = createCommandRegistry();
  const names = registry.fuzzyMatch('').map((c) => c.names[0]);
  assert.deepEqual(names, ['exit', 'echo']);
});

test('fuzzyMatch matches a non-contiguous subsequence', () => {
  const registry = new CommandRegistry([makeCommand('editor')]);
  const matches = registry.fuzzyMatch('eio');
  assert.deepEqual(matches.map((c) => c.names[0]), ['editor']);
});

test('fuzzyMatch ranks the tighter match first', () => {
  const registry = new CommandRegistry([makeCommand('editor'), makeCommand('echo')]);
  const matches = registry.fuzzyMatch('eo');
  assert.equal(matches[0].names[0], 'echo');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidElement } from 'react';
import { EchoCommand } from '../../src/commands/EchoCommand.js';

test('EchoCommand echoes the given argument as a Heading element', () => {
  const command = new EchoCommand();
  const result = command.execute('Hello World');
  assert.ok(isValidElement(result.output));
  if (isValidElement(result.output)) {
    assert.equal((result.output.props as { children: string }).children, 'Hello World');
  }
});

test('EchoCommand is registered under the name "echo"', () => {
  const command = new EchoCommand();
  assert.deepEqual(command.names, ['echo']);
});

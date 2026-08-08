#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { defaultHandler } from './commands/index.js';

const { waitUntilExit } = render(<App handler={defaultHandler} />);

waitUntilExit().then(() => {
  process.exit(0);
});

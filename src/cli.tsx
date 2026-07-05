#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { defaultHandler } from './commands/index.js';

render(<App handler={defaultHandler} />);

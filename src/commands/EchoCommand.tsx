import React from 'react';
import { Heading } from '../components/Heading.js';
import { Command, CommandResult } from './Command.js';

export class EchoCommand implements Command {
  names = ['echo'];
  description = 'Print the given text as a heading';

  execute(arg: string): CommandResult {
    return { output: <Heading>{arg}</Heading> };
  }
}

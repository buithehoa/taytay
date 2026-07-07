import { Command, CommandResult } from './Command.js';

export class ExitCommand implements Command {
  names = ['exit', 'quit'];
  description = 'Exit the application';

  execute(): CommandResult {
    return { output: '', exit: true };
  }
}

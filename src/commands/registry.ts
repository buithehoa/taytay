import fuzzysort from 'fuzzysort';
import { Command, CommandResult } from './Command.js';

export class CommandRegistry {
  private commands: Command[];

  constructor(commands: Command[]) {
    this.commands = commands;
  }

  fuzzyMatch(query: string): Command[] {
    if (query === '') {
      return this.commands;
    }

    return this.commands
      .map((command) => ({
        command,
        score: Math.max(
          ...command.names.map((name) => fuzzysort.single(query, name)?.score ?? -Infinity)
        ),
      }))
      .filter(({ score }) => score > -Infinity)
      .sort((a, b) => b.score - a.score)
      .map(({ command }) => command);
  }

  dispatch(line: string): CommandResult | Promise<CommandResult> {
    const withoutSlash = line.slice(1);
    const spaceIndex = withoutSlash.indexOf(' ');
    const name = spaceIndex === -1 ? withoutSlash : withoutSlash.slice(0, spaceIndex);
    const arg = spaceIndex === -1 ? '' : withoutSlash.slice(spaceIndex + 1);
    const command = this.commands.find((c) => c.names.includes(name));
    if (!command) {
      return { output: `Error: Unknown command: /${name}` };
    }
    return command.execute(arg);
  }
}

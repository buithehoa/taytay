import { CommandRegistry } from './registry.js';
import { ExitCommand } from './ExitCommand.js';
import { EchoCommand } from './EchoCommand.js';

export type CommandHandler = (input: string) => string | Promise<string>;

export const defaultHandler: CommandHandler = async (input) => {
  return `you typed: ${input}`;
};

export type { Command, CommandResult } from './Command.js';
export { CommandRegistry } from './registry.js';

export function createCommandRegistry(): CommandRegistry {
  return new CommandRegistry([new ExitCommand(), new EchoCommand()]);
}

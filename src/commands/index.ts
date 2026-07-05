export type CommandHandler = (input: string) => string | Promise<string>;

export const defaultHandler: CommandHandler = async (input) => {
  return `you typed: ${input}`;
};

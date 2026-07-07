import type { ReactNode } from 'react';

export interface CommandResult {
  output: string | ReactNode;
  exit?: boolean;
}

export interface Command {
  names: string[];
  description: string;
  execute(arg: string): CommandResult | Promise<CommandResult>;
}

import type { ComponentType, ReactNode } from 'react';

export interface CommandResult {
  output: string | ReactNode;
  exit?: boolean;
  screen?: ComponentType<{ onClose: () => void }>;
}

export interface Command {
  names: string[];
  description: string;
  execute(arg: string): CommandResult | Promise<CommandResult>;
}

import React from 'react';
import { Box, Text } from 'ink';
import { Command } from '../commands/Command.js';

export const MAX_VISIBLE_MATCHES = 10;

interface CommandDropdownProps {
  matches: Command[];
  focusedIndex: number;
}

export function CommandDropdown({ matches, focusedIndex }: CommandDropdownProps) {
  return (
    <Box flexDirection="column">
      {matches.map((command, index) => (
        <Text key={command.names[0]} inverse={index === focusedIndex}>
          {`/${command.names[0]} — ${command.description}`}
        </Text>
      ))}
    </Box>
  );
}

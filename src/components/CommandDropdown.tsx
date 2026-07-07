import React from 'react';
import { Box, Text } from 'ink';
import { Command } from '../commands/Command.js';

export const MAX_VISIBLE_MATCHES = 5;

interface CommandDropdownProps {
  matches: Command[];
  focusedIndex: number;
}

export function CommandDropdown({ matches, focusedIndex }: CommandDropdownProps) {
  const rows = Array.from({ length: MAX_VISIBLE_MATCHES }, (_, i) => matches[i]);

  return (
    <Box flexDirection="column" height={MAX_VISIBLE_MATCHES}>
      {rows.map((command, index) =>
        command ? (
          <Text key={command.names[0]} inverse={index === focusedIndex}>
            {`/${command.names[0]} — ${command.description}`}
          </Text>
        ) : (
          <Text key={`blank-${index}`}> </Text>
        )
      )}
    </Box>
  );
}

import React from 'react';
import { Text } from 'ink';

export interface HistoryEntry {
  type: 'input' | 'output';
  text: string;
}

interface ScrollbackProps {
  entry: HistoryEntry;
}

export function Scrollback({ entry }: ScrollbackProps) {
  if (entry.type === 'input') {
    return (
      <Text color="cyan">
        {'> '}
        {entry.text}
      </Text>
    );
  }

  const isError = entry.text.startsWith('Error: ');
  return <Text color={isError ? 'red' : undefined}>{entry.text}</Text>;
}

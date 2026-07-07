import React from 'react';
import { Text } from 'ink';

export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Text bold color="yellow">
      {children}
    </Text>
  );
}

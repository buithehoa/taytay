import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { IntegrationTab } from './IntegrationTab.js';
import { OtherTab } from './OtherTab.js';

type TabId = 'integration' | 'other';

interface ConnectScreenProps {
  onClose: () => void;
}

const FOOTER_HINT =
  'Esc to cancel · ↑/↓ to select · Space/Enter to toggle · Tab to switch tabs';

export function ConnectScreen({ onClose }: ConnectScreenProps) {
  const [activeTab, setActiveTab] = useState<TabId>('integration');

  useInput((_input, key) => {
    if (key.escape) {
      onClose();
    } else if (key.tab) {
      setActiveTab((tab) => (tab === 'integration' ? 'other' : 'integration'));
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Box gap={3}>
        <Text bold>Settings</Text>
        <Text
          backgroundColor={activeTab === 'integration' ? 'white' : undefined}
          color={activeTab === 'integration' ? 'black' : undefined}
        >
          {' Integration '}
        </Text>
        <Text
          backgroundColor={activeTab === 'other' ? 'white' : undefined}
          color={activeTab === 'other' ? 'black' : undefined}
        >
          {' Other '}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {activeTab === 'integration' ? <IntegrationTab /> : <OtherTab />}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{FOOTER_HINT}</Text>
      </Box>
    </Box>
  );
}

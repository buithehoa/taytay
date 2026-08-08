import React, { useEffect, useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { ServiceConnector, createStubConnector } from '../services/connectors.js';
import {
  ConnectionStatus,
  ConnectionStore,
  connectionStore,
} from '../services/connectionStore.js';

export interface IntegrationService {
  id: string;
  label: string;
  connector: ServiceConnector;
}

export const INTEGRATION_SERVICES: IntegrationService[] = [
  { id: 'lastfm', label: 'LastFm', connector: createStubConnector() },
  { id: 'spotify', label: 'Spotify', connector: createStubConnector() },
];

const LABEL_COLUMN_WIDTH = 16;

interface IntegrationTabProps {
  services?: IntegrationService[];
  store?: ConnectionStore;
}

function StatusIndicator({ status }: { status: ConnectionStatus }) {
  if (status === 'connecting' || status === 'disconnecting') {
    return (
      <Text>
        <Spinner type="dots" />
      </Text>
    );
  }
  if (status === 'connected') {
    return <Text color="green">Connected</Text>;
  }
  if (status === 'error') {
    return <Text color="red">Connect</Text>;
  }
  return <Text>Connect</Text>;
}

export function IntegrationTab({
  services = INTEGRATION_SERVICES,
  store = connectionStore,
}: IntegrationTabProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => store.subscribe(forceRender), [store]);

  useInput((input, key) => {
    if (key.upArrow) {
      setFocusedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setFocusedIndex((i) => Math.min(services.length - 1, i + 1));
    } else if (key.return || input === ' ') {
      const service = services[focusedIndex];
      store.toggle(service.id, service.connector);
    }
  });

  return (
    <Box flexDirection="column">
      {services.map((service, index) => (
        <Box key={service.id}>
          <Box width={LABEL_COLUMN_WIDTH}>
            <Text color={index === focusedIndex ? 'cyan' : undefined}>
              {index === focusedIndex ? '▸ ' : '  '}
              {service.label}
            </Text>
          </Box>
          <StatusIndicator status={store.getStatus(service.id)} />
        </Box>
      ))}
    </Box>
  );
}

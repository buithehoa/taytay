import type { ServiceConnector } from './connectors.js';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export interface ConnectionStore {
  getStatus(serviceId: string): ConnectionStatus;
  subscribe(listener: () => void): () => void;
  toggle(serviceId: string, connector: ServiceConnector): void;
}

export function createConnectionStore(): ConnectionStore {
  const statuses = new Map<string, ConnectionStatus>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const setStatus = (serviceId: string, status: ConnectionStatus) => {
    statuses.set(serviceId, status);
    notify();
  };

  return {
    getStatus(serviceId) {
      return statuses.get(serviceId) ?? 'disconnected';
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    toggle(serviceId, connector) {
      const status = statuses.get(serviceId) ?? 'disconnected';
      if (status === 'disconnected' || status === 'error') {
        setStatus(serviceId, 'connecting');
        connector.connect().then(
          () => setStatus(serviceId, 'connected'),
          () => setStatus(serviceId, 'error'),
        );
      } else if (status === 'connected') {
        setStatus(serviceId, 'disconnecting');
        connector.disconnect().then(
          () => setStatus(serviceId, 'disconnected'),
          () => setStatus(serviceId, 'error'),
        );
      }
      // status is 'connecting' or 'disconnecting': operation in flight — ignore.
    },
  };
}

export const connectionStore: ConnectionStore = createConnectionStore();

export interface ServiceConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

const DEFAULT_STUB_DELAY_MS = 800;

export function createStubConnector(
  delayMs: number = DEFAULT_STUB_DELAY_MS,
): ServiceConnector {
  const settleAfterDelay = () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });

  return {
    connect: settleAfterDelay,
    disconnect: settleAfterDelay,
  };
}

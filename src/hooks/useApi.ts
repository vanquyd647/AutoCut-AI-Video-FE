import { useState } from 'react';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected request failure';
}

export function useApiAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function execute<T>(work: () => Promise<T>): Promise<T> {
    setPending(true);
    setError(null);
    try {
      return await work();
    } catch (error) {
      const message = toErrorMessage(error);
      setError(message);
      throw error;
    } finally {
      setPending(false);
    }
  }

  return {
    pending,
    error,
    setError,
    execute,
  };
}
import { useEffect, useState } from 'react';

import { connectProgress } from '../services/api';
import type { ProgressUpdate } from '../types';

export function useWebSocket(projectId: string | null) {
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setProgress(null);
      setConnected(false);
      return undefined;
    }

    const socket = connectProgress(projectId);
    socket.addEventListener('open', () => setConnected(true));
    socket.addEventListener('close', () => setConnected(false));
    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data) as ProgressUpdate;
        setProgress(payload);
      } catch {
        setProgress({ stage: 'error', progress: 0, message: 'Invalid progress payload' });
      }
    });

    return () => {
      socket.close();
    };
  }, [projectId]);

  return { progress, connected };
}
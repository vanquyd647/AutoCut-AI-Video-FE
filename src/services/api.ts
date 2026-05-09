import type {
  AnalyzeRequest,
  AnalyzeResponse,
  EditRequest,
  EditResponse,
  HealthResponse,
  UploadResponse,
} from '../types';

const API_BASE = '/api';

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail || `Request failed with status ${response.status}`;
  }

  const detail = await response.text();
  return detail || `Request failed with status ${response.status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function uploadVideos(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as UploadResponse;
}

export function getHealthStatus(): Promise<HealthResponse> {
  return requestJson<HealthResponse>('/health');
}

export function analyzeProject(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
  return requestJson<AnalyzeResponse>('/analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createEdit(payload: EditRequest): Promise<EditResponse> {
  return requestJson<EditResponse>('/edit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getExportUrl(projectId: string): string {
  return `${API_BASE}/export/${projectId}`;
}

export function connectProgress(projectId: string): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/progress/${projectId}`;
  return new WebSocket(wsUrl);
}
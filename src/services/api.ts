import type {
  AnalyzeRequest,
  AnalyzeResponse,
  EditRequest,
  EditResponse,
  HealthResponse,
  UploadResponse,
} from '../types';

const API_BASE = resolveApiBase();

function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!configured) {
    return '/api';
  }
  return configured.replace(/\/+$/, '');
}

function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

function resolveWebSocketBaseUrl(): string {
  if (API_BASE.startsWith('http://') || API_BASE.startsWith('https://')) {
    try {
      const apiUrl = new URL(API_BASE);
      const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${apiUrl.host}`;
    } catch {
      // Fallback to current host when VITE_API_BASE_URL is malformed.
    }
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

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
  const response = await fetch(buildApiUrl(path), {
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

  const response = await fetch(buildApiUrl('/upload'), {
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
  return buildApiUrl(`/export/${projectId}`);
}

export function connectProgress(projectId: string): WebSocket {
  const wsUrl = `${resolveWebSocketBaseUrl()}/ws/progress/${projectId}`;
  return new WebSocket(wsUrl);
}
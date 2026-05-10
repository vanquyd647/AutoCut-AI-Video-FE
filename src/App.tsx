import { startTransition, useEffect, useState } from 'react';

import { ApiKeyInput } from './components/ApiKeyInput';
import { EditPlanView } from './components/EditPlanView';
import { ExportPanel } from './components/ExportPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { ProgressBar } from './components/ProgressBar';
import { StyleSelector } from './components/StyleSelector';
import { Timeline } from './components/Timeline';
import { UploadZone } from './components/UploadZone';
import { VideoPreview } from './components/VideoPreview';
import { useApiAction } from './hooks/useApi';
import { useWebSocket } from './hooks/useWebSocket';
import { analyzeProject, createEdit, createManualEdit, getHealthStatus, uploadVideos } from './services/api';
import type {
  ApiModelOption,
  AspectRatio,
  ClipSegment,
  EditResponse,
  HealthResponse,
  ProjectHistoryItem,
  StyleKey,
  UploadResponse,
  VideoAnalysis,
} from './types';

const STORAGE_KEY = 'autocut-gemini-api-key';
function buildClipIdentity(clip: ClipSegment, index: number): string {
  return `${index}::${clip.source_video}::${clip.start}::${clip.end}::${clip.rationale}`;
}
const MODEL_STORAGE_KEY = 'autocut-gemini-model';
const HISTORY_STORAGE_KEY = 'autocut-project-history-v1';

const STEP_LABELS = ['Upload', 'Analyze', 'Export'];

const MODEL_OPTIONS: ApiModelOption[] = [
  { value: 'gemini-2.5-flash', label: '2.5 Flash (Stable)' },
  { value: 'gemini-3.0-preview', label: '3.0 Preview (Experimental)' },
  { value: 'gemini-3.1-flash-lite-preview', label: '3.1 Flash Lite Preview (Preview)' },
  { value: 'gemma-4-31b', label: 'Gemma 4 31B (Gemini API)' },
  { value: 'gemma-4-26b-a4b', label: 'Gemma 4 26B A4B (Gemini API)' },
];

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) {
    return items;
  }
  next.splice(toIndex, 0, moved);
  return next;
}

function normalizeAnalyses(payload: unknown): VideoAnalysis[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.filter(
    (item): item is VideoAnalysis =>
      Boolean(item) && typeof item === 'object' && typeof (item as { video_name?: unknown }).video_name === 'string',
  );
}

function loadHistory(): ProjectHistoryItem[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ProjectHistoryItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => typeof item?.project_id === 'string');
  } catch {
    return [];
  }
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => window.localStorage.getItem(STORAGE_KEY) ?? '');
  const [selectedModel, setSelectedModel] = useState(() => window.localStorage.getItem(MODEL_STORAGE_KEY) ?? MODEL_OPTIONS[0].value);
  const [history, setHistory] = useState<ProjectHistoryItem[]>(() => loadHistory());
  const [files, setFiles] = useState<File[]>([]);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [analyses, setAnalyses] = useState<VideoAnalysis[]>([]);
  const [analysisCompleted, setAnalysisCompleted] = useState(false);
  const [editResult, setEditResult] = useState<EditResponse | null>(null);
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [style, setStyle] = useState<StyleKey>('tiktok');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [targetDuration, setTargetDuration] = useState(30);
  const { execute, pending, error, setError } = useApiAction();

  const projectId = uploadResult?.project_id ?? null;
  const { progress, connected } = useWebSocket(projectId);
  const currentStep = editResult ? 3 : analysisCompleted ? 2 : uploadResult ? 1 : 0;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, apiKey);
  }, [apiKey]);

  useEffect(() => {
    window.localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const health = await getHealthStatus();
        if (!cancelled) {
          setBackendHealth(health);
          setHealthError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setBackendHealth(null);
          setHealthError(error instanceof Error ? error.message : 'Unable to reach backend health endpoint.');
        }
      }
    }

    void loadHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUpload() {
    if (files.length === 0) {
      setError('Select at least one video before uploading.');
      return;
    }

    try {
      const result = await execute(() => uploadVideos(files));
      const now = new Date().toISOString();
      startTransition(() => {
        setUploadResult(result);
        setAnalyses([]);
        setAnalysisCompleted(false);
        setEditResult(null);
        setHistory((previous) => {
          const next: ProjectHistoryItem = {
            id: result.project_id,
            project_id: result.project_id,
            model: selectedModel,
            style,
            aspect_ratio: aspectRatio,
            target_duration: targetDuration,
            status: 'uploaded',
            updated_at: now,
          };
          return [next, ...previous.filter((item) => item.project_id !== result.project_id)].slice(0, 20);
        });
      });
    } catch {
      return;
    }
  }

  async function handleAnalyze() {
    if (!projectId) {
      setError('Upload the source clips before starting analysis.');
      return;
    }

    try {
      const result = await execute(() =>
        analyzeProject({
          project_id: projectId,
          api_key: apiKey || undefined,
          model: selectedModel,
        }),
      );
      const nextAnalyses = normalizeAnalyses((result as { analyses?: unknown }).analyses);
      const now = new Date().toISOString();
      startTransition(() => {
        setAnalyses(nextAnalyses);
        setAnalysisCompleted(true);
        setEditResult(null);
        setHistory((previous) =>
          previous.map((item) =>
            item.project_id === projectId ? { ...item, status: 'analyzed', model: selectedModel, updated_at: now } : item,
          ),
        );
      });
    } catch (failure) {
      setAnalysisCompleted(false);
      const message = failure instanceof Error ? failure.message : 'Analyze failed';
      const now = new Date().toISOString();
      setHistory((previous) =>
        previous.map((item) =>
          item.project_id === projectId ? { ...item, status: 'failed', updated_at: now, error: message } : item,
        ),
      );
      return;
    }
  }

  async function handleCreateEdit() {
    if (!projectId) {
      setError('Upload and analyze the project before rendering.');
      return;
    }
    if (!analysisCompleted) {
      setError('Analysis data is still missing. Run the analyze step first.');
      return;
    }

    try {
      const result = await execute(() =>
        createEdit({
          project_id: projectId,
          api_key: apiKey || undefined,
          model: selectedModel,
          style,
          target_duration: targetDuration,
          aspect_ratio: aspectRatio,
        }),
      );
      const now = new Date().toISOString();
      startTransition(() => {
        setEditResult(result);
        setHistory((previous) =>
          previous.map((item) =>
            item.project_id === projectId
              ? {
                  ...item,
                  status: 'rendered',
                  model: selectedModel,
                  style,
                  aspect_ratio: aspectRatio,
                  target_duration: targetDuration,
                  output_video_url: result.output_video_url,
                  updated_at: now,
                  error: undefined,
                }
              : item,
          ),
        );
      });
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Render failed';
      const now = new Date().toISOString();
      setHistory((previous) =>
        previous.map((item) =>
          item.project_id === projectId ? { ...item, status: 'failed', updated_at: now, error: message } : item,
        ),
      );
      return;
    }
  }

  function handleMoveClip(fromIndex: number, toIndex: number) {
    setEditResult((previous) => {
      if (!previous) {
        return previous;
      }

      const clipCount = previous.plan.clips.length;
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= clipCount ||
        toIndex >= clipCount ||
        fromIndex === toIndex
      ) {
        return previous;
      }

      const originalIdentity = previous.plan.clips.map((clip, index) => buildClipIdentity(clip, index));
      const movedClips = moveItem(previous.plan.clips, fromIndex, toIndex).map((clip, index) => ({
        ...clip,
        order: index,
      }));
      const movedIdentity = movedClips.map((clip, index) => buildClipIdentity(clip, index));
      const oldToNewIndex = new Map<number, number>();

      originalIdentity.forEach((identity, oldIndex) => {
        const newIndex = movedIdentity.indexOf(identity);
        if (newIndex >= 0) {
          oldToNewIndex.set(oldIndex, newIndex);
        }
      });

      const remapIndex = (value: number) => oldToNewIndex.get(value) ?? value;

      return {
        ...previous,
        plan: {
          ...previous.plan,
          clips: movedClips,
          transitions: previous.plan.transitions.map((transition) => ({
            ...transition,
            at_clip_index: remapIndex(transition.at_clip_index),
          })),
          speed_effects: previous.plan.speed_effects.map((effect) => ({
            ...effect,
            clip_index: remapIndex(effect.clip_index),
          })),
        },
      };
    });
  }

  async function handleRenderManualTimeline() {
    if (!projectId || !editResult) {
      setError('Create an edit plan before rendering a manual timeline.');
      return;
    }

    try {
      const result = await execute(() =>
        createManualEdit({
          project_id: projectId,
          plan: editResult.plan,
        }),
      );
      const now = new Date().toISOString();
      startTransition(() => {
        setEditResult(result);
        setHistory((previous) =>
          previous.map((item) =>
            item.project_id === projectId
              ? {
                  ...item,
                  status: 'rendered',
                  output_video_url: result.output_video_url,
                  updated_at: now,
                  error: undefined,
                }
              : item,
          ),
        );
      });
    } catch {
      return;
    }
  }

  function handleStyleSelect(nextStyle: StyleKey, nextAspectRatio: AspectRatio, nextDuration: number) {
    setStyle(nextStyle);
    setAspectRatio(nextAspectRatio);
    setTargetDuration(nextDuration);
  }

  const renderBlocked = backendHealth !== null && !backendHealth.ffmpeg_available;
  const heroCapabilities = [
    {
      label: 'Backend',
      value: backendHealth?.status === 'ok' ? 'Online' : 'Starting',
      detail: renderBlocked ? 'FFmpeg missing' : backendHealth?.gemini_model ?? 'Ready',
    },
    {
      label: 'Progress',
      value: connected ? 'Live WS' : 'Idle',
      detail: progress?.stage ?? 'Waiting',
    },
    {
      label: 'History',
      value: `${history.length}`,
      detail: history.length === 1 ? 'Saved project' : 'Saved projects',
    },
    {
      label: 'Timeline',
      value: editResult ? 'Editable' : 'Ready',
      detail: editResult ? 'Drag clips to reorder' : 'Analyze to unlock',
    },
  ];

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="hero-panel panel">
        <div className="hero-copy">
          <span className="eyebrow">Gemini AI + FastAPI + FFmpeg</span>
          <h1>AutoCut AI Video</h1>
          <p>
            Upload raw footage, let the backend analyze scene rhythm, then render an edit plan tuned for
            TikTok, YouTube, or Instagram.
          </p>
          <div className="hero-capabilities">
            {heroCapabilities.map((item) => (
              <article key={item.label} className="hero-capability">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>
        </div>
        <div className="hero-metrics">
          <article>
            <span>Mode</span>
            <strong>{style}</strong>
          </article>
          <article>
            <span>Canvas</span>
            <strong>{aspectRatio}</strong>
          </article>
          <article>
            <span>Target</span>
            <strong>{targetDuration}s</strong>
          </article>
        </div>
      </header>

      <main className="workspace-grid">
        <section className="panel control-panel">
          <ApiKeyInput value={apiKey} onChange={setApiKey} />
          <StyleSelector selected={style} onSelect={handleStyleSelect} />

          <section className="stack-block">
            <div className="section-heading inline-heading">
              <div>
                <span className="section-kicker">Output Settings</span>
                <h2>Duration and aspect</h2>
              </div>
            </div>
            <div className="settings-grid">
              <label className="field-shell">
                <span>API model</span>
                <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-shell">
                <span>Aspect ratio</span>
                <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as AspectRatio)}>
                  <option value="9:16">9:16</option>
                  <option value="16:9">16:9</option>
                  <option value="1:1">1:1</option>
                </select>
              </label>
              <label className="field-shell">
                <span>Target duration (seconds)</span>
                <input
                  type="number"
                  min={10}
                  max={180}
                  value={targetDuration}
                  onChange={(event) => setTargetDuration(Number(event.target.value) || 10)}
                />
              </label>
            </div>
          </section>

          <UploadZone
            files={files}
            onFilesChange={setFiles}
            onUpload={handleUpload}
            pending={pending}
            uploaded={Boolean(uploadResult)}
          />

          <section className="stack-block">
            {healthError ? <div className="error-banner">Backend health check failed: {healthError}</div> : null}
            {renderBlocked ? (
              <div className="error-banner">
                Render is disabled because FFmpeg is not available on the backend server. Install FFmpeg and restart the API.
              </div>
            ) : null}
            <div className="action-row">
              <button type="button" className="secondary-button" onClick={handleAnalyze} disabled={pending || !projectId}>
                Analyze project
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleCreateEdit}
                disabled={pending || !projectId || !analysisCompleted || renderBlocked}
              >
                Render edit
              </button>
            </div>
            {editResult ? (
              <button type="button" className="secondary-button" onClick={handleRenderManualTimeline} disabled={pending || renderBlocked}>
                Render reordered timeline
              </button>
            ) : null}
            {error ? <div className="error-banner">{error}</div> : null}
          </section>

          <ProgressBar progress={progress} connected={connected} />
        </section>

        <section className="panel main-panel">
          <section className="stack-block">
            <div className="section-heading inline-heading">
              <div>
                <span className="section-kicker">Workflow</span>
                <h2>Three-step pipeline</h2>
              </div>
            </div>
            <div className="step-row">
              {STEP_LABELS.map((label, index) => {
                const active = currentStep >= index + 1;
                return (
                  <div key={label} className={`step-pill ${active ? 'is-active' : ''}`}>
                    <span>{index + 1}</span>
                    <strong>{label}</strong>
                  </div>
                );
              })}
            </div>
          </section>

          <VideoPreview files={files} videos={uploadResult?.videos ?? []} analyses={analyses} />
          <Timeline plan={editResult?.plan ?? null} onMoveClip={handleMoveClip} />
        </section>

        <section className="panel side-panel">
          <EditPlanView plan={editResult?.plan ?? null} />
          <ExportPanel outputUrl={editResult?.output_video_url ?? null} projectId={projectId} />
          <HistoryPanel items={history} models={MODEL_OPTIONS} />
        </section>
      </main>
    </div>
  );
}
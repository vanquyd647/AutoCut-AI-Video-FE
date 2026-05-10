import { startTransition, useEffect, useState } from 'react';

import { ApiKeyInput } from './components/ApiKeyInput';
import { EditPlanView } from './components/EditPlanView';
import { ExportPanel } from './components/ExportPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { ProgressBar } from './components/ProgressBar';
import { SceneDetectionPanel } from './components/SceneDetectionPanel';
import { StyleSelector } from './components/StyleSelector';
import { Timeline } from './components/Timeline';
import { TranscriptionPanel } from './components/TranscriptionPanel';
import { UploadZone } from './components/UploadZone';
import { VideoPreview } from './components/VideoPreview';
import { useApiAction } from './hooks/useApi';
import { useWebSocket } from './hooks/useWebSocket';
import { analyzeProject, createEdit, createManualEdit, detectScenes, getHealthStatus, transcribeVideo, uploadVideos } from './services/api';
import type {
  ApiModelOption,
  AspectRatio,
  ClipSegment,
  EditPlan,
  EditResponse,
  HealthResponse,
  ProjectHistoryItem,
  SceneDetectionResponse,
  StyleKey,
  TranscriptionResponse,
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

function normalizeSnippet(text: string, maxLength = 72): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return '';
  }
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 3))}...`;
}

interface StyleTimelineConfig {
  preferredClipSeconds: number;
  minClipSeconds: number;
  maxClipSeconds: number;
  transitionCycle: Array<{ type: string; duration: number }>;
  overlayAnimation: 'fade' | 'typewriter' | 'slide_up';
  musicSuggestion: string;
  speechWeight: number;
  earlyWeight: number;
}

interface CandidateSceneClip extends ClipSegment {
  duration: number;
  score: number;
}

const STYLE_TIMELINE_CONFIG: Record<StyleKey, StyleTimelineConfig> = {
  tiktok: {
    preferredClipSeconds: 1.6,
    minClipSeconds: 0.7,
    maxClipSeconds: 3.2,
    transitionCycle: [
      { type: 'cut', duration: 0.08 },
      { type: 'slide_left', duration: 0.18 },
      { type: 'cut', duration: 0.1 },
      { type: 'zoom_in', duration: 0.16 },
    ],
    overlayAnimation: 'typewriter',
    musicSuggestion: 'Fast punchy beat with strong drops for hook-first pacing',
    speechWeight: 4.2,
    earlyWeight: 1.8,
  },
  youtube: {
    preferredClipSeconds: 3.5,
    minClipSeconds: 1.4,
    maxClipSeconds: 6,
    transitionCycle: [
      { type: 'cross_dissolve', duration: 0.34 },
      { type: 'fade', duration: 0.28 },
      { type: 'cross_dissolve', duration: 0.3 },
    ],
    overlayAnimation: 'fade',
    musicSuggestion: 'Steady cinematic groove with room for dialogue moments',
    speechWeight: 3.4,
    earlyWeight: 0.8,
  },
  instagram: {
    preferredClipSeconds: 2.4,
    minClipSeconds: 0.9,
    maxClipSeconds: 4,
    transitionCycle: [
      { type: 'fade', duration: 0.2 },
      { type: 'slide_right', duration: 0.22 },
      { type: 'cross_dissolve', duration: 0.24 },
    ],
    overlayAnimation: 'slide_up',
    musicSuggestion: 'Polished lifestyle beat with smooth accents between looks',
    speechWeight: 3.8,
    earlyWeight: 1.2,
  },
};

function overlapDuration(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function candidateKey(clip: CandidateSceneClip): string {
  return `${clip.source_video}::${clip.start.toFixed(3)}::${clip.end.toFixed(3)}`;
}

function buildSceneDrivenPlan(
  videos: UploadResponse['videos'],
  sceneDetectionResult: SceneDetectionResponse,
  transcriptions: Record<string, TranscriptionResponse>,
  style: StyleKey,
  aspectRatio: AspectRatio,
  targetDuration: number,
): EditPlan | null {
  const config = STYLE_TIMELINE_CONFIG[style];
  const discoveredClips: CandidateSceneClip[] = [];

  for (const video of videos) {
    const sceneResult = sceneDetectionResult.scenes[video.stored_name];
    if (!sceneResult || sceneResult.scenes.length === 0) {
      continue;
    }

    const starts = Array.from(
      new Set(sceneResult.scenes.map((scene) => Math.max(0, scene.timestamp_ms / 1000))),
    ).sort((a, b) => a - b);

    if (starts.length === 0 || starts[0] > 0.05) {
      starts.unshift(0);
    }

    const videoDuration = Math.max(video.duration_seconds ?? 0, starts[starts.length - 1] ?? 0, 1);
    if (starts[starts.length - 1] < videoDuration - 0.05) {
      starts.push(videoDuration);
    }
    const transcriptSegments = transcriptions[video.name]?.transcription.segments ?? [];

    for (let index = 0; index < starts.length - 1; index += 1) {
      const start = starts[index];
      const rawEnd = starts[index + 1] ?? videoDuration;
      const end = Math.min(videoDuration, Math.max(start + 0.35, rawEnd));
      const duration = end - start;
      if (duration < 0.35) {
        continue;
      }

      const overlappingSpeech = transcriptSegments.filter(
        (segment) => overlapDuration(start, end, segment.start, segment.end) > 0 && segment.text.trim().length > 0,
      );

      const speechSeconds = overlappingSpeech.reduce(
        (sum, segment) => sum + overlapDuration(start, end, segment.start, segment.end),
        0,
      );
      const speechDensity = duration > 0 ? speechSeconds / duration : 0;
      const speechSnippet = normalizeSnippet(overlappingSpeech[0]?.text ?? '', 56);

      const positionRatio = videoDuration > 0 ? start / videoDuration : 0;
      const earlyPriority = 1 - Math.min(1, Math.max(0, positionRatio));
      const lengthBias = Math.min(duration, config.maxClipSeconds) / Math.max(config.maxClipSeconds, 0.01);
      const score = speechDensity * config.speechWeight + earlyPriority * config.earlyWeight + lengthBias * 0.65 + (speechSnippet ? 0.9 : 0);

      const rationale = speechSnippet
        ? `Scene + speech: "${speechSnippet}"`
        : `Scene boundary at ${start.toFixed(1)}s`;

      discoveredClips.push({
        source_video: video.name,
        start,
        end,
        duration,
        score,
        order: 0,
        rationale,
      });
    }
  }

  if (discoveredClips.length === 0) {
    return null;
  }

  const targetSeconds = Math.max(6, targetDuration);

  const byVideo = new Map<string, CandidateSceneClip[]>();
  for (const clip of discoveredClips) {
    const bucket = byVideo.get(clip.source_video);
    if (bucket) {
      bucket.push(clip);
    } else {
      byVideo.set(clip.source_video, [clip]);
    }
  }
  for (const bucket of byVideo.values()) {
    bucket.sort((a, b) => b.score - a.score || a.start - b.start);
  }

  const selected = new Map<string, CandidateSceneClip>();
  for (const bucket of byVideo.values()) {
    const seed = bucket[0];
    if (seed) {
      selected.set(candidateKey(seed), seed);
    }
  }

  const sortedByScore = [...discoveredClips].sort((a, b) => b.score - a.score || a.start - b.start);
  const maxClipCount = Math.min(
    discoveredClips.length,
    Math.max(3, Math.ceil(targetSeconds / Math.max(0.1, config.preferredClipSeconds)) + 2),
  );

  for (const candidate of sortedByScore) {
    if (selected.size >= maxClipCount) {
      break;
    }
    const key = candidateKey(candidate);
    if (selected.has(key)) {
      continue;
    }

    selected.set(key, candidate);
    const selectedDuration = [...selected.values()].reduce((sum, clip) => sum + clip.duration, 0);
    if (selectedDuration >= targetSeconds * 1.15 && selected.size >= 2) {
      break;
    }
  }

  const orderedSelected = [...selected.values()];
  if (style === 'tiktok') {
    orderedSelected.sort((a, b) => b.score - a.score || a.start - b.start);
  } else if (style === 'youtube') {
    orderedSelected.sort((a, b) => a.source_video.localeCompare(b.source_video) || a.start - b.start);
  } else {
    orderedSelected.sort((a, b) => a.start - b.start || b.score - a.score);
  }

  const normalizedClips: CandidateSceneClip[] = [];
  let remaining = targetSeconds;

  for (let index = 0; index < orderedSelected.length; index += 1) {
    const clip = orderedSelected[index];
    if (remaining <= 0.01) {
      break;
    }

    const slotsLeft = orderedSelected.length - index - 1;
    const minForRest = slotsLeft * config.minClipSeconds;
    const maxAllowed = Math.max(config.minClipSeconds, remaining - minForRest);

    let take = Math.min(clip.duration, config.maxClipSeconds, maxAllowed);
    if (take < 0.35) {
      continue;
    }

    if (take < config.minClipSeconds && clip.duration >= config.minClipSeconds) {
      take = Math.min(clip.duration, Math.max(config.minClipSeconds, maxAllowed));
    }

    const trimmedEnd = Math.min(clip.end, clip.start + take);
    const trimmedDuration = trimmedEnd - clip.start;
    if (trimmedDuration < 0.35) {
      continue;
    }

    normalizedClips.push({
      ...clip,
      end: trimmedEnd,
      duration: trimmedDuration,
      order: normalizedClips.length,
      rationale: trimmedDuration < clip.duration - 0.05 ? `${clip.rationale} (trimmed to fit target)` : clip.rationale,
    });
    remaining -= trimmedDuration;
  }

  if (normalizedClips.length === 0) {
    const first = orderedSelected[0] ?? discoveredClips[0];
    normalizedClips.push({
      ...first,
      end: Math.min(first.end, first.start + Math.max(1, Math.min(config.maxClipSeconds, targetSeconds))),
      duration: Math.min(first.duration, Math.max(1, Math.min(config.maxClipSeconds, targetSeconds))),
      order: 0,
    });
  }

  const transitions = normalizedClips.slice(0, -1).map((_, index) => {
    const transition = config.transitionCycle[index % config.transitionCycle.length];
    return {
      at_clip_index: index,
      type: transition.type,
      duration: transition.duration,
    };
  });

  const overlays: EditPlan['text_overlays'] = [];
  let timelineCursor = 0;
  for (const clip of normalizedClips) {
    const clipDuration = clip.end - clip.start;
    if (clipDuration <= 0.35) {
      timelineCursor += Math.max(0, clipDuration);
      continue;
    }

    const transcript = transcriptions[clip.source_video]?.transcription.segments ?? [];
    const spokenSegment = transcript.find(
      (segment) =>
        segment.text.trim().length > 0 &&
        overlapDuration(clip.start, clip.end, segment.start, segment.end) >= Math.min(0.25, clipDuration * 0.5),
    );

    if (spokenSegment) {
      const overlayText = normalizeSnippet(spokenSegment.text, 42);
      const overlayStart = timelineCursor + Math.min(0.35, clipDuration * 0.22);
      const overlayDuration = Math.min(2.8, Math.max(1.1, clipDuration * 0.62));
      const overlayEnd = Math.min(timelineCursor + clipDuration - 0.1, overlayStart + overlayDuration);
      if (overlayText && overlayEnd > overlayStart + 0.2) {
        overlays.push({
          text: overlayText,
          start: Number(overlayStart.toFixed(2)),
          end: Number(overlayEnd.toFixed(2)),
          position: 'bottom-center',
          animation: config.overlayAnimation,
        });
      }
    }

    timelineCursor += clipDuration;
    if (overlays.length >= 5) {
      break;
    }
  }

  const finalClips: ClipSegment[] = normalizedClips.map((clip, index) => ({
    source_video: clip.source_video,
    start: clip.start,
    end: clip.end,
    order: index,
    rationale: clip.rationale,
  }));

  return {
    style,
    aspect_ratio: aspectRatio,
    target_duration: targetDuration,
    clips: finalClips,
    transitions,
    text_overlays: overlays,
    color_grading: [{ preset: style === 'youtube' ? 'cinematic' : 'vibrant' }],
    speed_effects: [],
    music_suggestion: config.musicSuggestion,
  };
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
  const [sceneDetectionResult, setSceneDetectionResult] = useState<SceneDetectionResponse | null>(null);
  const [transcriptions, setTranscriptions] = useState<Record<string, TranscriptionResponse>>({});
  const [transcribingVideos, setTranscribingVideos] = useState<Set<string>>(new Set());
  const [draftPlan, setDraftPlan] = useState<EditPlan | null>(null);
  const { execute, pending, error, setError } = useApiAction();

  const projectId = uploadResult?.project_id ?? null;
  const { progress, connected } = useWebSocket(projectId);
  const activePlan = editResult?.plan ?? draftPlan;
  const currentStep = editResult ? 3 : activePlan || analysisCompleted ? 2 : uploadResult ? 1 : 0;

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
        setDraftPlan(null);
        setSceneDetectionResult(null);
        setTranscriptions({});
        setTranscribingVideos(new Set());
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

  function handleBuildTimelineFromScenes() {
    if (!uploadResult || !sceneDetectionResult) {
      setError('Upload clips and run scene detection before building a scene-driven timeline.');
      return;
    }

    const generatedPlan = buildSceneDrivenPlan(
      uploadResult.videos,
      sceneDetectionResult,
      transcriptions,
      style,
      aspectRatio,
      targetDuration,
    );

    if (!generatedPlan) {
      setError('No usable scene boundaries were detected. Try another clip or run Analyze project.');
      return;
    }

    startTransition(() => {
      setDraftPlan(generatedPlan);
      setEditResult(null);
      setError(null);
    });
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
        setDraftPlan(null);
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

  async function handleDetectScenes() {
    if (!projectId) {
      setError('Upload the source clips before detecting scenes.');
      return;
    }

    try {
      const result = await execute(() => detectScenes(projectId));
      startTransition(() => {
        setSceneDetectionResult(result);
      });
    } catch {
      return;
    }
  }

  async function handleTranscribeVideo(videoName: string) {
    if (!projectId) {
      setError('Upload the source clips before transcribing.');
      return;
    }

    setTranscribingVideos((prev) => new Set([...prev, videoName]));

    try {
      const result = await execute(() => transcribeVideo(projectId, videoName));
      startTransition(() => {
        setTranscriptions((previous) => ({
          ...previous,
          [videoName]: result,
        }));
      });
    } catch {
      return;
    } finally {
      setTranscribingVideos((prev) => {
        const next = new Set(prev);
        next.delete(videoName);
        return next;
      });
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
    const remapPlan = (plan: EditPlan): EditPlan => {
      const clipCount = plan.clips.length;
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= clipCount ||
        toIndex >= clipCount ||
        fromIndex === toIndex
      ) {
        return plan;
      }

      const originalIdentity = plan.clips.map((clip, index) => buildClipIdentity(clip, index));
      const movedClips = moveItem(plan.clips, fromIndex, toIndex).map((clip, index) => ({
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
        ...plan,
        clips: movedClips,
        transitions: plan.transitions.map((transition) => ({
          ...transition,
          at_clip_index: remapIndex(transition.at_clip_index),
        })),
        speed_effects: plan.speed_effects.map((effect) => ({
          ...effect,
          clip_index: remapIndex(effect.clip_index),
        })),
      };
    };

    if (editResult) {
      setEditResult((previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          plan: remapPlan(previous.plan),
        };
      });
      return;
    }

    setDraftPlan((previous) => (previous ? remapPlan(previous) : previous));
  }

  async function handleRenderManualTimeline() {
    if (!projectId || !activePlan) {
      setError('Create an edit plan before rendering a manual timeline.');
      return;
    }

    try {
      const result = await execute(() =>
        createManualEdit({
          project_id: projectId,
          plan: activePlan,
        }),
      );
      const now = new Date().toISOString();
      startTransition(() => {
        setEditResult(result);
        setDraftPlan(null);
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
      value: activePlan ? 'Editable' : 'Ready',
      detail: activePlan ? 'Drag clips to reorder' : 'Analyze to unlock',
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
            {activePlan ? (
              <button type="button" className="secondary-button" onClick={handleRenderManualTimeline} disabled={pending || renderBlocked}>
                {editResult ? 'Render reordered timeline' : 'Render scene-based timeline'}
              </button>
            ) : null}
            {projectId && !sceneDetectionResult ? (
              <button type="button" className="secondary-button" onClick={handleDetectScenes} disabled={pending}>
                Detect scenes
              </button>
            ) : null}
            {projectId && sceneDetectionResult ? (
              <button type="button" className="secondary-button" onClick={handleBuildTimelineFromScenes} disabled={pending}>
                {draftPlan ? 'Rebuild timeline from scenes' : 'Build timeline from scenes'}
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

          <VideoPreview 
            files={files} 
            videos={uploadResult?.videos ?? []} 
            analyses={analyses}
            onTranscribe={handleTranscribeVideo}
            transcribingVideos={transcribingVideos}
          />
          <Timeline plan={activePlan ?? null} onMoveClip={handleMoveClip} />
        </section>

        <section className="panel side-panel">
          <SceneDetectionPanel scenes={sceneDetectionResult} loading={pending && !sceneDetectionResult} />
          <TranscriptionPanel transcriptions={transcriptions} />
          <EditPlanView plan={activePlan ?? null} />
          <ExportPanel outputUrl={editResult?.output_video_url ?? null} projectId={projectId} />
          <HistoryPanel items={history} models={MODEL_OPTIONS} />
        </section>
      </main>
    </div>
  );
}
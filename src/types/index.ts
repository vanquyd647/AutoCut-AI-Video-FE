export type StyleKey = 'tiktok' | 'youtube' | 'instagram';
export type AspectRatio = '9:16' | '16:9' | '1:1';

export interface VideoInfo {
  name: string;
  stored_name: string;
  path: string;
  size_bytes: number;
  duration_seconds?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface Scene {
  start: number;
  end: number;
  description: string;
  mood: string;
  quality_score: number;
}

export interface Highlight {
  timestamp: number;
  reason: string;
  confidence: number;
}

export interface VideoAnalysis {
  video_name: string;
  scenes: Scene[];
  highlights: Highlight[];
  pacing: string;
  color_mood: string;
  audio_energy: string;
  suggested_cuts: number[];
  content_type: string;
  summary: string;
}

export interface ClipSegment {
  source_video: string;
  start: number;
  end: number;
  order: number;
  rationale: string;
}

export interface TransitionSpec {
  at_clip_index: number;
  type: string;
  duration: number;
}

export interface TextOverlay {
  text: string;
  start: number;
  end: number;
  position: string;
  animation: string;
}

export interface ColorGrade {
  preset: string;
}

export interface SpeedEffect {
  clip_index: number;
  rate: number;
  start: number;
  end: number;
}

export interface EditPlan {
  style: StyleKey;
  aspect_ratio: AspectRatio;
  target_duration: number;
  clips: ClipSegment[];
  transitions: TransitionSpec[];
  text_overlays: TextOverlay[];
  color_grading: ColorGrade[];
  speed_effects: SpeedEffect[];
  music_suggestion: string;
}

export interface UploadResponse {
  project_id: string;
  videos: VideoInfo[];
}

export interface AnalyzeRequest {
  project_id: string;
  api_key?: string;
  model?: string;
}

export interface AnalyzeResponse {
  analyses: VideoAnalysis[];
}

export interface EditRequest {
  project_id: string;
  api_key?: string;
  style: StyleKey;
  target_duration: number;
  aspect_ratio: AspectRatio;
  model?: string;
}

export interface ManualEditRequest {
  project_id: string;
  plan: EditPlan;
}

export interface EditResponse {
  plan: EditPlan;
  output_video_url: string;
  progress_ws_url: string;
}

export interface ProgressUpdate {
  stage: string;
  progress: number;
  message: string;
}

export interface HealthResponse {
  status: string;
  ffmpeg_available: boolean;
  gemini_model: string;
}

export interface ApiModelOption {
  value: string;
  label: string;
}

export type ProjectHistoryStatus = 'uploaded' | 'analyzed' | 'rendered' | 'failed';

export interface ProjectHistoryItem {
  id: string;
  project_id: string;
  model: string;
  style: StyleKey;
  aspect_ratio: AspectRatio;
  target_duration: number;
  status: ProjectHistoryStatus;
  updated_at: string;
  output_video_url?: string;
  error?: string;
}
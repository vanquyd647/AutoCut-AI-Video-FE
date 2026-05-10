import { useEffect, useState } from 'react';

import type { VideoAnalysis, VideoInfo } from '../types';

interface VideoPreviewProps {
  files: File[];
  videos: VideoInfo[];
  analyses: VideoAnalysis[];
  onTranscribe?: (videoName: string) => void;
  transcribingVideos?: Set<string>;
}

export function VideoPreview({ files, videos, analyses, onTranscribe, transcribingVideos }: VideoPreviewProps) {
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextEntries = files.map((file) => [file.name, URL.createObjectURL(file)] as const);
    setPreviews(Object.fromEntries(nextEntries));
    return () => {
      nextEntries.forEach(([, url]) => URL.revokeObjectURL(url));
    };
  }, [files]);

  return (
    <section className="stack-block">
      <div className="section-heading inline-heading">
        <div>
          <span className="section-kicker">Clip Review</span>
          <h2>Uploaded footage</h2>
        </div>
        <span className="pill-pill">{videos.length} clips</span>
      </div>
      <div className="preview-grid">
        {videos.length === 0 ? <p className="placeholder-copy">Upload clips to inspect them here.</p> : null}
        {videos.map((video) => {
          const analysis = analyses.find((item) => item.video_name === video.name);
          const previewUrl = previews[video.name];
          const isTranscribing = transcribingVideos?.has(video.name) ?? false;
          return (
            <article key={video.stored_name} className="preview-card">
              <div className="preview-media-frame">
                {previewUrl ? <video src={previewUrl} controls muted playsInline /> : <div className="preview-placeholder" />}
              </div>
              <div className="preview-meta">
                <h3>{video.name}</h3>
                <span>{Math.max(video.size_bytes / 1024 / 1024, 0.1).toFixed(1)} MB</span>
              </div>
              <div className="preview-badges">
                <span className="chip">{analysis ? 'Analyzed' : 'Pending analysis'}</span>
                {video.duration_seconds ? <span className="chip">{video.duration_seconds.toFixed(1)}s</span> : null}
                {video.width && video.height ? <span className="chip">{video.width}×{video.height}</span> : null}
              </div>
              {analysis ? (
                <div className="analysis-chip-grid">
                  <span>{analysis.content_type}</span>
                  <span>{analysis.pacing}</span>
                  <span>{analysis.color_mood}</span>
                </div>
              ) : (
                <p className="placeholder-copy">Run analyze to generate scene tags, pacing hints, and cut suggestions.</p>
              )}
              {onTranscribe && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onTranscribe(video.name)}
                  disabled={isTranscribing}
                >
                  {isTranscribing ? 'Transcribing...' : 'Transcribe audio'}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
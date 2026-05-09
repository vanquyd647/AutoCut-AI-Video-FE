import { useEffect, useState } from 'react';

import type { VideoAnalysis, VideoInfo } from '../types';

interface VideoPreviewProps {
  files: File[];
  videos: VideoInfo[];
  analyses: VideoAnalysis[];
}

export function VideoPreview({ files, videos, analyses }: VideoPreviewProps) {
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
          return (
            <article key={video.stored_name} className="preview-card">
              {previewUrl ? <video src={previewUrl} controls muted playsInline /> : <div className="preview-placeholder" />}
              <div className="preview-meta">
                <h3>{video.name}</h3>
                <span>{Math.max(video.size_bytes / 1024 / 1024, 0.1).toFixed(1)} MB</span>
              </div>
              {analysis ? (
                <div className="analysis-chip-grid">
                  <span>{analysis.content_type}</span>
                  <span>{analysis.pacing}</span>
                  <span>{analysis.color_mood}</span>
                </div>
              ) : (
                <p className="placeholder-copy">Run analyze to generate scene tags and cut hints.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
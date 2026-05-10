import type { TranscriptionResponse } from '../types';

interface TranscriptionPanelProps {
  transcriptions: Record<string, TranscriptionResponse>;
}

export function TranscriptionPanel({ transcriptions }: TranscriptionPanelProps) {
  const isEmpty = Object.keys(transcriptions).length === 0;

  if (isEmpty) {
    return (
      <section className="stack-block">
        <div className="section-heading inline-heading">
          <div>
            <span className="section-kicker">Speech to Text</span>
            <h2>Transcriptions</h2>
          </div>
        </div>
        <p className="placeholder-copy">Transcribe audio from uploaded videos to generate text and segment timings.</p>
      </section>
    );
  }

  return (
    <section className="stack-block">
      <div className="section-heading inline-heading">
        <div>
          <span className="section-kicker">Speech to Text</span>
          <h2>Transcriptions</h2>
        </div>
        <span className="pill-pill">{Object.keys(transcriptions).length} transcribed</span>
      </div>
      <div className="transcriptions-grid">
        {Object.entries(transcriptions).map(([videoName, result]) => (
          <article key={videoName} className="transcription-card">
            <div className="transcription-header">
              <h3>{result.video_name}</h3>
              <span className="chip">{result.transcription.language}</span>
            </div>
            <div className="transcription-meta">
              <span className="meta-item">Duration: {result.transcription.duration.toFixed(1)}s</span>
              <span className="meta-item">{result.transcription.segments.length} segments</span>
            </div>
            <div className="transcription-text">
              <p>{result.transcription.text}</p>
            </div>
            {result.transcription.segments.length > 0 && (
              <div className="transcription-segments">
                <details className="segments-details">
                  <summary>
                    <strong>Segment breakdown</strong>
                  </summary>
                  <div className="segments-list">
                    {result.transcription.segments.slice(0, 5).map((segment) => (
                      <div key={segment.id} className="segment-row">
                        <span className="segment-time">
                          {segment.start.toFixed(2)}s - {segment.end.toFixed(2)}s
                        </span>
                        <span className="segment-text">{segment.text}</span>
                      </div>
                    ))}
                    {result.transcription.segments.length > 5 && (
                      <div className="segment-more">
                        +{result.transcription.segments.length - 5} more segments
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

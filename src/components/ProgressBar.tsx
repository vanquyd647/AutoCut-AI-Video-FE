import type { ProgressUpdate } from '../types';

interface ProgressBarProps {
  progress: ProgressUpdate | null;
  connected: boolean;
}

export function ProgressBar({ progress, connected }: ProgressBarProps) {
  const value = progress?.progress ?? 0;

  return (
    <section className="stack-block">
      <div className="section-heading inline-heading">
        <div>
          <span className="section-kicker">Live Progress</span>
          <h2>Pipeline status</h2>
        </div>
        <span className={`status-dot ${connected ? 'is-live' : ''}`}>{connected ? 'WS online' : 'WS idle'}</span>
      </div>
      <div className="progress-shell">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${value}%` }} />
        </div>
        <div className="progress-copy">
          <strong>{progress?.stage ?? 'waiting'}</strong>
          <span>{progress?.message ?? 'Upload clips to begin the workflow.'}</span>
        </div>
      </div>
    </section>
  );
}
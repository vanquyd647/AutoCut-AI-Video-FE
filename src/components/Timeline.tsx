import type { EditPlan } from '../types';

interface TimelineProps {
  plan: EditPlan | null;
}

export function Timeline({ plan }: TimelineProps) {
  const totalDuration = Math.max(plan?.target_duration ?? 0, ...(plan?.clips.map((clip) => clip.end) ?? [0]));

  return (
    <section className="stack-block">
      <div className="section-heading inline-heading">
        <div>
          <span className="section-kicker">Timeline</span>
          <h2>AI cut sequence</h2>
        </div>
        {plan ? <span className="pill-pill">{plan.target_duration}s target</span> : null}
      </div>
      {!plan ? (
        <p className="placeholder-copy">Create an edit plan to render the timeline.</p>
      ) : (
        <div className="timeline-shell">
          {plan.clips.map((clip) => {
            const width = `${((clip.end - clip.start) / totalDuration) * 100}%`;
            return (
              <div key={`${clip.source_video}-${clip.order}`} className="timeline-row">
                <div className="timeline-label">
                  <strong>{clip.source_video}</strong>
                  <span>
                    {clip.start.toFixed(1)}s - {clip.end.toFixed(1)}s
                  </span>
                </div>
                <div className="timeline-track">
                  <div className="timeline-bar" style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
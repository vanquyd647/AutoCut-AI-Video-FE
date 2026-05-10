import type { EditPlan } from '../types';

interface TimelineProps {
  plan: EditPlan | null;
  onMoveClip: (fromIndex: number, toIndex: number) => void;
}

export function Timeline({ plan, onMoveClip }: TimelineProps) {
  function handleDrop(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) {
      return;
    }
    onMoveClip(fromIndex, toIndex);
  }

  const totalDuration = Math.max(plan?.target_duration ?? 0, ...(plan?.clips.map((clip) => clip.end) ?? [0]));

  return (
    <section className="stack-block">
      <div className="section-heading inline-heading">
        <div>
          <span className="section-kicker">Timeline</span>
          <h2>Pro cut editor</h2>
        </div>
        {plan ? (
          <div className="timeline-meta">
            <span className="pill-pill">{plan.target_duration}s target</span>
            <span className="pill-pill">Drag to reorder clips</span>
          </div>
        ) : null}
      </div>
      {!plan ? (
        <p className="placeholder-copy">Create an edit plan to render the timeline.</p>
      ) : (
        <div className="timeline-shell">
          <div className="timeline-summary">
            <span className="chip">Total: {plan.clips.length} clips</span>
            <span className="chip">{totalDuration.toFixed(1)}s duration</span>
            <span className="chip">Drag to reorder</span>
          </div>
          {plan.clips.map((clip, index) => {
            const width = `${((clip.end - clip.start) / totalDuration) * 100}%`;
            const duration = clip.end - clip.start;
            const canMoveUp = index > 0;
            const canMoveDown = index < plan.clips.length - 1;
            return (
              <div
                key={`${clip.source_video}-${clip.order}-${index}`}
                className="timeline-row timeline-row-draggable"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', String(index));
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const fromIndex = Number(event.dataTransfer.getData('text/plain'));
                  if (Number.isNaN(fromIndex)) {
                    return;
                  }
                  handleDrop(fromIndex, index);
                }}
              >
                <div className="timeline-grip" title="Drag clip to reorder">::</div>
                <div className="timeline-label">
                  <strong>
                    #{index + 1} {clip.source_video}
                  </strong>
                  <span>
                    {clip.start.toFixed(1)}s - {clip.end.toFixed(1)}s · {duration.toFixed(1)}s
                  </span>
                </div>
                <div className="timeline-track">
                  <div className="timeline-bar" style={{ width }} />
                </div>
                <div className="timeline-actions">
                  <button
                    type="button"
                    className="timeline-icon-button"
                    onClick={() => handleDrop(index, index - 1)}
                    disabled={!canMoveUp}
                    aria-label="Move clip up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="timeline-icon-button"
                    onClick={() => handleDrop(index, index + 1)}
                    disabled={!canMoveDown}
                    aria-label="Move clip down"
                  >
                    ↓
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
import type { EditPlan } from '../types';

interface EditPlanViewProps {
  plan: EditPlan | null;
}

export function EditPlanView({ plan }: EditPlanViewProps) {
  return (
    <section className="stack-block">
      <div className="section-heading">
        <span className="section-kicker">AI Output</span>
        <h2>Edit plan</h2>
      </div>
      {!plan ? (
        <p className="placeholder-copy">No plan yet. Analyze the project, then ask the editor to build a cut list.</p>
      ) : (
        <div className="stack-list">
          <article className="info-card">
            <span className="info-label">Music suggestion</span>
            <strong>{plan.music_suggestion}</strong>
            <p className="card-supporting-copy">The editor uses this as a pacing anchor for the rendered cut.</p>
          </article>
          <article className="info-card">
            <span className="info-label">Transitions</span>
            <div className="tag-row">
              {plan.transitions.length === 0 ? <span className="placeholder-copy">No transitions</span> : null}
              {plan.transitions.map((transition) => (
                <span key={`${transition.at_clip_index}-${transition.type}`} className="chip">
                  {transition.type} · {transition.duration.toFixed(1)}s
                </span>
              ))}
            </div>
          </article>
          <article className="info-card">
            <span className="info-label">Text overlays</span>
            <div className="tag-row">
              {plan.text_overlays.length === 0 ? <span className="placeholder-copy">No overlays</span> : null}
              {plan.text_overlays.map((overlay) => (
                <span key={`${overlay.text}-${overlay.start}`} className="chip">
                  {overlay.text}
                </span>
              ))}
            </div>
          </article>
          <article className="info-card">
            <span className="info-label">Clip rationale</span>
            <div className="stack-list compact-list">
              {plan.clips.map((clip, index) => (
                <div key={`${clip.source_video}-${clip.order}-${index}`} className="micro-row micro-row-card">
                  <div>
                    <strong>
                      #{index + 1} {clip.source_video}
                    </strong>
                    <span>
                      {clip.start.toFixed(1)}s - {clip.end.toFixed(1)}s
                    </span>
                  </div>
                  <span>{clip.rationale}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
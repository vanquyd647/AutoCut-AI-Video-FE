import type { ApiModelOption, ProjectHistoryItem } from '../types';

interface HistoryPanelProps {
  items: ProjectHistoryItem[];
  models: ApiModelOption[];
}

function resolveModelLabel(model: string, models: ApiModelOption[]): string {
  return models.find((item) => item.value === model)?.label ?? model;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatStatusLabel(status: ProjectHistoryItem['status']): string {
  if (status === 'uploaded') return 'Uploaded';
  if (status === 'analyzed') return 'Analyzed';
  if (status === 'rendered') return 'Rendered';
  return 'Failed';
}

export function HistoryPanel({ items, models }: HistoryPanelProps) {
  return (
    <section className="stack-block">
      <div className="section-heading">
        <span className="section-kicker">History</span>
        <h2>Recent projects</h2>
      </div>

      {items.length === 0 ? (
        <p className="placeholder-copy">No history yet. Run upload and render to create history entries.</p>
      ) : (
        <div className="history-list">
          {items.map((item) => (
            <article key={item.id} className="history-item">
              <div className="history-row">
                <strong>{item.project_id.slice(0, 10)}</strong>
                <span className={`history-status ${item.status}`}>{formatStatusLabel(item.status)}</span>
              </div>
              <div className="history-chip-row">
                <span className="chip">{resolveModelLabel(item.model, models)}</span>
                <span className="chip">{item.style}</span>
                <span className="chip">{item.aspect_ratio}</span>
                <span className="chip">{item.target_duration}s</span>
              </div>
              <p>{formatTimestamp(item.updated_at)}</p>
              {item.error ? <p className="history-error">{item.error}</p> : null}
              {item.output_video_url ? (
                <a className="ghost-button history-link" href={item.output_video_url} target="_blank" rel="noreferrer">
                  Open export
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
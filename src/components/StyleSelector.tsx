import type { AspectRatio, StyleKey } from '../types';

const STYLE_OPTIONS: Array<{
  id: StyleKey;
  label: string;
  accent: string;
  description: string;
  aspectRatio: AspectRatio;
  duration: number;
}> = [
  {
    id: 'tiktok',
    label: 'TikTok Sprint',
    accent: 'Pulse cut',
    description: 'Fast, vertical, hook-first pacing for short-form social clips.',
    aspectRatio: '9:16',
    duration: 30,
  },
  {
    id: 'youtube',
    label: 'YouTube Story',
    accent: 'Narrative cut',
    description: 'Longer beats, cleaner transitions, more room for context.',
    aspectRatio: '16:9',
    duration: 60,
  },
  {
    id: 'instagram',
    label: 'Reel Gloss',
    accent: 'Lifestyle cut',
    description: 'Polished vertical reel with smoother overlays and softer pace.',
    aspectRatio: '9:16',
    duration: 25,
  },
];

interface StyleSelectorProps {
  selected: StyleKey;
  onSelect: (style: StyleKey, aspectRatio: AspectRatio, duration: number) => void;
}

export function StyleSelector({ selected, onSelect }: StyleSelectorProps) {
  return (
    <section className="stack-block">
      <div className="section-heading">
        <span className="section-kicker">Edit Direction</span>
        <h2>Choose a style preset</h2>
      </div>
      <div className="style-grid">
        {STYLE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`style-card ${selected === option.id ? 'is-selected' : ''}`}
            onClick={() => onSelect(option.id, option.aspectRatio, option.duration)}
          >
            <span className="style-accent">{option.accent}</span>
            <strong>{option.label}</strong>
            <span>{option.description}</span>
            <small>
              {option.aspectRatio} · {option.duration}s
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
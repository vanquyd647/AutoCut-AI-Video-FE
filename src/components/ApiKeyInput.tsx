import type { ChangeEvent } from 'react';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function ApiKeyInput({ value, onChange }: ApiKeyInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }

  return (
    <section className="stack-block">
      <div className="section-heading">
        <span className="section-kicker">Gemini Access</span>
        <h2>API key</h2>
      </div>
      <label className="field-shell">
        <span>Gemini API key</span>
        <input
          type="password"
          value={value}
          onChange={handleChange}
          placeholder="AIza..."
          autoComplete="off"
        />
      </label>
      <p className="field-note">Stored in localStorage on this browser only, then sent with analyze/edit requests.</p>
    </section>
  );
}
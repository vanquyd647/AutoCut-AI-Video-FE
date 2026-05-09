import type { ChangeEvent, DragEvent } from 'react';

interface UploadZoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onUpload: () => void;
  pending: boolean;
  uploaded: boolean;
}

export function UploadZone({ files, onFilesChange, onUpload, pending, uploaded }: UploadZoneProps) {
  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    onFilesChange(Array.from(event.target.files ?? []));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    onFilesChange(Array.from(event.dataTransfer.files ?? []));
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  return (
    <section className="stack-block">
      <div className="section-heading">
        <span className="section-kicker">Source Media</span>
        <h2>Upload 2 to 4 raw clips</h2>
      </div>
      <div className="upload-zone" onDrop={handleDrop} onDragOver={handleDragOver}>
        <p>Drop videos here or browse from disk.</p>
        <label className="ghost-button">
          <input type="file" accept="video/*" multiple onChange={handleSelect} hidden />
          Select video files
        </label>
      </div>
      <div className="file-list">
        {files.length === 0 ? <p className="placeholder-copy">No clips selected yet.</p> : null}
        {files.map((file) => (
          <div key={`${file.name}-${file.size}`} className="file-row">
            <strong>{file.name}</strong>
            <span>{Math.max(file.size / 1024 / 1024, 0.1).toFixed(1)} MB</span>
          </div>
        ))}
      </div>
      <button type="button" className="primary-button" onClick={onUpload} disabled={pending || files.length === 0}>
        {uploaded ? 'Upload new batch' : 'Upload to project'}
      </button>
    </section>
  );
}
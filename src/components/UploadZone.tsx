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
        <h2>Upload raw clips</h2>
      </div>
      <div className="upload-zone" onDrop={handleDrop} onDragOver={handleDragOver}>
        <div className="upload-zone-hero">
          <strong>Drag and drop files here</strong>
          <span>Supports 2 to 4 clips, optimized for short-form and long-form edits.</span>
        </div>
        <p>Browse from disk to build a project batch, then analyze and render it end to end.</p>
        <label className="ghost-button">
          <input type="file" accept="video/*" multiple onChange={handleSelect} hidden />
          Select video files
        </label>
      </div>
      <div className="file-list">
        <div className="file-list-header">
          <span className="pill-pill">{files.length} selected</span>
          <span className="field-note">{pending ? 'Uploading in progress' : uploaded ? 'Ready for a new batch' : 'Awaiting upload'}</span>
        </div>
        {files.length === 0 ? <p className="placeholder-copy">No clips selected yet. Add videos to unlock the upload flow.</p> : null}
        {files.map((file) => (
          <div key={`${file.name}-${file.size}`} className="file-row file-row-enhanced">
            <div className="file-row-main">
              <strong>{file.name}</strong>
              <span>{file.type || 'video/*'}</span>
            </div>
            <span className="file-size">{Math.max(file.size / 1024 / 1024, 0.1).toFixed(1)} MB</span>
          </div>
        ))}
      </div>
      <button type="button" className="primary-button upload-primary" onClick={onUpload} disabled={pending || files.length === 0}>
        {uploaded ? 'Upload new batch' : 'Upload to project'}
      </button>
    </section>
  );
}
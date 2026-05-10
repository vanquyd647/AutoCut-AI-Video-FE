interface ExportPanelProps {
  outputUrl: string | null;
  projectId: string | null;
}

export function ExportPanel({ outputUrl, projectId }: ExportPanelProps) {
  async function copyDownloadLink() {
    if (outputUrl) {
      await navigator.clipboard.writeText(outputUrl);
      alert('Download link copied to clipboard');
    }
  }

  return (
    <section className="stack-block export-panel">
      <div className="section-heading inline-heading">
        <div>
          <span className="section-kicker">Final Output</span>
          <h2>Preview and download</h2>
        </div>
        {outputUrl ? <span className="pill-pill">Ready for export</span> : null}
      </div>
      {!outputUrl ? (
        <p className="placeholder-copy">The export panel will light up once rendering finishes. Your video will be ready to download and share.</p>
      ) : (
        <>
          <video className="export-video" src={outputUrl} controls playsInline />
          <div className="export-info-row">
            <span className="chip">MP4 format</span>
            <span className="chip">H.264 codec</span>
            <span className="chip">Optimized</span>
          </div>
          <div className="export-actions">
            <a className="primary-button export-download-btn" href={outputUrl} download>
              Download MP4
            </a>
            <button type="button" className="secondary-button" onClick={copyDownloadLink}>
              Copy link
            </button>
          </div>
          {projectId ? <span className="project-token">Project {projectId}</span> : null}
        </>
      )}
    </section>
  );
}
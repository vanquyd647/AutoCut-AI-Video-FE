interface ExportPanelProps {
  outputUrl: string | null;
  projectId: string | null;
}

export function ExportPanel({ outputUrl, projectId }: ExportPanelProps) {
  return (
    <section className="stack-block export-panel">
      <div className="section-heading">
        <span className="section-kicker">Final Output</span>
        <h2>Preview and download</h2>
      </div>
      {!outputUrl ? (
        <p className="placeholder-copy">The export panel will light up once rendering finishes.</p>
      ) : (
        <>
          <video className="export-video" src={outputUrl} controls playsInline />
          <div className="export-actions">
            <a className="primary-button" href={outputUrl} download>
              Download MP4
            </a>
            {projectId ? <span className="project-token">Project {projectId}</span> : null}
          </div>
        </>
      )}
    </section>
  );
}
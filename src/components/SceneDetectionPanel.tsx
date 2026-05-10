import type { SceneDetectionResponse } from '../types';

interface SceneDetectionPanelProps {
  scenes: SceneDetectionResponse | null;
  loading?: boolean;
}

export function SceneDetectionPanel({ scenes, loading }: SceneDetectionPanelProps) {
  if (loading) {
    return (
      <section className="stack-block">
        <div className="section-heading inline-heading">
          <div>
            <span className="section-kicker">Scene Intelligence</span>
            <h2>Detected boundaries</h2>
          </div>
        </div>
        <div className="placeholder-copy">Analyzing video for scene boundaries...</div>
      </section>
    );
  }

  if (!scenes) {
    return (
      <section className="stack-block">
        <div className="section-heading inline-heading">
          <div>
            <span className="section-kicker">Scene Intelligence</span>
            <h2>Detected boundaries</h2>
          </div>
        </div>
        <p className="placeholder-copy">Run scene detection to identify automatic cut points in your footage.</p>
      </section>
    );
  }

  return (
    <section className="stack-block">
      <div className="section-heading inline-heading">
        <div>
          <span className="section-kicker">Scene Intelligence</span>
          <h2>Detected boundaries</h2>
        </div>
        <span className="pill-pill">{scenes.total_videos} videos analyzed</span>
      </div>
      <div className="scenes-grid">
        {Object.entries(scenes.scenes).map(([storedName, result]) => (
          <article key={storedName} className="scene-result-card">
            <h3>{result.video_name}</h3>
            <div className="scene-summary">
              <span className="chip">{result.scene_count} scenes detected</span>
            </div>
            <div className="scene-boundaries">
              <div className="boundaries-header">
                <strong>Timecodes</strong>
              </div>
              <div className="boundaries-list">
                {result.scenes.length === 0 ? (
                  <p className="placeholder-copy">No scene boundaries detected</p>
                ) : (
                  result.scenes.map((scene, index) => (
                    <div key={index} className="boundary-row">
                      <span className="timecode">{scene.timecode}</span>
                      <span className="timestamp">{(scene.timestamp_ms / 1000).toFixed(2)}s</span>
                      <span className="frame-num">Frame {scene.frame_number}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

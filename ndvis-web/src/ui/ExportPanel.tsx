import { useAppState } from "@/state/appState";
import { useState } from "react";

export const ExportPanel = () => {
  const exportConfig = useAppState((state) => state.exportConfig);
  const setExportConfig = useAppState((state) => state.setExportConfig);
  const computeStatus = useAppState((state) => state.computeStatus);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      const { exportScene, downloadBlob } = await import("@/utils/export");
      
      const canvas = document.querySelector("canvas");
      if (!canvas) {
        throw new Error("Canvas not found");
      }

      setExportProgress(30);
      
      const blob = await exportScene(canvas, {
        format: exportConfig.format === "mp4" ? "png" : exportConfig.format,
        width: exportConfig.resolution[0],
        height: exportConfig.resolution[1],
        includeOverlays: exportConfig.includeOverlays,
      });

      setExportProgress(80);

      if (blob) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
        const filename = `ndvis-export-${timestamp}.${exportConfig.format === "mp4" ? "png" : exportConfig.format}`;
        downloadBlob(blob, filename);
      }

      setExportProgress(100);
      
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 500);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Check console for details.");
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const resolutionPresets = [
    { label: "HD (1280×720)", width: 1280, height: 720 },
    { label: "Full HD (1920×1080)", width: 1920, height: 1080 },
    { label: "4K (3840×2160)", width: 3840, height: 2160 },
  ];

  return (
    <aside className="export-panel">
      <header className="panel-header">
        <h2>Export</h2>
      </header>

      <section>
        <label htmlFor="export-format">Format</label>
        <select
          id="export-format"
          value={exportConfig.format}
          onChange={(e) =>
            setExportConfig({ format: e.target.value as "png" | "svg" | "mp4" })
          }
          disabled={isExporting}
        >
          <option value="png">PNG (raster image)</option>
          <option value="svg">SVG (vector graphics)</option>
          <option value="mp4">MP4 (animation)</option>
        </select>
      </section>

      <section>
        <label>Resolution</label>
        <div className="resolution-presets">
          {resolutionPresets.map((preset) => (
            <button
              key={preset.label}
              onClick={() =>
                setExportConfig({ resolution: [preset.width, preset.height] })
              }
              className={
                exportConfig.resolution[0] === preset.width &&
                exportConfig.resolution[1] === preset.height
                  ? "active"
                  : ""
              }
              disabled={isExporting}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="resolution-custom">
          <input
            type="number"
            value={exportConfig.resolution[0]}
            onChange={(e) =>
              setExportConfig({
                resolution: [parseInt(e.target.value) || 1920, exportConfig.resolution[1]],
              })
            }
            min="320"
            max="7680"
            disabled={isExporting}
          />
          <span>×</span>
          <input
            type="number"
            value={exportConfig.resolution[1]}
            onChange={(e) =>
              setExportConfig({
                resolution: [exportConfig.resolution[0], parseInt(e.target.value) || 1080],
              })
            }
            min="240"
            max="4320"
            disabled={isExporting}
          />
        </div>
      </section>

      {exportConfig.format === "mp4" && (
        <section>
          <div className="animation-controls">
            <label htmlFor="export-fps">Frame rate (FPS)</label>
            <input
              id="export-fps"
              type="number"
              value={exportConfig.fps}
              onChange={(e) => setExportConfig({ fps: parseInt(e.target.value) || 30 })}
              min="15"
              max="120"
              step="1"
              disabled={isExporting}
            />
          </div>

          <div className="animation-controls">
            <label htmlFor="export-duration">Duration (seconds)</label>
            <input
              id="export-duration"
              type="number"
              value={exportConfig.duration}
              onChange={(e) => setExportConfig({ duration: parseInt(e.target.value) || 5 })}
              min="1"
              max="60"
              step="1"
              disabled={isExporting}
            />
          </div>
        </section>
      )}

      <section>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={exportConfig.includeOverlays}
            onChange={(e) => setExportConfig({ includeOverlays: e.target.checked })}
            disabled={isExporting}
          />
          Include calculus overlays
        </label>
      </section>

      <section>
        <button
          className="export-button"
          onClick={handleExport}
          disabled={isExporting || computeStatus.isComputing}
        >
          {isExporting ? `Exporting... ${exportProgress}%` : "Export"}
        </button>

        {isExporting && (
          <div className="export-progress">
            <div
              className="export-progress-bar"
              style={{ width: `${exportProgress}%` }}
            />
          </div>
        )}

        {computeStatus.lastError && (
          <div className="export-warning">
            Last computation had errors. Fix them before exporting.
          </div>
        )}
      </section>

      <section>
        <details>
          <summary>Export notes</summary>
          <ul className="export-help">
            <li>PNG: Single frame capture at current rotation</li>
            <li>SVG: Vector export (geometry only, no shading)</li>
            <li>MP4: Rotation animation with configurable duration</li>
            <li>All formats use deterministic rendering pipeline</li>
          </ul>
        </details>
      </section>
    </aside>
  );
};

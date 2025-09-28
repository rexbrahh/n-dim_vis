import { ControlsPanel } from "@/ui/ControlsPanel";
import { SceneViewport } from "@/ui/SceneViewport";
import "@/ui/layout.css";

export const AppShell = () => {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <h1>ndvis</h1>
        <span className="app-shell__subtitle">N-dimensional object visualizer</span>
      </header>
      <main className="app-shell__main">
        <ControlsPanel />
        <SceneViewport />
      </main>
    </div>
  );
};

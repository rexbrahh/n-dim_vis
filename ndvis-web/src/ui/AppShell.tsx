import { useState } from "react";
import { ControlsPanel } from "@/ui/ControlsPanel";
import { HyperplanePanel } from "@/ui/HyperplanePanel";
import { FunctionPanel } from "@/ui/FunctionPanel";
import { CalculusPanel } from "@/ui/CalculusPanel";
import { ExportPanel } from "@/ui/ExportPanel";
import { SceneViewport } from "@/ui/SceneViewport";
import "@/ui/layout.css";

type PanelTab = "geometry" | "hyperplane" | "function" | "calculus" | "export";

export const AppShell = () => {
  const [activeTab, setActiveTab] = useState<PanelTab>("geometry");

  const tabs: { id: PanelTab; label: string }[] = [
    { id: "geometry", label: "Geometry" },
    { id: "hyperplane", label: "Hyperplane" },
    { id: "function", label: "Function" },
    { id: "calculus", label: "Calculus" },
    { id: "export", label: "Export" },
  ];

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <h1>HyperViz</h1>
        <span className="app-shell__subtitle">
          N-dimensional visualizer & calculus tool
        </span>
      </header>
      <main className="app-shell__main">
        <div className="panel-container">
          <nav className="panel-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`panel-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="panel-content">
            {activeTab === "geometry" && <ControlsPanel />}
            {activeTab === "hyperplane" && <HyperplanePanel />}
            {activeTab === "function" && <FunctionPanel />}
            {activeTab === "calculus" && <CalculusPanel />}
            {activeTab === "export" && <ExportPanel />}
          </div>
        </div>
        <SceneViewport />
      </main>
    </div>
  );
};

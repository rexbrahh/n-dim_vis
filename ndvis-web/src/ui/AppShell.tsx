import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
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
  const PANEL_WIDTH_KEY = "hyperviz-panel-width";
  const PANEL_COLLAPSED_KEY = "hyperviz-panel-collapsed";

  const [panelWidth, setPanelWidth] = useState<number>(320);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const startXRef = useRef(0);
  const startWidthRef = useRef(panelWidth);

  const tabs: { id: PanelTab; label: string }[] = [
    { id: "geometry", label: "Geometry" },
    { id: "hyperplane", label: "Hyperplane" },
    { id: "function", label: "Function" },
    { id: "calculus", label: "Calculus" },
    { id: "export", label: "Export" },
  ];

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedWidth = window.localStorage.getItem(PANEL_WIDTH_KEY);
    const storedCollapsed = window.localStorage.getItem(PANEL_COLLAPSED_KEY);

    if (storedWidth) {
      const parsed = parseInt(storedWidth, 10);
      if (!Number.isNaN(parsed)) {
        setPanelWidth(Math.min(520, Math.max(240, parsed)));
      }
    }

    if (storedCollapsed === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || isResizing) {
      return;
    }

    window.localStorage.setItem(PANEL_WIDTH_KEY, String(Math.round(panelWidth)));
  }, [panelWidth, isResizing]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(PANEL_COLLAPSED_KEY, isCollapsed ? 'true' : 'false');
  }, [isCollapsed]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - startXRef.current;
      const nextWidth = Math.min(520, Math.max(240, startWidthRef.current + delta));
      setPanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (isCollapsed) {
      return;
    }
    startXRef.current = event.clientX;
    startWidthRef.current = panelWidth;
    setIsResizing(true);
  };

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => !prev);
  };

  const panelColumns = isCollapsed ? "0px 0px 1fr" : `${Math.round(panelWidth)}px 12px 1fr`;
  const toggleOffset = isCollapsed ? 16 : Math.round(panelWidth) + 16;

  return (
    <div className="app-shell">
      <main className="app-shell__main" style={{ gridTemplateColumns: panelColumns }}>
        <div
          className={`panel-container${isCollapsed ? " panel-container--collapsed" : ""}`}
          style={{ width: isCollapsed ? 0 : panelWidth }}
          aria-hidden={isCollapsed}
        >
          <nav className="panel-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`panel-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                tabIndex={isCollapsed ? -1 : 0}
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
        <div
          className={`panel-resizer${isCollapsed ? " panel-resizer--hidden" : ""}${isResizing ? " panel-resizer--active" : ""}`}
          onMouseDown={handleResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-hidden={isCollapsed}
        />
        <SceneViewport />
        <button
          type="button"
          className={`panel-toggle ${isCollapsed ? "collapsed" : ""}`}
          onClick={toggleCollapsed}
          aria-expanded={!isCollapsed}
          style={{ left: `${toggleOffset}px` }}
        >
          {isCollapsed ? "Show controls" : "Hide controls"}
        </button>
      </main>
    </div>
  );
};

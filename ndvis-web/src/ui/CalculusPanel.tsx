import { useAppState } from "@/state/appState";
import { useState } from "react";

export const CalculusPanel = () => {
  const dimension = useAppState((state) => state.dimension);
  const calculus = useAppState((state) => state.calculus);
  const setCalculus = useAppState((state) => state.setCalculus);
  const functionConfig = useAppState((state) => state.functionConfig);
  const triggerRecompute = useAppState((state) => state.triggerRecompute);

  const [levelSetInput, setLevelSetInput] = useState("");

  const handleToggleOption = async (key: keyof typeof calculus, value: boolean) => {
    setCalculus({ [key]: value });
    if (value && functionConfig.isValid) {
      await triggerRecompute();
    }
  };

  const handleAddLevelSet = () => {
    const value = parseFloat(levelSetInput);
    if (!isNaN(value)) {
      setCalculus({ levelSetValues: [...calculus.levelSetValues, value] });
      setLevelSetInput("");
      if (calculus.showLevelSets) {
        triggerRecompute();
      }
    }
  };

  const handleRemoveLevelSet = (index: number) => {
    const updated = calculus.levelSetValues.filter((_, i) => i !== index);
    setCalculus({ levelSetValues: updated });
    if (calculus.showLevelSets) {
      triggerRecompute();
    }
  };

  const handleProbePointChange = (index: number, value: number) => {
    const probePoint = calculus.probePoint
      ? new Float32Array(calculus.probePoint)
      : new Float32Array(dimension);
    probePoint[index] = value;
    setCalculus({ probePoint });
  };

  const isEnabled = functionConfig.isValid;

  return (
    <aside className="calculus-panel">
      <header className="panel-header">
        <h2>Calculus Overlays</h2>
        {!isEnabled && <span className="status-badge">Define function first</span>}
      </header>

      <section>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={calculus.showGradient}
            onChange={(e) => handleToggleOption("showGradient", e.target.checked)}
            disabled={!isEnabled}
          />
          Show gradient vectors (∇f)
        </label>

        {calculus.showGradient && (
          <div className="nested-control">
            <label htmlFor="gradient-scale">Vector scale</label>
            <input
              id="gradient-scale"
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={calculus.gradientScale}
              onChange={(e) => setCalculus({ gradientScale: parseFloat(e.target.value) })}
            />
            <span>{calculus.gradientScale.toFixed(1)}×</span>
          </div>
        )}
      </section>

      <section>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={calculus.showTangentPlane}
            onChange={(e) => handleToggleOption("showTangentPlane", e.target.checked)}
            disabled={!isEnabled}
          />
          Show tangent plane
        </label>
      </section>

      <section>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={calculus.showHessian}
            onChange={(e) => handleToggleOption("showHessian", e.target.checked)}
            disabled={!isEnabled}
          />
          Compute Hessian matrix (∇²f)
        </label>
      </section>

      <section>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={calculus.showLevelSets}
            onChange={(e) => handleToggleOption("showLevelSets", e.target.checked)}
            disabled={!isEnabled}
          />
          Show level sets
        </label>

        {calculus.showLevelSets && (
          <div className="level-set-controls">
            <div className="level-set-input">
              <input
                type="number"
                step="0.1"
                value={levelSetInput}
                onChange={(e) => setLevelSetInput(e.target.value)}
                placeholder="Level value"
                onKeyDown={(e) => e.key === "Enter" && handleAddLevelSet()}
              />
              <button onClick={handleAddLevelSet} disabled={!levelSetInput}>
                Add
              </button>
            </div>

            {calculus.levelSetValues.length > 0 && (
              <ul className="level-set-list">
                {calculus.levelSetValues.map((value, index) => (
                  <li key={index}>
                    <span>f(x) = {value.toFixed(2)}</span>
                    <button onClick={() => handleRemoveLevelSet(index)} aria-label="Remove">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section>
        <label>Probe point (for gradient/tangent)</label>
        <div className="probe-point-grid">
          {Array.from({ length: dimension }).map((_, index) => (
            <div key={index} className="probe-coordinate">
              <span>x{index + 1}</span>
              <input
                type="number"
                step="0.1"
                value={calculus.probePoint?.[index] ?? 0}
                onChange={(e) => handleProbePointChange(index, parseFloat(e.target.value) || 0)}
                disabled={!isEnabled}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <label htmlFor="ad-mode">Differentiation mode</label>
        <select
          id="ad-mode"
          value={calculus.adMode}
          onChange={(e) => setCalculus({ adMode: e.target.value as "forward" | "finite-diff" })}
          disabled={!isEnabled}
        >
          <option value="forward">Forward-mode AD</option>
          <option value="finite-diff">Finite differences</option>
        </select>
      </section>
    </aside>
  );
};

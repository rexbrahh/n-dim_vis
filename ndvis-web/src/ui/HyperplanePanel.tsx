import { useAppState } from "@/state/appState";
import { useEffect, useState } from "react";

export const HyperplanePanel = () => {
  const dimension = useAppState((state) => state.dimension);
  const hyperplane = useAppState((state) => state.hyperplane);
  const setHyperplane = useAppState((state) => state.setHyperplane);
  const triggerRecompute = useAppState((state) => state.triggerRecompute);

  const [coefficients, setCoefficients] = useState<number[]>([]);

  useEffect(() => {
    setCoefficients(Array.from(hyperplane.coefficients));
  }, [hyperplane.coefficients]);

  const handleCoefficientChange = (index: number, value: number) => {
    const resized = new Float32Array(dimension);
    resized.set(hyperplane.coefficients.subarray(0, Math.min(dimension, hyperplane.coefficients.length)));
    resized[index] = value;
    setHyperplane({ coefficients: resized });
  };

  const normalizeCoefficients = () => {
    const magnitude = Math.sqrt(
      Array.from(hyperplane.coefficients).reduce((sum, c) => sum + c * c, 0)
    );
    if (magnitude > 0) {
      const normalized = new Float32Array(
        Array.from(hyperplane.coefficients).map((c) => c / magnitude)
      );
      setHyperplane({ coefficients: normalized });
    }
  };

  const handleToggleEnabled = async () => {
    setHyperplane({ enabled: !hyperplane.enabled });
    if (!hyperplane.enabled) {
      await triggerRecompute();
    }
  };

  const handleColorChange = (channel: number, value: number) => {
    const newColor: [number, number, number] = [...hyperplane.intersectionColor];
    newColor[channel] = value;
    setHyperplane({ intersectionColor: newColor });
  };

  return (
    <aside className="hyperplane-panel">
      <header className="panel-header">
        <h2>Hyperplane Slicing</h2>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={hyperplane.enabled}
            onChange={handleToggleEnabled}
          />
          <span>Enable</span>
        </label>
      </header>

      <section>
        <p className="panel-description">
          Define hyperplane: a₁x₁ + a₂x₂ + ... + aₙxₙ = b
        </p>

        <div className="coefficient-grid">
          <label>Coefficients (a)</label>
          {Array.from({ length: dimension }).map((_, index) => (
            <div key={index} className="coefficient-input">
              <span>x{index + 1}</span>
              <input
                type="number"
                step="0.1"
                value={coefficients[index] ?? 0}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setCoefficients((prev) => {
                    const next = [...prev];
                    next[index] = value;
                    return next;
                  });
                }}
                onBlur={() => handleCoefficientChange(index, coefficients[index] ?? 0)}
                disabled={!hyperplane.enabled}
              />
            </div>
          ))}
        </div>

        <button onClick={normalizeCoefficients} disabled={!hyperplane.enabled}>
          Normalize coefficients
        </button>

        <div className="offset-control">
          <label htmlFor="hyperplane-offset">Offset (b)</label>
          <input
            id="hyperplane-offset"
            type="number"
            step="0.1"
            value={hyperplane.offset}
            onChange={(e) => setHyperplane({ offset: parseFloat(e.target.value) || 0 })}
            onBlur={() => triggerRecompute()}
            disabled={!hyperplane.enabled}
          />
        </div>
      </section>

      <section>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={hyperplane.showIntersection}
            onChange={(e) => setHyperplane({ showIntersection: e.target.checked })}
            disabled={!hyperplane.enabled}
          />
          Show intersection geometry
        </label>

        <div className="color-picker">
          <label>Intersection color</label>
          <div className="color-channels">
            {(["R", "G", "B"] as const).map((channel, index) => (
              <div key={channel} className="color-channel">
                <span>{channel}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={hyperplane.intersectionColor[index]}
                  onChange={(e) => handleColorChange(index, parseFloat(e.target.value))}
                  disabled={!hyperplane.enabled || !hyperplane.showIntersection}
                />
                <span>{hyperplane.intersectionColor[index].toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </aside>
  );
};

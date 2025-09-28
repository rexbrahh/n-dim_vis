import { useAppState } from "@/state/appState";
import { useMemo } from "react";

export const ControlsPanel = () => {
  const dimension = useAppState((state) => state.dimension);
  const setDimension = useAppState((state) => state.setDimension);
  const basis = useAppState((state) => state.basis);
  const setBasis = useAppState((state) => state.setBasis);
  const pcaEigenvalues = useAppState((state) => state.pcaEigenvalues);

  const varianceRatios = useMemo(() => {
    const eigenvaluesArray = Array.from(pcaEigenvalues, (value) => Math.max(value, 0));
    const total = eigenvaluesArray.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      return eigenvaluesArray.map(() => 0);
    }
    return eigenvaluesArray.map((value) => value / total);
  }, [pcaEigenvalues]);

  return (
    <aside className="controls-panel">
      <section>
        <label htmlFor="dimension">Dimension</label>
        <input
          id="dimension"
          type="range"
          min={3}
          max={8}
          value={dimension}
          onChange={(event) => setDimension(parseInt(event.target.value, 10))}
        />
        <span>{dimension}D</span>
      </section>
      <section>
        <fieldset>
          <legend>Projection basis</legend>
          {(["standard", "random", "pca", "custom"] as const).map((option) => (
            <label key={option} className="controls-panel__radio">
              <input
                type="radio"
                name="basis"
                value={option}
                checked={basis === option}
                onChange={() => setBasis(option)}
              />
              {option.toUpperCase()}
            </label>
          ))}
        </fieldset>
      </section>
      <section>
        <header className="controls-panel__section-header">PCA eigenvalues (σ²)</header>
        <ul className="controls-panel__eigenvalues">
          {Array.from(pcaEigenvalues).map((value, index) => (
            <li key={index}>
              <span>λ{index + 1}</span>
              <span>{value.toFixed(3)}</span>
              <span>{(varianceRatios[index] * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
};

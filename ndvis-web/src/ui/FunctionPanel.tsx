import { useAppState } from "@/state/appState";
import type { CalculusConfig } from "@/state/appState";
import { useCallback, useEffect } from "react";

import { compileExpression } from "@/wasm/hyperviz";

export const FunctionPanel = () => {
  const dimension = useAppState((state) => state.dimension);
  const functionConfig = useAppState((state) => state.functionConfig);
  const setFunctionExpression = useAppState((state) => state.setFunctionExpression);
  const setFunctionValid = useAppState((state) => state.setFunctionValid);
  const triggerRecompute = useAppState((state) => state.triggerRecompute);
  const setCalculus = useAppState((state) => state.setCalculus);
  const calculus = useAppState((state) => state.calculus);

  const validateAndCompile = useCallback(
    async (expression: string) => {
      const trimmed = expression.trim();
      if (!trimmed) {
        setFunctionValid(false, null, null);
        return;
      }

      try {
        const { bytecode, error } = await compileExpression(trimmed, dimension);

        if (error) {
          setFunctionValid(false, error, null);
          return;
        }

        setFunctionValid(true, null, bytecode);
        await triggerRecompute();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Parse error";
        setFunctionValid(false, message, null);
      }
    },
    [dimension, setFunctionValid, triggerRecompute]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (functionConfig.expression) {
        validateAndCompile(functionConfig.expression);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [functionConfig.expression, validateAndCompile]);

  type ExampleConfig = {
    label: string;
    expr: string;
    calculus?: Partial<Pick<CalculusConfig, "showLevelSets" | "levelSetValues" | "gradientScale" | "probePoint" | "showGradient" | "showTangentPlane" | "showHessian" | "adMode">>;
  };

  const applyExampleCalculusPreset = (preset?: ExampleConfig["calculus"]) => {
    if (!preset) {
      return;
    }

    const updates: Partial<CalculusConfig> = {};

    if (preset.showLevelSets !== undefined) {
      updates.showLevelSets = preset.showLevelSets;
    }

    if (preset.levelSetValues) {
      updates.levelSetValues = [...preset.levelSetValues];
    }

    if (preset.showGradient !== undefined) {
      updates.showGradient = preset.showGradient;
    }

    if (preset.showTangentPlane !== undefined) {
      updates.showTangentPlane = preset.showTangentPlane;
    }

    if (preset.showHessian !== undefined) {
      updates.showHessian = preset.showHessian;
    }

    if (preset.gradientScale !== undefined) {
      updates.gradientScale = preset.gradientScale;
    }

    if (preset.probePoint) {
      const probe = new Float32Array(dimension);
      if (calculus.probePoint) {
        probe.set(calculus.probePoint.subarray(0, Math.min(dimension, calculus.probePoint.length)));
      }
      probe.set(preset.probePoint.slice(0, dimension));
      updates.probePoint = probe;
    }

    if (preset.adMode) {
      updates.adMode = preset.adMode;
    }

    if (Object.keys(updates).length > 0) {
      setCalculus(updates);
    }
  };

  const handleExampleLoad = (example: ExampleConfig) => {
    applyExampleCalculusPreset(example.calculus);
    setFunctionExpression(example.expr);
  };

  const examples: ExampleConfig[] = [
    {
      label: "Sphere",
      expr: "x1^2 + x2^2 + x3^2 + x4^2",
      calculus: {
        showLevelSets: true,
        levelSetValues: [1],
        probePoint: new Array(dimension).fill(0),
      },
    },
    { label: "Saddle", expr: "x1^2 - x2^2" },
    { label: "Wave", expr: "sin(x1) * cos(x2)" },
    { label: "Distance", expr: "sqrt(x1^2 + x2^2 + x3^2)" },
  ];

  return (
    <aside className="function-panel">
      <header className="panel-header">
        <h2>Function Definition</h2>
      </header>

      <section>
        <label htmlFor="function-type">Type</label>
        <select
          id="function-type"
          value={functionConfig.type}
          onChange={() => {
            // Function type change would require state update
            // For now, only scalar functions are fully supported
          }}
        >
          <option value="scalar">Scalar field f: ℝⁿ → ℝ</option>
          <option value="vector" disabled>
            Vector field F: ℝⁿ → ℝᵐ (coming soon)
          </option>
        </select>
      </section>

      <section>
        <label htmlFor="function-expression">Expression</label>
        <textarea
          id="function-expression"
          value={functionConfig.expression}
          onChange={(e) => setFunctionExpression(e.target.value)}
          placeholder={`Enter expression using x1, x2, ..., x${dimension}\nExample: x1^2 + x2^2 - x3`}
          rows={4}
          className={functionConfig.errorMessage ? "error" : ""}
        />

        {functionConfig.errorMessage && (
          <div className="validation-error">{functionConfig.errorMessage}</div>
        )}

        {functionConfig.isValid && (
          <div className="validation-success">✓ Expression compiled successfully</div>
        )}
      </section>

      <section>
        <label>Examples</label>
        <div className="example-buttons">
          {examples.map((example) => (
            <button
              key={example.label}
              onClick={() => handleExampleLoad(example)}
              className="example-button"
            >
              {example.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <details>
          <summary>Supported syntax</summary>
          <ul className="syntax-help">
            <li>Variables: x1, x2, ..., x{dimension}</li>
            <li>Operators: +, -, *, /, ^</li>
            <li>Functions: sin, cos, tan, exp, log, sqrt, abs</li>
            <li>Constants: pi, e</li>
          </ul>
        </details>
      </section>
    </aside>
  );
};

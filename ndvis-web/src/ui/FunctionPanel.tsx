import { useAppState } from "@/state/appState";
import { useCallback, useEffect } from "react";

export const FunctionPanel = () => {
  const dimension = useAppState((state) => state.dimension);
  const functionConfig = useAppState((state) => state.functionConfig);
  const setFunctionExpression = useAppState((state) => state.setFunctionExpression);
  const setFunctionValid = useAppState((state) => state.setFunctionValid);
  const triggerRecompute = useAppState((state) => state.triggerRecompute);

  const validateAndCompile = useCallback(
    async (expression: string) => {
      if (!expression.trim()) {
        setFunctionValid(false, null, null);
        return;
      }

      try {
        // TODO: Wire to actual ndcalc-core parser/compiler when available
        // This would call into hyperviz.ts bindings for:
        // - Expression parsing
        // - Bytecode compilation
        // - Validation of variable references (x1, x2, ..., xn)

        // Simulate validation
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Basic syntax check for demonstration
        const validVariables = Array.from({ length: dimension }, (_, i) => `x${i + 1}`);
        const hasValidVariables = validVariables.some((v) => expression.includes(v));

        if (hasValidVariables) {
          setFunctionValid(true, null, new Uint8Array([0x01, 0x02, 0x03])); // Stub bytecode
          await triggerRecompute();
        } else {
          setFunctionValid(false, `Expression must reference at least one variable (${validVariables.join(", ")})`, null);
        }
      } catch (error) {
        setFunctionValid(
          false,
          error instanceof Error ? error.message : "Parse error",
          null
        );
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

  const handleExampleLoad = (example: string) => {
    setFunctionExpression(example);
  };

  const examples = [
    { label: "Sphere", expr: "x1^2 + x2^2 + x3^2 + x4^2" },
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
              onClick={() => handleExampleLoad(example.expr)}
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

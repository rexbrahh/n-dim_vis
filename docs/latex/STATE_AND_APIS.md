# State & APIs — Wiring

## State additions (backward-compatible)

```ts
// appState.ts
export type FunctionConfig = {
  expression: string;
  type: "scalar" | "vector";
  isValid: boolean;
  errorMessage: string | null;
  programBytecode: Uint8Array | null;
  latex?: string; // new (optional)
};

export type HyperplaneConfig = {
  enabled: boolean;
  coefficients: Float32Array;
  offset: number;
  showIntersection: boolean;
  intersectionColor: [number, number, number];
  latex?: string; // new (optional)
};
```

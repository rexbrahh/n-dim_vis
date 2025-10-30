# LaTeX Input — Overview

## Problem

Typing math in textboxes/sliders is slow; users often have notes in LaTeX they want to paste directly.\
We need a LaTeX-centric input path that compiles into the same internal data used today:

- Hyperplanes (`coefficients: Float32Array`, `offset: number`)
- Function expressions (`expression: string` → bytecode via compile step)
- Optional: custom projection basis (3×n matrix)

## Goals

- **First-class LaTeX** input in Hyperplane and Function panels (+ optional Basis).
- **No ABI changes** to WASM; reuse current `compileExpression(...)`, `triggerRecompute()`.
- **Small, safe** translator (subset of LaTeX → internal IR); rich UI via MathLive + KaTeX.
- **Immediate feedback** (preview + validity pill) and seamless handoff to recompute.

## Non-goals (v1)

- Full TeX engine or macro system
- General CAS / symbolic simplification beyond basic normalization
- Nonlinear constraint compiling for hyperplane

## Success criteria

- Paste common expressions and parse successfully on first try.
- Hyperplane: linear equations compile to normalized `{a,b}` with correct slice overlay.
- Function: LaTeX → ASCII → bytecode; overlays compute as today.
- Performance: input and preview feel instant; no large bundle regressions.

## Glossary

- **Translator**: small parser that turns a subset of LaTeX into internal forms.
- **MathField**: editable LaTeX input (MathLive).
- **Preview**: read-only rendered LaTeX (KaTeX).

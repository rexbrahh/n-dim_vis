# HyperViz — UX & Controls

## Panels
1. **Dimension & Basis**
   - n slider; Basis: Standard / Random ONB / PCA; QR Re‑orthonormalize.
2. **Rotations**
   - Plane picker grid; per‑plane θ sliders; Auto‑spin with per‑plane rates.
3. **Hyperplane**
   - `a` vector editor (sliders or paste array), `b` slider; normalize toggle; show intersection.
4. **Function f(x)**
   - Text field with live parse; variable count bound to n; preset examples.
   - Level‑set `c` slider; Evaluate on probe; Toggle tangent plane/gradient.
5. **Calculus**
   - Probe point picker; show \(f, \nabla f, H\); directional derivative along v; critical point search (region bounds).
6. **Export**
   - PNG/SVG, animation keyframes, headless job builder.

## Camera & Gestures
- Orbit (LMB), pan (Shift+drag), dolly‑to‑cursor (wheel/pinch); Free‑fly toggle; fit‑to‑object; pivot under cursor.
- Keyboard: `F` fit, `Z` zoom‑to‑selection, `Tab` free‑fly, `1/3/7` views (+Ctrl opposite).

## Visual encodings
- Edge colors by axis pair; vertices colored by sign pattern or scalar f value.
- LOD switches: faces→edges→points as complexity rises.

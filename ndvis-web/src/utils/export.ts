export type ExportFormat = "png" | "svg";

export type ExportOptions = {
  format: ExportFormat;
  width: number;
  height: number;
  includeOverlays: boolean;
};

export async function exportScene(canvas: HTMLCanvasElement, options: ExportOptions): Promise<Blob | null> {
  switch (options.format) {
    case "png":
      return exportPNG(canvas);
    case "svg":
      return exportSVG(options.width, options.height);
    default:
      return null;
  }
}

async function exportPNG(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, "image/png");
  });
}

async function exportSVG(width: number, height: number): Promise<Blob | null> {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#111111"/>
  <g id="scene">
    <!-- SVG export stub: implement 2D projection of edges here -->
    <text x="50%" y="50%" text-anchor="middle" fill="#71717a" font-size="14">
      SVG export (stub)
    </text>
  </g>
</svg>`;

  return new Blob([svg], { type: "image/svg+xml" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

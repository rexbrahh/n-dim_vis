import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: "wgsl-loader",
      transform(code, id) {
        if (id.endsWith(".wgsl")) {
          return {
            code: `export default ${JSON.stringify(code)};`,
            map: null,
          };
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  assetsInclude: ["**/*.wgsl"],
});

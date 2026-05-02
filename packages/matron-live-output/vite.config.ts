// packages/matron-live-output/vite.config.ts
//
// Standalone ESM build for the @matron/live-output plugin. The output is a
// single self-contained module loaded at runtime via dynamic `import()` from
// matron-web's plugin loader (`src/vector/init.tsx :: loadPlugins()`), which
// reads URLs from `SdkConfig.modules`.
//
// First-cut decision: bundle React/react-dom rather than externalize them.
// The host sets `window.React = React` before loading plugins (see
// loadPlugins()), and the plugin engine itself uses `window.React` for hooks,
// so externalizing is *possible* but requires runtime aliasing for ESM. Bundling
// keeps the bundle self-contained for now and avoids that complexity. The cost
// is bundle size; revisit if we add many plugins.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [react()],
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/index.tsx"),
            formats: ["es"],
            fileName: () => "live-output.mjs",
        },
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
            // Externalize matron-web host-provided deps if any. For first cut,
            // bundle everything.
            external: [],
        },
        target: "es2022",
        minify: "esbuild",
        sourcemap: true,
        cssCodeSplit: false,
    },
});

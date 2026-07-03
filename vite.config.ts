import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart(),
    // React's plugin must come after TanStack Start's plugin
    viteReact(),
    tailwindcss(),
    // Nitro defaults to the node-server preset -> builds .output/server/index.mjs
    nitro(),
  ],
  environments: {
    ssr: { build: { rollupOptions: { input: "./src/server.ts" } } },
  },
});

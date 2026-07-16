import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart(),
    netlify(),
    viteReact(),
    tailwindcss(),
  ],
  // These are reached only through TanStack Start's own entry, so Vite's initial
  // scan misses them and re-optimizes once the crawl finds them. That swap
  // renames node_modules/.vite/deps, which on Windows loses to a file lock and
  // retries (EPERM) — and while it retries, every dep request 504s, so React
  // never loads and the app renders but does not hydrate. Naming them here gets
  // them into the first pass, so there is no swap to lose.
  optimizeDeps: {
    include: [
      "@tanstack/router-core",
      "@tanstack/router-core/isServer",
      "@tanstack/router-core/ssr/client",
      "seroval",
    ],
  },
});

import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import fs from "node:fs";
import path from "node:path";

// Renames dist-android/index.android.html → dist-android/index.html after build
function renameAndroidHtml(): Plugin {
  return {
    name: "rename-android-html",
    closeBundle() {
      const outDir = path.resolve("dist-android");
      const src = path.join(outDir, "index.android.html");
      const dst = path.join(outDir, "index.html");
      if (fs.existsSync(src)) fs.renameSync(src, dst);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      TanStackRouterVite({
        routesDirectory: "./src/routes",
        generatedRouteTree: "./src/routeTree.gen.ts",
        enableRouteGeneration: false,
      }),
      react(),
      tailwindcss(),
      tsconfigPaths(),
      renameAndroidHtml(),
    ],

    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        env.VITE_SUPABASE_URL,
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY,
      ),
      // SSR globals not available in WebView
      "process.env": "{}",
      "process.env.SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL),
      "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY,
      ),
    },

    build: {
      outDir: "dist-android",
      emptyOutDir: true,
      rollupOptions: {
        input: "index.android.html",
      },
    },
  };
});

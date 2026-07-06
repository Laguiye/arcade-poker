import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Chemins relatifs dans le build → compatible GitHub Pages
  // (https://<compte>.github.io/arcade-poker/) sans toucher au dev local.
  base: "./",
  plugins: [react()],
  server: { port: 3010 },
});

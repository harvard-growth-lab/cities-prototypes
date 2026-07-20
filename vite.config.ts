import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" keeps every asset path relative, so the built `dist/` works
// dropped at a domain root, in a subfolder, or on a static host as-is.
export default defineConfig({
  base: "./",
  plugins: [react()],
});

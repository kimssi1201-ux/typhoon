import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://mustview.co.kr",
  output: "static",
  trailingSlash: "never",
  build: {
    format: "file"
  },
  vite: {
    cacheDir: ".astro/vite"
  }
});

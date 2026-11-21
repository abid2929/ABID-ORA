// Abidora: Astro builds page TEMPLATES (with {{key}} translation tokens) plus bundled, hashed JS/CSS.
// tools/publish.php then renders every page in all 10 languages into plain static HTML.
// The same PHP renderer runs on the server when the admin publishes translation edits.
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always', assets: '_astro' },
  compressHTML: true,
  devToolbar: { enabled: false },
  vite: {
    // every URL inside JS/CSS is emitted relative, so the site works in any subfolder (e.g. /abidora/)
    experimental: { renderBuiltUrl: () => ({ relative: true }) },
    build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
  },
});

import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { pages } from './src/js/config/pages.js';

const root = import.meta.dirname;

export default defineConfig({
  // Relative base so the built `dist/` folder works from any sub-path or static host.
  base: './',
  plugins: [tailwindcss()],
  build: {
    rolldownOptions: {
      input: {
        index: resolve(root, 'index.html'),
        ...Object.fromEntries(pages.map((id) => [id, resolve(root, `pages/${id}.html`)])),
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plugin to automatically duplicate index.html to 404.html in dist for GitHub Pages SPA routing
function spa404Plugin() {
  return {
    name: 'spa-404',
    closeBundle() {
      const distIndex = path.resolve(__dirname, 'dist/index.html');
      const dist404 = path.resolve(__dirname, 'dist/404.html');
      if (fs.existsSync(distIndex)) {
        fs.copyFileSync(distIndex, dist404);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), spa404Plugin()],
  base: '/',
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: false,
  },
});

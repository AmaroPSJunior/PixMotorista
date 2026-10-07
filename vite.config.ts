import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
  const appVersion = `v${packageJson.version || '0.0.0'}`;
  const deploySha = (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7);
  const deployBuild =
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_URL ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    'local';
  const deployedAt = new Date().toISOString();

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_DEPLOY_SHA': JSON.stringify(deploySha),
      'import.meta.env.VITE_DEPLOY_BUILD': JSON.stringify(deployBuild),
      'import.meta.env.VITE_DEPLOYED_AT': JSON.stringify(deployedAt),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

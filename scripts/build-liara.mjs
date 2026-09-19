import { build } from 'esbuild-wasm';
import { build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await viteBuild({
  configFile: false,
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist/client', emptyOutDir: true },
});

await build({
  absWorkingDir: projectDir,
  entryPoints: ['./liara-server.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'dist/server.js',
  packages: 'external',
  tsconfigRaw: {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
    },
  },
  minify: true,
});

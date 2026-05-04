import { defineConfig } from 'vite';
import path from 'node:path';

const r = (p: string) => path.resolve(__dirname, p);
const repo = (p: string) => path.resolve(__dirname, '../../', p);

export default defineConfig({
  root: __dirname,
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: false, // keep other outputs
    sourcemap: true,
    rollupOptions: {
      input: {
        content: r('src/content.ts'),
      },
      output: {
        entryFileNames: 'src/content.js',
        format: 'iife',
      },
    },
  },
  resolve: {
    alias: {
      '@extensions/shared': repo('packages/shared/src'),
      '@extensions/messaging': repo('packages/messaging/src'),
      '@extensions/ui': repo('packages/ui/src'),
      '@extensions/core': repo('packages/core/src'),
      '@extensions/client-sdk': repo('packages/client-sdk/src'),
      '@extensions/adapters': repo('packages/adapters/src'),
    },
  },
});



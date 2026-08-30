import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

// Minimal config to run server modules OUTSIDE SvelteKit: alias $lib and shim the
// $env/* virtual modules to read straight from process.env (populated from .env.local).
export default defineConfig({
  resolve: {
    alias: {
      $lib: path.resolve(root, '../src/lib'),
      '$env/dynamic/private': path.resolve(root, './shims/env-dynamic-private.ts'),
      '$env/static/private': path.resolve(root, './shims/env-static-private.ts'),
      '$env/static/public': path.resolve(root, './shims/env-static-public.ts'),
    },
  },
});

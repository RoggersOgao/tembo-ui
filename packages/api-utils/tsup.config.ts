import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    server: 'src/server/index.ts',
    client: 'src/client/index.ts',
    validation: 'src/validation/index.ts',
    core: 'src/core/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  external: ['express', 'zod'],
  target: 'node18',
  esbuildOptions(options) {
    options.conditions = ['import', 'require'];
    return options;
  },
  // Explicit rather than relying on tsup's package.json "type"
  // auto-detection: package.json's "exports" map expects ".mjs" for the
  // "import" condition and plain ".js" for "require", so pin the output
  // extensions to match regardless of what "type" (or its absence) tsup
  // infers.
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.js' : '.mjs' };
  },
});

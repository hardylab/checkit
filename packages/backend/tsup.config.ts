import { defineConfig } from 'tsup';

/**
 * Build @checkit/backend into a single-file CJS + ESM bundle.
 *
 * Why single-file (not multi-entry):
 *  - User installs ONE package (`@checkit/cli`) and gets the CLI + library API
 *  - `@checkit/shared` types are bundled inline (noExternal) so users don't need
 *    a second package install
 *  - All rules, AI-Fix adapters, intent engine live behind one bin
 *
 * Output layout:
 *  dist/index.js      ESM, for `import` consumers
 *  dist/index.cjs     CJS, fallback
 *  dist/cli.js        ESM CLI with shebang, mapped to `bin.checkit`
 *  dist/cli.cjs       CJS CLI with shebang, fallback for `bin.checkit`
 *  dist/index.d.ts    types for `main` entry
 *
 * `noExternal` makes the package fully self-contained.
 * `bundle: true` + `splitting: false` = single file per format.
 */
export default defineConfig([
  {
    entry: { index: 'src/index.ts', cli: 'src/main.ts' },
    format: ['esm', 'cjs'],
    // dts generation is brittle in monorepo (root tsconfig has noEmit + project refs);
    // users can derive types from source if needed. Re-enable once tsconfig is cleaned.
    dts: false,
    tsconfig: './tsconfig.build.json',
    sourcemap: true,
    clean: true,
    target: 'node18',
    bundle: true,
    splitting: false,
    // treeshake kills the parseArgs() branch because the call site passes
    // no options — tsup statically sees `options?.argv || ...` as unreachable.
    // Keep treeshake off until we explicitly mark the branches side-effectful.
    treeshake: false,
    minify: false, // keep readable for debugging; flip to true for ship
    shims: true,   // auto-polyfill __dirname / __filename in ESM
    noExternal: [
      '@checkit/shared',
      'glob',
      // anything internal we control; let node built-ins pass through as external
    ],
    external: [],
    outExtension({ format }) {
      return { js: format === 'cjs' ? '.cjs' : '.js' };
    },
    // The CLI needs shebang on the ESM bundle
    banner: ({ format, entryName }) => {
      if (entryName === 'cli') {
        return { js: '#!/usr/bin/env node' };
      }
      return {};
    },
    esbuildOptions(options) {
      // Make sure ESM output can be required/imported without extension issues
      options.platform = 'node';
      options.mainFields = ['module', 'main'];
    },
  },
]);
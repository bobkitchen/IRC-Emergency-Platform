/**
 * Build script for @irc/shared.
 *
 * Produces two outputs:
 * 1. dist/irc-shared.iife.js — IIFE bundle for vanilla JS apps (attaches to window.IRC)
 * 2. ES modules in src/ are used directly by the Navigator via npm workspaces
 */

import { build } from 'esbuild';
import { mkdirSync } from 'fs';

mkdirSync('dist', { recursive: true });

// IIFE bundle — exposes everything on window.IRCShared
// The vanilla JS apps' shim (irc-platform.js) maps this onto window.IRC
build({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'iife',
  globalName: 'IRCShared',
  outfile: 'dist/irc-shared.iife.js',
  target: ['es2020'],
  minify: false, // keep readable for debugging
  sourcemap: true,
}).then(() => {
  console.log('Built dist/irc-shared.iife.js');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

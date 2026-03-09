/**
 * Build script for Classification app.
 *
 * Copies the shared IIFE bundle into the app directory so that
 * the static HTML pages can load it via <script> tag.
 * Also copies design-tokens.css for shared styles.
 */

import { copyFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharedDir = resolve(__dirname, '../../packages/shared');

// Copy IIFE bundle
copyFileSync(
  resolve(sharedDir, 'dist/irc-shared.iife.js'),
  resolve(__dirname, 'irc-shared.iife.js')
);
console.log('Copied irc-shared.iife.js');

// Copy sourcemap
try {
  copyFileSync(
    resolve(sharedDir, 'dist/irc-shared.iife.js.map'),
    resolve(__dirname, 'irc-shared.iife.js.map')
  );
  console.log('Copied irc-shared.iife.js.map');
} catch (e) {
  // sourcemap is optional
}

// Copy design tokens CSS
copyFileSync(
  resolve(sharedDir, 'src/design-tokens.css'),
  resolve(__dirname, 'design-tokens.css')
);
console.log('Copied design-tokens.css');

/**
 * Build script for CRF Calculator app.
 * Copies the shared IIFE bundle and design tokens into the app directory.
 */

import { copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharedDir = resolve(__dirname, '../../packages/shared');

copyFileSync(
  resolve(sharedDir, 'dist/irc-shared.iife.js'),
  resolve(__dirname, 'irc-shared.iife.js')
);
console.log('Copied irc-shared.iife.js');

try {
  copyFileSync(
    resolve(sharedDir, 'dist/irc-shared.iife.js.map'),
    resolve(__dirname, 'irc-shared.iife.js.map')
  );
} catch (e) { /* optional */ }

copyFileSync(
  resolve(sharedDir, 'src/design-tokens.css'),
  resolve(__dirname, 'design-tokens.css')
);
console.log('Copied design-tokens.css');

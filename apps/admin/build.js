/**
 * Build script for IRC Admin app.
 * Copies the shared IIFE bundle, design tokens, and classification
 * data-access scripts (shared.js + supabase.js) into the app directory.
 */

import { copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharedDir = resolve(__dirname, '../../packages/shared');
const classificationDir = resolve(__dirname, '../classification');

// Shared IIFE bundle
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

// Design tokens
copyFileSync(
  resolve(sharedDir, 'src/design-tokens.css'),
  resolve(__dirname, 'design-tokens.css')
);
console.log('Copied design-tokens.css');

// Classification data-access layer (needed by Data tab)
copyFileSync(
  resolve(classificationDir, 'supabase.js'),
  resolve(__dirname, 'supabase.js')
);
console.log('Copied supabase.js');

copyFileSync(
  resolve(classificationDir, 'shared.js'),
  resolve(__dirname, 'shared.js')
);
console.log('Copied shared.js');

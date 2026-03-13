/**
 * Build script for Landing Page app.
 * Copies the shared design tokens into the app directory.
 */

import { copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharedDir = resolve(__dirname, '../../packages/shared');

copyFileSync(
  resolve(sharedDir, 'src/design-tokens.css'),
  resolve(__dirname, 'design-tokens.css')
);
console.log('Copied design-tokens.css');

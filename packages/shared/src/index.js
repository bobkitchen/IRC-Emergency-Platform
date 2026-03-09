/**
 * @irc/shared — Barrel export for all shared modules.
 *
 * Import from '@irc/shared' in the Navigator (React/Vite) app,
 * or load the IIFE bundle (irc-shared.iife.js) in vanilla JS apps.
 */

// Classification data
export { STANCE_MATRIX, COUNTRIES, THRESHOLDS, METRIC_CONFIGS } from './data.js';

// Supabase config & helpers
export {
  SUPABASE_URL, SUPABASE_KEY, TABLE, BASE_URL, HEADERS,
  TO_SNAKE, TO_CAMEL,
  mapToSnake, mapToCamel,
  fetchAll, fetchClassifications
} from './supabase.js';

// Utilities
export {
  uuid, formatNum, formatDate,
  isExpired, daysUntilExpiration,
  lookupStance, calculateSeverity, calculateOverallStance,
  findCountry
} from './utils.js';

// Site configuration
export { getSiteConfig, STORAGE_KEYS } from './site-config.js';

// Header rendering
export { renderHeader, renderFooter, initSiteSwitcher, IRC_LOGO_DATA_URI } from './header.js';

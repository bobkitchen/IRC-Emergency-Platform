/**
 * @irc/shared — Site configuration and cross-site navigation URLs.
 *
 * Detects environment (GitHub Pages, localhost, file://) and provides
 * correct URLs for all three IRC apps.
 */

/** Detect current hosting environment */
function detectEnvironment() {
  if (typeof window === 'undefined') return 'server';
  var hostname = window.location.hostname;
  if (hostname === 'bobkitchen.github.io') return 'github';
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'localhost';
  return 'file';
}

/** Build site configuration based on environment */
export function getSiteConfig() {
  var env = detectEnvironment();

  return {
    classification: {
      label: 'Emergency Classification',
      shortLabel: 'Classification',
      description: 'Classify and track emergency responses',
      url: env === 'github' ? '/emergency-classification/' : 'index.html',
      pages: [
        {id: 'dashboard', url: 'index.html', label: 'Dashboard'},
        {id: 'classify', url: 'classify.html', label: 'Classify'},
        {id: 'ask-albert', url: 'ask-albert.html', label: 'Ask Albert'},
        {id: 'data', url: 'data.html', label: 'Data'}
      ]
    },
    crf: {
      label: 'CRF Calculator',
      shortLabel: 'CRF',
      description: 'Crisis Response Fund allocation calculator',
      url: env === 'github' ? '/crf-calculator/' : 'allocation-calculator.html',
      pages: [
        {id: 'calculator', url: 'allocation-calculator.html', label: 'Calculator'},
        {id: 'ask-albert', url: 'ask-albert.html', label: 'Ask Albert'}
      ]
    },
    navigator: {
      label: 'Response Navigator',
      shortLabel: 'Navigator',
      description: 'Emergency response guidance and tasks',
      url: env === 'github' ? '/emergency-response-navigator/' : '/',
      pages: [
        {id: 'home', url: '', label: 'Home'},
        {id: 'navigator', url: 'navigator', label: 'Navigator'},
        {id: 'resources', url: 'resources', label: 'Resources'}
      ]
    }
  };
}

/**
 * Unified localStorage key names — converging the diverged keys
 * from Classification (`irc_openrouter_key`) and Navigator (`ern-api-key`).
 */
export const STORAGE_KEYS = {
  openRouterApiKey: 'irc_openrouter_api_key',
  openRouterModel: 'irc_openrouter_model',
  classifications: 'irc_classifications',
  theme: 'irc_theme',
  userPreferences: 'irc_user_preferences'
};

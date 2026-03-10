/**
 * @irc/shared — Unified header renderer.
 *
 * Generates the IRC header HTML with logo, site switcher, and nav.
 * Used by Classification, CRF Calculator (via IIFE bundle), and
 * as a reference for the Navigator's React header component.
 */

import { getSiteConfig, getSettingsUrl } from './site-config.js';

// IRC logo SVG inline
const IRC_LOGO_SVG = '<svg viewBox="0 0 217 216.99" xmlns="http://www.w3.org/2000/svg"><rect fill="#FDC62F" width="217" height="216.99"/><path fill="#00040C" d="M26.6,26.6h163.81v63.15h-55.22l55.22,55.22v45.44h-45.44l-55.22-55.21v55.21H26.6V26.6Z"/></svg>';

// Chat icon SVG (matches Navigator's lucide MessageCircle)
const CHAT_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';

// Gear icon SVG for settings link
const GEAR_ICON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

// Logo as data URI (for React/img tag usage)
export const IRC_LOGO_DATA_URI = 'data:image/svg+xml,' + encodeURIComponent('<svg viewBox="0 0 217 216.99" xmlns="http://www.w3.org/2000/svg"><rect fill="#FDC62F" width="217" height="216.99"/><path fill="#00040C" d="M26.6,26.6h163.81v63.15h-55.22l55.22,55.22v45.44h-45.44l-55.22-55.21v55.21H26.6V26.6Z"/></svg>');

/**
 * Render the unified IRC header as an HTML string.
 *
 * @param {string} activePage — id of the current page (e.g. 'dashboard', 'home')
 * @param {string} currentSite — 'classification' | 'navigator' | 'crf' (default: 'classification')
 * @returns {string} HTML string
 */
export function renderHeader(activePage, currentSite) {
  currentSite = currentSite || 'classification';
  var config = getSiteConfig();
  var site = config[currentSite];

  // Build site switcher with all sites
  var allSiteKeys = Object.keys(config);
  var switcherOptionsHtml = allSiteKeys.map(function(key) {
    var s = config[key];
    var isActive = key === currentSite;
    return '<a href="' + s.url + '" class="site-switcher-option' + (isActive ? ' active' : '') + '">' +
      '<span class="site-switcher-option-name">' + s.label + '</span>' +
      '<span class="site-switcher-option-desc">' + s.description + '</span>' +
    '</a>';
  }).join('');

  var switcherHtml =
    '<div class="site-switcher">' +
      '<button class="site-switcher-toggle" onclick="this.parentElement.classList.toggle(\'open\')" aria-expanded="false" aria-haspopup="true">' +
        '<span class="site-switcher-label">' + site.shortLabel + '</span>' +
        '<svg class="site-switcher-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</button>' +
      '<div class="site-switcher-dropdown">' + switcherOptionsHtml + '</div>' +
    '</div>';

  // Build page nav
  var navHtml = '<nav class="header-nav">';
  site.pages.forEach(function(page) {
    var isActive = activePage === page.id || activePage === page.url || activePage === page.label.toLowerCase();
    if (page.id === 'ask-albert') {
      navHtml += '<a href="' + page.url + '" class="ask-albert-btn' + (isActive ? ' active' : '') + '">' + CHAT_ICON_SVG + ' ' + page.label + '</a>';
    } else {
      navHtml += '<a href="' + page.url + '" class="' + (isActive ? 'active' : '') + '">' + page.label + '</a>';
    }
  });
  navHtml += '<a href="' + getSettingsUrl() + '" class="settings-gear-btn' + (activePage === 'settings' ? ' active' : '') + '" title="Settings">' + GEAR_ICON_SVG + '</a>';
  navHtml += '</nav>';

  // Mobile nav
  var mobileNavHtml = '<nav class="mobile-nav" id="mobile-nav">';
  site.pages.forEach(function(page) {
    var isActive = activePage === page.id || activePage === page.url || activePage === page.label.toLowerCase();
    if (page.id === 'ask-albert') {
      mobileNavHtml += '<a href="' + page.url + '" class="ask-albert-btn' + (isActive ? ' active' : '') + '">' + CHAT_ICON_SVG + ' ' + page.label + '</a>';
    } else {
      mobileNavHtml += '<a href="' + page.url + '" class="' + (isActive ? 'active' : '') + '">' + page.label + '</a>';
    }
  });
  mobileNavHtml += '<a href="' + getSettingsUrl() + '" class="settings-gear-btn' + (activePage === 'settings' ? ' active' : '') + '" title="Settings">' + GEAR_ICON_SVG + ' Settings</a>';
  mobileNavHtml += '</nav>';

  // Hamburger
  var hamburgerHtml =
    '<button class="mobile-menu-btn" onclick="var nav=document.getElementById(\'mobile-nav\');nav.classList.toggle(\'open\');this.setAttribute(\'aria-expanded\',nav.classList.contains(\'open\'))" aria-label="Menu" aria-expanded="false">' +
    '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor">' +
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>' +
    '</svg>' +
    '</button>';

  // Site title mapping
  var titles = {
    classification: { title: 'Emergency Classification', subtitle: 'a Global Crisis Analysis project' },
    navigator: { title: 'Emergency Response Navigator', subtitle: 'An Emergency Unit Project' },
    crf: { title: 'CRF Allocation Calculator', subtitle: 'Crisis Response Fund' },
    admin: { title: 'IRC Emergency Platform', subtitle: 'Administration' }
  };
  var t = titles[currentSite] || titles.classification;

  return '<header>' +
    '<div class="header-inner">' +
      switcherHtml +
      '<a href="' + site.url + '" class="header-brand">' +
        '<div class="logo-container">' + IRC_LOGO_SVG + '</div>' +
        '<div>' +
          '<div class="header-title">' + t.title + '</div>' +
          '<div class="header-subtitle">' + t.subtitle + '</div>' +
        '</div>' +
      '</a>' +
      navHtml +
      hamburgerHtml +
    '</div>' +
    mobileNavHtml +
  '</header>';
}

/**
 * Render the standard IRC footer.
 */
export function renderFooter() {
  return '<footer>' +
    '<div class="footer-inner">' +
      '<div class="footer-section">' +
        '<div class="footer-title">About This Tool</div>' +
        '<div class="footer-text">The Emergency Classification System assesses the scale and severity of new emergencies to inform IRC response decisions and resourcing. Classifications are aligned with the IRC\'s Who We Serve / Where We Work criteria, focusing resources where they are most needed based on client impact and IRC readiness to respond.</div>' +
      '</div>' +
      '<div class="footer-section">' +
        '<div class="footer-title">Methodology</div>' +
        '<div class="footer-text">Severity (1-10) is determined by comparing standard data points to historic emergencies. Response stances (White/Yellow/Orange/Red) indicate resource availability. White = outside mission scope. Each classification is open for 6 weeks, with reclassification rules enforcing escalation criteria.</div>' +
      '</div>' +
      '<div class="footer-legal">&copy; International Rescue Committee. For internal use only.</div>' +
    '</div>' +
  '</footer>';
}

/** Set up the click-outside-to-close handler for the site switcher */
export function initSiteSwitcher() {
  document.addEventListener('click', function(e) {
    var switcher = document.querySelector('.site-switcher');
    if (switcher && !switcher.contains(e.target)) {
      switcher.classList.remove('open');
    }
  });
}

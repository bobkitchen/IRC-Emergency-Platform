/**
 * IRC Platform shim for vanilla JS apps.
 *
 * Loads AFTER irc-shared.iife.js (which attaches IRCShared to window).
 * Maps shared exports onto the window.IRC namespace that existing
 * page code (index.html, classify.html, etc.) expects.
 *
 * This replaces the old shared.js — all data, utils, header, and site config
 * now come from @irc/shared.
 */
(function() {
  'use strict';

  var S = window.IRCShared;
  if (!S) {
    console.error('[IRC Platform] IRCShared not found. Make sure irc-shared.iife.js loads first.');
    return;
  }

  // Initialize IRC namespace
  window.IRC = window.IRC || {};

  // ── Data arrays ──
  window.IRC.STANCE_MATRIX = S.STANCE_MATRIX;
  window.IRC.COUNTRIES = S.COUNTRIES;
  window.IRC.THRESHOLDS = S.THRESHOLDS;
  window.IRC.METRIC_CONFIGS = S.METRIC_CONFIGS;

  // ── Utility functions ──
  window.IRC.uuid = S.uuid;
  window.IRC.formatNum = S.formatNum;
  window.IRC.formatDate = S.formatDate;
  window.IRC.isExpired = S.isExpired;
  window.IRC.daysUntilExpiration = S.daysUntilExpiration;
  window.IRC.lookupStance = S.lookupStance;
  window.IRC.calculateSeverity = S.calculateSeverity;
  window.IRC.calculateOverallStance = S.calculateOverallStance;

  // ── Site configuration ──
  window.IRC.siteConfig = S.getSiteConfig();

  // ── Header / Footer / Nav ──
  window.IRC.renderHeader = S.renderHeader;
  window.IRC.renderFooter = S.renderFooter;
  window.IRC.renderNav = function() { return ''; }; // nav is inside header

  // Initialize site switcher click-outside handler
  S.initSiteSwitcher();

  // ── Backwards-compatible localStorage wrappers ──
  // These will be overridden by supabase.js if it loads
  if (!window.IRC.getClassifications) {
    window.IRC.getClassifications = function() {
      var data = localStorage.getItem('irc_classifications');
      return data ? JSON.parse(data) : [];
    };
  }
  if (!window.IRC.saveClassifications) {
    window.IRC.saveClassifications = function(data) {
      localStorage.setItem('irc_classifications', JSON.stringify(data));
    };
  }

  // Data repair is handled by shared.js — no duplicate here

})();

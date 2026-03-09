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

  // ── Data repair ──
  window.IRC.repairData = function() {
    var repairKey = 'irc_data_repair_v2';
    if (localStorage.getItem(repairKey)) return;
    var data = window.IRC.getClassifications();
    if (!data.length) return;
    var needsRepair = data.some(function(c) {
      return c.reclassificationNumber && c.reclassificationNumber >= 100;
    });
    if (!needsRepair) {
      localStorage.setItem(repairKey, '1');
      return;
    }
    var groups = {};
    data.forEach(function(c) {
      var key = c.classificationId || c.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    var repaired = 0;
    for (var key in groups) {
      var group = groups[key];
      group.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
      for (var i = 0; i < group.length; i++) {
        var correct = i + 1;
        if (group[i].reclassificationNumber !== correct) {
          group[i].reclassificationNumber = correct;
          repaired++;
        }
      }
    }
    if (repaired > 0) {
      window.IRC.saveClassifications(data);
      console.log('[Data Repair] Fixed ' + repaired + ' reclassificationNumber values.');
    }
    localStorage.setItem(repairKey, '1');
  };

})();

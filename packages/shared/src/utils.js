/**
 * @irc/shared — Utility functions shared across all IRC apps.
 */

import { STANCE_MATRIX, COUNTRIES, THRESHOLDS } from './data.js';

/** Generate a v4 UUID */
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/** Format a number with locale separators */
export function formatNum(n) {
  if (typeof n !== 'number') return '0';
  return n.toLocaleString('en-US');
}

/** Format YYYY-MM-DD to readable date string */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  var parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  var date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Check if a classification is expired */
export function isExpired(expirationDate) {
  if (!expirationDate) return false;
  var exp = new Date(expirationDate);
  if (isNaN(exp.getTime())) return false;
  return new Date() > exp;
}

/** Days remaining until expiration (negative = overdue) */
export function daysUntilExpiration(expirationDate) {
  if (!expirationDate) return null;
  var exp = new Date(expirationDate);
  if (isNaN(exp.getTime())) return null;
  return Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24));
}

/**
 * Look up stance color from the STANCE_MATRIX.
 * @param {number} severity — 1-10
 * @param {number} pv — population vulnerability (1-4)
 * @param {number} rob — response operational burden (0-5)
 * @returns {string} 'white' | 'yellow' | 'orange' | 'red'
 */
export function lookupStance(severity, pv, rob) {
  if (!severity || !pv) return 'white';
  var s = STANCE_MATRIX[severity];
  if (!s) return 'white';
  var p = s[pv];
  if (!p) return 'white';
  return p[rob] || 'white';
}

/**
 * Calculate the severity score for a metric value against thresholds.
 * Returns 0-5.
 */
export function calculateSeverity(value, thresholds) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  var score = 0;
  for (var i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i][0]) score = thresholds[i][1];
  }
  return score;
}

/**
 * Calculate overall stance from an array of individual stances.
 * Applies escalation rules: 2+ orange → red, 3+ yellow → orange.
 */
export function calculateOverallStance(stances) {
  if (!stances || !stances.length) return 'white';
  var counts = { white: 0, yellow: 0, orange: 0, red: 0 };
  stances.forEach(function(s) { if (counts[s] !== undefined) counts[s]++; });
  var highest = 'white';
  if (counts.yellow > 0) highest = 'yellow';
  if (counts.orange > 0) highest = 'orange';
  if (counts.red > 0) highest = 'red';
  if (counts.orange >= 2) return 'red';
  if (counts.yellow >= 3) return 'orange';
  return highest;
}

/**
 * Look up a country by name. Returns [name, population, pv, rob] or null.
 */
export function findCountry(name) {
  if (!name) return null;
  var lower = name.toLowerCase();
  return COUNTRIES.find(function(c) { return c[0].toLowerCase() === lower; }) || null;
}

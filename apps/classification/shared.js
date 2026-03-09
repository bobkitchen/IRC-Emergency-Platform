(function() {
  'use strict';

  // ── Pull shared data from @irc/shared IIFE bundle ──
  var S = window.IRCShared || {};
  var STANCE_MATRIX = S.STANCE_MATRIX;
  var COUNTRIES = S.COUNTRIES;
  var THRESHOLDS = S.THRESHOLDS;
  var METRIC_CONFIGS = S.METRIC_CONFIGS;

  // COUNTRIES fallback removed — now loaded from @irc/shared
  // THRESHOLDS fallback removed — now loaded from @irc/shared
  // METRIC_CONFIGS fallback removed — now loaded from @irc/shared


  // Initialize IRC namespace
  window.IRC = window.IRC || {};

  // UUID generation
  window.IRC.uuid = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Format number with locale
  window.IRC.formatNum = function(n) {
    if (typeof n !== 'number') return '0';
    return n.toLocaleString('en-US');
  };

  // Format date from YYYY-MM-DD to readable format
  window.IRC.formatDate = function(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // getClassifications / saveClassifications are now provided by supabase.js
  // which loads before shared.js. They use Supabase with localStorage as cache.
  // If supabase.js hasn't loaded (fallback), define localStorage-only versions.
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

  // ── One-time data repair ──
  // Fixes records where reclassificationNumber was incorrectly parsed from a date column
  // (e.g. parseInt("2021-01-06") = 2021). Any value >= 100 is clearly wrong.
  // Groups records by classificationId and assigns sequential numbers (1 = initial, 2+ = reclass).
  window.IRC.repairData = function() {
    var repairKey = 'irc_data_repair_v2';
    if (localStorage.getItem(repairKey)) return; // already repaired

    var data = window.IRC.getClassifications();
    if (!data.length) return;

    var needsRepair = data.some(function(c) {
      return c.reclassificationNumber && c.reclassificationNumber >= 100;
    });
    if (!needsRepair) {
      localStorage.setItem(repairKey, '1');
      return;
    }

    console.log('[Data Repair] Detected corrupted reclassificationNumber values. Repairing...');

    // Group by classificationId
    var groups = {};
    data.forEach(function(c) {
      var key = c.classificationId || c.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    var repaired = 0;
    for (var key in groups) {
      var group = groups[key];
      // Sort by date ascending
      group.sort(function(a, b) {
        return (a.date || '').localeCompare(b.date || '');
      });
      // Assign sequential reclassification numbers
      for (var i = 0; i < group.length; i++) {
        var correct = i + 1; // 1 = initial, 2 = first reclass, etc.
        if (group[i].reclassificationNumber !== correct) {
          group[i].reclassificationNumber = correct;
          repaired++;
        }
      }
    }

    if (repaired > 0) {
      window.IRC.saveClassifications(data);
      console.log('[Data Repair] Fixed ' + repaired + ' records. Reclassification numbers reassigned by date order within each classification ID.');
    }
    localStorage.setItem(repairKey, '1');
  };

  // Run repair on load
  window.IRC.repairData();

  // Lookup stance in matrix
  window.IRC.lookupStance = function(severity, pv, rob) {
    var matrixSeverity = Math.min(Math.max(Math.ceil(severity * 2), 1), 10).toString();
    var matrixPV = Math.min(Math.max(pv, 1), 4).toString();
    var matrixROB = Math.min(Math.max(rob, 0), 5);

    if (STANCE_MATRIX[matrixSeverity] &&
        STANCE_MATRIX[matrixSeverity][matrixPV] &&
        STANCE_MATRIX[matrixSeverity][matrixPV][matrixROB] !== undefined) {
      return STANCE_MATRIX[matrixSeverity][matrixPV][matrixROB];
    }
    return 'white';
  };

  // Get severity for a specific metric
  window.IRC.getSeverityForMetric = function(type, metricId, value) {
    if (!THRESHOLDS[type] || !THRESHOLDS[type][metricId]) return 0;

    var thresholds = THRESHOLDS[type][metricId];
    for (var i = 0; i < thresholds.length; i++) {
      if (value < thresholds[i][0]) {
        return i === 0 ? 0 : thresholds[i - 1][1];
      }
    }
    return thresholds[thresholds.length - 1][1];
  };

  // Calculate overall severity from metrics
  window.IRC.calculateOverallSeverity = function(metrics) {
    var maxSeverity = 0;
    for (var key in metrics) {
      if (metrics.hasOwnProperty(key) && typeof metrics[key] === 'number' && metrics[key] > 0) {
        var severity = metrics[key];
        if (severity > maxSeverity) {
          maxSeverity = severity;
        }
      }
    }
    return maxSeverity;
  };

  // Debounce utility
  window.IRC.debounce = function(fn, delay) {
    var timeoutId;
    return function() {
      var context = this;
      var args = arguments;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(function() {
        fn.apply(context, args);
      }, delay);
    };
  };

  // Get data summary
  window.IRC.getDataSummary = function() {
    var classifications = window.IRC.getClassifications();
    var summary = {
      total: classifications.length,
      byStance: {white: 0, yellow: 0, orange: 0, red: 0},
      byType: {},
      byCountry: {},
      byRegion: {},
      bySeverity: {},
      dateRange: {earliest: null, latest: null}
    };

    if (classifications.length === 0) return summary;

    var dates = [];
    classifications.forEach(function(item) {
      var stance = (item.stance || '').toLowerCase();
      if (summary.byStance[stance] !== undefined) summary.byStance[stance]++;

      if (item.type) {
        summary.byType[item.type] = (summary.byType[item.type] || 0) + 1;
      }
      if (item.country) {
        var normCountry = window.IRC.normalizeCountry(item.country);
        summary.byCountry[normCountry] = (summary.byCountry[normCountry] || 0) + 1;
      }
      if (item.region) {
        // Group legacy regions for analysis purposes
        var groupedRegion = window.IRC.getGroupedRegion(item.region);
        summary.byRegion[groupedRegion] = (summary.byRegion[groupedRegion] || 0) + 1;
      }
      if (item.severity !== undefined && item.severity !== null && item.severity !== '') {
        var sev = item.severity.toString();
        summary.bySeverity[sev] = (summary.bySeverity[sev] || 0) + 1;
      }
      if (item.date) {
        dates.push(item.date);
      }
    });

    if (dates.length > 0) {
      dates.sort();
      summary.dateRange.earliest = dates[0];
      summary.dateRange.latest = dates[dates.length - 1];
    }

    return summary;
  };

  // Type labels — expanded to match historic data categories
  window.IRC.TYPE_LABELS = {
    conflict: 'Conflict',
    outbreak: 'Outbreak',
    food: 'Food Insecurity',
    hazard: 'Natural Hazards',
    migration: 'Migration',
    complex: 'Complex',
    disease: 'Disease',
    accident: 'Accident',
    other: 'Other'
  };

  // IRC Regions — current active regions (for new classifications)
  window.IRC.REGIONS = ['Asia', 'East Africa', 'LatAm', 'MENA', 'RAI', 'West and Central Africa'];

  // Legacy regions that were merged — used to group historic data in analysis
  window.IRC.REGION_GROUP_MAP = {
    'West Africa': 'West and Central Africa',
    'Great Lakes': 'West and Central Africa'
  };

  // All legacy region names (for display in historic data)
  window.IRC.LEGACY_REGIONS = ['Asia', 'East Africa', 'Great Lakes', 'LatAm', 'MENA', 'RAI', 'West Africa'];

  // Get the analysis/grouped region name for a record
  // Historic records keep their original region for display, but this returns the grouped name for analysis
  window.IRC.getGroupedRegion = function(region) {
    if (!region) return '';
    return window.IRC.REGION_GROUP_MAP[region] || region;
  };

  // Map incoming type strings (from spreadsheet) to internal keys
  window.IRC.normalizeType = function(raw) {
    if (!raw) return '';
    var s = raw.toString().trim().toLowerCase();
    var map = {
      'conflict': 'conflict',
      'outbreak': 'outbreak',
      'disease': 'disease',
      'food insecurity': 'food',
      'food': 'food',
      'natural event': 'hazard',
      'natural': 'hazard',
      'natural hazards': 'hazard',
      'hazard': 'hazard',
      'migration': 'migration',
      'complex': 'complex',
      'accident': 'accident',
      'other': 'other'
    };
    return map[s] || 'other';
  };

  // Normalize country name to canonical form
  // Maps abbreviations and variant spellings to the formal name used in COUNTRIES array
  var COUNTRY_ALIASES = {
    'car': 'Central African Republic',
    'drc': 'Democratic Republic of the Congo',
    'iran': 'Iran (Islamic Republic of)',
    'palestine': 'State of Palestine',
    'syria': 'Syrian Arab Republic',
    'tanzania': 'United Republic of Tanzania',
    'usa': 'United States of America',
    'venezuela': 'Venezuela (Bolivarian Republic of)',
    'vietnam': 'Viet Nam',
    'republic of moldova': 'Moldova (Republic of)',
    'moldova': 'Moldova (Republic of)',
    'congo': 'Congo',
    'barbuda': 'Antigua and Barbuda',
    'turkey': 'Turkey',
    'taiwan': 'Taiwan'
  };

  window.IRC.normalizeCountry = function(raw) {
    if (!raw) return '';
    var s = raw.toString().trim();
    var lower = s.toLowerCase();
    if (COUNTRY_ALIASES[lower]) return COUNTRY_ALIASES[lower];
    return s;
  };

  // Normalize stance string to lowercase key
  window.IRC.normalizeStance = function(raw) {
    if (!raw) return 'white';
    var s = raw.toString().trim().toLowerCase();
    if (['white', 'yellow', 'orange', 'red'].indexOf(s) !== -1) return s;
    return 'white';
  };

  // Stance colors
  window.IRC.STANCE_COLORS = {
    white: '#E9E9E9',
    yellow: '#FFC72C',
    orange: '#F58220',
    red: '#E52911'
  };

  // Stance descriptions — updated Jan 2025 to reflect WWS/WWW alignment
  window.IRC.STANCE_DESCRIPTIONS = {
    white: 'Outside Mission Scope — Emergency does not align with IRC Who We Serve / Where We Work criteria',
    yellow: 'Monitor & Prepare — IRC should make limited emergency resources available',
    orange: 'Mobilize — IRC should make significant emergency resources available',
    red: 'Maximum Response — IRC should make maximum possible resources available'
  };

  // Stance short labels for UI
  window.IRC.STANCE_SHORT = {
    white: 'Outside Mission',
    yellow: 'Monitor & Prepare',
    orange: 'Mobilize',
    red: 'Maximum Response'
  };

  // ── Classification Duration & Reclassification Rules ──

  // Each classification is open for 6 weeks (42 days)
  window.IRC.CLASSIFICATION_DURATION_DAYS = 42;

  // Processing speed tiers
  window.IRC.PROCESSING_SPEEDS = {
    standard: { label: 'Standard', processingDays: 5, inputHours: 48, finalInputHours: 24 },
    rapid: { label: 'Rapid', processingDays: 2, inputHours: 12, finalInputHours: 1 },
    immediate: { label: 'Immediate', processingHours: 12, inputHours: 1, finalInputHours: 0 }
  };

  // Calculate expiration date from notification date (6 weeks = 42 days)
  window.IRC.calculateExpirationDate = function(notificationDate) {
    if (!notificationDate) return '';
    var d = new Date(notificationDate);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + window.IRC.CLASSIFICATION_DURATION_DAYS);
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  };

  // Check if a reclassification is allowed based on rules:
  // Convention: 1 = initial classification, 2 = first reclassification, 3+ = subsequent
  // - 1st reclass (number=2): routine, allowed if emergency ongoing
  // - 2nd+ reclass (number=3+): severity must be higher than previous, unless Red 10
  window.IRC.canReclassify = function(reclassificationNumber, newSeverity, previousSeverity) {
    // First reclassification (number 2) is routine
    if (!reclassificationNumber || reclassificationNumber <= 2) return { allowed: true, reason: 'Routine reclassification' };
    // Red 10 can always be renewed
    if (previousSeverity === 10 && newSeverity === 10) return { allowed: true, reason: 'Red 10 renewal' };
    // Otherwise severity must increase
    if (newSeverity > previousSeverity) return { allowed: true, reason: 'Severity increased from ' + previousSeverity + ' to ' + newSeverity };
    return { allowed: false, reason: 'Further reclassification requires higher severity (current: ' + previousSeverity + ')' };
  };

  // Check if a closed classification can be reopened
  // Within 6 months: treated as reclassification, same code
  // After 6 months: new classification, new code
  window.IRC.checkReopenEligibility = function(closedDate) {
    if (!closedDate) return { type: 'new', reason: 'No closed date available' };
    var closed = new Date(closedDate);
    if (isNaN(closed.getTime())) return { type: 'new', reason: 'Invalid closed date' };
    var now = new Date();
    var monthsDiff = (now.getFullYear() - closed.getFullYear()) * 12 + (now.getMonth() - closed.getMonth());
    if (monthsDiff < 6) {
      return { type: 'reclassification', reason: 'Within 6 months — use same classification code' };
    }
    return { type: 'new', reason: 'Beyond 6 months — issue new classification code' };
  };

  // Complex emergency escalation rules
  // 3 Yellows → Orange, 2 Oranges → Red
  window.IRC.getComplexStance = function(stances) {
    if (!stances || !stances.length) return 'white';
    var counts = { white: 0, yellow: 0, orange: 0, red: 0 };
    stances.forEach(function(s) { if (counts[s] !== undefined) counts[s]++; });
    // Take highest individual stance first
    var highest = 'white';
    if (counts.yellow > 0) highest = 'yellow';
    if (counts.orange > 0) highest = 'orange';
    if (counts.red > 0) highest = 'red';
    // Apply escalation rules
    if (counts.orange >= 2) return 'red';
    if (counts.yellow >= 3) return 'orange';
    return highest;
  };

  // Check if classification is expired
  window.IRC.isExpired = function(expirationDate) {
    if (!expirationDate) return false;
    var exp = new Date(expirationDate);
    if (isNaN(exp.getTime())) return false;
    return new Date() > exp;
  };

  // Days remaining until expiration
  window.IRC.daysUntilExpiration = function(expirationDate) {
    if (!expirationDate) return null;
    var exp = new Date(expirationDate);
    if (isNaN(exp.getTime())) return null;
    var now = new Date();
    var diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // ── Site configuration — now from @irc/shared (includes all 3 sites) ──
  window.IRC.siteConfig = S.getSiteConfig();

  // ── Bridge to @irc/shared header/footer (shows all 3 sites in switcher) ──
  window.IRC.renderHeader = function(activePage, currentSite) {
    return S.renderHeader(activePage, currentSite || 'classification');
  };
  window.IRC.renderFooter = S.renderFooter;
  window.IRC.renderNav = function() { return ''; };

  // Close site-switcher when clicking outside
  S.initSiteSwitcher();

  // Expose data arrays to IRC namespace
  window.IRC.STANCE_MATRIX = STANCE_MATRIX;
  window.IRC.COUNTRIES = COUNTRIES;
  window.IRC.THRESHOLDS = THRESHOLDS;
  window.IRC.METRIC_CONFIGS = METRIC_CONFIGS;

})();

/**
 * @irc/shared — Supabase configuration and field mappings.
 *
 * Single source of truth for database access across all IRC apps.
 */

export const SUPABASE_URL = 'https://qykjjfbdvwqxqmsgiebs.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5a2pqZmJkdndxeHFtc2dpZWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjg1NzcsImV4cCI6MjA4ODYwNDU3N30.N3XWpfTggpjHu8Kyw0DWnYnZvBqA1aVuWEJixo_ibAw';
export const TABLE = 'classifications';

export const BASE_URL = SUPABASE_URL + '/rest/v1/' + TABLE;

// Standard headers for all Supabase REST calls
export const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// camelCase → snake_case mapping (27 fields)
export const TO_SNAKE = {
  classificationId: 'classification_id',
  emergencyName: 'emergency_name',
  expirationDate: 'expiration_date',
  processingSpeed: 'processing_speed',
  reclassificationNumber: 'reclassification_number',
  previousSeverity: 'previous_severity',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  totalAffected: 'total_affected',
  linkToSpreadsheet: 'link_to_spreadsheet',
  ipc4Used: 'ipc4_used',
  hazardType: 'hazard_type',
  sapTracking: 'sap_tracking',
  uniqueId: 'unique_id',
  dateRequestReceived: 'date_request_received',
  dateSentForEntry: 'date_sent_for_entry',
  dateReviewed: 'date_reviewed',
  dateApproved: 'date_approved',
  dateExpirationNoticeSent: 'date_expiration_notice_sent',
  whoEngagesCp: 'who_engages_cp',
  entryBy: 'entry_by',
  reviewedBy: 'reviewed_by',
  approvedBy: 'approved_by',
  notifSentBy: 'notif_sent_by',
  raisedWithCpRegion: 'raised_with_cp_region',
  codeNumber: 'code_number'
};

// Reverse mapping: snake_case → camelCase
export const TO_CAMEL = {};
for (const k in TO_SNAKE) TO_CAMEL[TO_SNAKE[k]] = k;

/**
 * Convert a camelCase record to snake_case for Supabase.
 * Also handles type coercion, date validation, and JSONB fields.
 */
export function mapToSnake(record) {
  const out = {};
  for (const key in record) {
    if (!record.hasOwnProperty(key)) continue;
    out[TO_SNAKE[key] || key] = record[key];
  }
  // Convert empty strings to null for constrained columns
  ['type', 'stance', 'country', 'emergency_name', 'region',
   'processing_speed', 'classification_id', 'date', 'expiration_date',
   'link_to_spreadsheet', 'hazard_type', 'sap_tracking', 'unique_id',
   'who_engages_cp', 'entry_by', 'reviewed_by', 'approved_by', 'notif_sent_by',
   'raised_with_cp_region', 'code_number',
   'date_request_received', 'date_sent_for_entry', 'date_reviewed',
   'date_approved', 'date_expiration_notice_sent'].forEach(function (f) {
    if (out[f] === '') out[f] = null;
  });
  // Boolean fields
  if (out.ipc4_used !== null && out.ipc4_used !== undefined) {
    if (typeof out.ipc4_used === 'string') {
      out.ipc4_used = out.ipc4_used.toLowerCase() === 'yes' || out.ipc4_used === 'true' || out.ipc4_used === '1';
    }
  }
  // Numeric: total_affected
  if (out.total_affected !== null && out.total_affected !== undefined) {
    out.total_affected = parseFloat(out.total_affected);
    if (isNaN(out.total_affected)) out.total_affected = null;
  }
  // Validate date fields — only YYYY-MM-DD or null
  ['date', 'expiration_date', 'date_request_received', 'date_sent_for_entry',
   'date_reviewed', 'date_approved', 'date_expiration_notice_sent'].forEach(function (f) {
    if (out[f] !== null && out[f] !== undefined && out[f] !== '') {
      var dStr = out[f].toString().trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
        var d = new Date(dStr);
        if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
          var yyyy = d.getFullYear();
          var mm = String(d.getMonth() + 1).padStart(2, '0');
          var dd = String(d.getDate()).padStart(2, '0');
          out[f] = yyyy + '-' + mm + '-' + dd;
        } else {
          out[f] = null;
        }
      }
    }
  });
  // Ensure JSONB fields are objects
  ['metrics', 'confidence', 'subnational'].forEach(function (f) {
    if (typeof out[f] === 'string') {
      try { out[f] = JSON.parse(out[f]); } catch (e) { out[f] = {}; }
    }
    if (out[f] === '' || out[f] === null || out[f] === undefined) out[f] = null;
  });
  // Ensure numeric fields
  if (out.severity !== null && out.severity !== undefined) {
    out.severity = parseInt(out.severity, 10);
    if (isNaN(out.severity)) out.severity = null;
  }
  if (out.reclassification_number !== null && out.reclassification_number !== undefined) {
    out.reclassification_number = parseInt(out.reclassification_number, 10);
    if (isNaN(out.reclassification_number)) out.reclassification_number = null;
  }
  if (out.previous_severity !== null && out.previous_severity !== undefined) {
    out.previous_severity = parseInt(out.previous_severity, 10);
    if (isNaN(out.previous_severity)) out.previous_severity = null;
  }
  return out;
}

/**
 * Convert a snake_case Supabase row to camelCase.
 */
export function mapToCamel(row) {
  const out = {};
  for (const key in row) {
    if (!row.hasOwnProperty(key)) continue;
    out[TO_CAMEL[key] || key] = row[key];
  }
  return out;
}

/**
 * Paginated fetch — handles PostgREST max-rows limit (default 1000).
 * Fetches PAGE_SIZE rows at a time until fewer rows come back.
 */
const PAGE_SIZE = 1000;

export function fetchAll(url) {
  const accumulated = [];
  const joiner = url.indexOf('?') === -1 ? '?' : '&';

  function fetchPage(offset) {
    const pageUrl = url + joiner + 'limit=' + PAGE_SIZE + '&offset=' + offset;
    return fetch(pageUrl, { headers: HEADERS })
      .then(function (res) {
        if (!res.ok) throw new Error('Supabase fetch failed: ' + res.status);
        return res.json();
      })
      .then(function (rows) {
        accumulated.push(...rows);
        if (rows.length >= PAGE_SIZE) return fetchPage(offset + PAGE_SIZE);
        return accumulated;
      });
  }
  return fetchPage(0);
}

/**
 * Fetch all classifications, mapped to camelCase.
 * Returns empty array on failure.
 */
export function fetchClassifications() {
  return fetchAll(BASE_URL + '?order=date.desc.nullslast')
    .then(function (rows) {
      return rows.map(mapToCamel);
    })
    .catch(function (err) {
      console.warn('[Supabase] Failed to fetch classifications:', err);
      return [];
    });
}

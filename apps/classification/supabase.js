/**
 * Supabase data access layer for IRC Emergency Classification System.
 *
 * Replaces localStorage with Supabase PostgreSQL.
 * localStorage is kept as a write-through cache for offline/fast access.
 *
 * Usage:  await IRC.db.load()          — fetch all from Supabase (call on page load)
 *         IRC.db.getAll()              — return cached array (sync, fast)
 *         await IRC.db.save(record)    — upsert one record
 *         await IRC.db.remove(id)      — delete one record
 *         await IRC.db.importBatch(arr, replace) — bulk import (CSV/Excel flow)
 */
(function () {
  'use strict';

  // ── Supabase config ──
  var SUPABASE_URL = 'https://qykjjfbdvwqxqmsgiebs.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5a2pqZmJkdndxeHFtc2dpZWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjg1NzcsImV4cCI6MjA4ODYwNDU3N30.N3XWpfTggpjHu8Kyw0DWnYnZvBqA1aVuWEJixo_ibAw';
  var TABLE = 'classifications';

  // REST helpers — no SDK needed, just fetch against PostgREST
  var headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  var baseUrl = SUPABASE_URL + '/rest/v1/' + TABLE;

  // ── camelCase ↔ snake_case mapping ──
  var toSnake = {
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
  var toCamel = {};
  for (var k in toSnake) toCamel[toSnake[k]] = k;

  function mapToSnake(record) {
    var out = {};
    for (var key in record) {
      if (!record.hasOwnProperty(key)) continue;
      var dbKey = toSnake[key] || key;
      out[dbKey] = record[key];
    }
    // Convert empty strings to null for constrained/typed columns
    // (spreadsheet imports often produce '' for missing values)
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
    // Validate all date fields — reject anything that isn't YYYY-MM-DD or empty
    ['date', 'expiration_date', 'date_request_received', 'date_sent_for_entry',
     'date_reviewed', 'date_approved', 'date_expiration_notice_sent'].forEach(function (f) {
      if (out[f] !== null && out[f] !== undefined && out[f] !== '') {
        var dStr = out[f].toString().trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
          // Try to parse it
          var d = new Date(dStr);
          if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
            var yyyy = d.getFullYear();
            var mm = String(d.getMonth() + 1).padStart(2, '0');
            var dd = String(d.getDate()).padStart(2, '0');
            out[f] = yyyy + '-' + mm + '-' + dd;
          } else {
            out[f] = null; // unparseable — null it out instead of crashing
          }
        }
      }
    });
    // Ensure JSONB fields are objects not strings
    ['metrics', 'confidence', 'subnational'].forEach(function (f) {
      if (typeof out[f] === 'string') {
        try { out[f] = JSON.parse(out[f]); } catch (e) { out[f] = {}; }
      }
      if (out[f] === '' || out[f] === null || out[f] === undefined) out[f] = null;
    });
    // Ensure numeric fields are numbers or null
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

  function mapToCamel(row) {
    var out = {};
    for (var key in row) {
      if (!row.hasOwnProperty(key)) continue;
      var jsKey = toCamel[key] || key;
      out[jsKey] = row[key];
    }
    return out;
  }

  // ── In-memory cache ──
  var cache = null; // array of camelCase records, or null if not yet loaded

  // ── localStorage helpers (cache persistence for offline) ──
  var LS_KEY = 'irc_classifications';
  function writeLocalCache(arr) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch (e) { /* full */ }
  }
  function readLocalCache() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  // ── Fetch helper that paginates past PostgREST 1000-row server limit ──
  //
  // Supabase caps each response at max-rows (default 1000).
  // We paginate with limit/offset, fetching 1000 at a time until we
  // get back fewer rows than requested (meaning we've hit the end).
  var PAGE_SIZE = 1000;
  function fetchAll(url) {
    var accumulated = [];
    var joiner = url.indexOf('?') === -1 ? '?' : '&';

    function fetchPage(offset) {
      var pageUrl = url + joiner + 'limit=' + PAGE_SIZE + '&offset=' + offset;
      console.log('[Supabase] fetchAll page offset=' + offset);
      return fetch(pageUrl, { headers: headers })
        .then(function (res) {
          if (!res.ok) {
            throw new Error('Supabase fetch failed: ' + res.status);
          }
          return res.json();
        })
        .then(function (rows) {
          console.log('[Supabase] fetchAll got ' + rows.length + ' rows (offset ' + offset + ')');
          accumulated = accumulated.concat(rows);
          if (rows.length >= PAGE_SIZE) {
            return fetchPage(offset + PAGE_SIZE);
          }
          console.log('[Supabase] fetchAll total: ' + accumulated.length + ' rows');
          return accumulated;
        });
    }

    return fetchPage(0);
  }

  // ── Public API ──
  window.IRC = window.IRC || {};
  window.IRC.db = {

    /** True once the first Supabase fetch has completed */
    loaded: false,

    /**
     * Fetch all classifications from Supabase.
     * Falls back to localStorage if Supabase is unreachable.
     * Call this once on page load.
     */
    load: function () {
      return fetchAll(baseUrl + '?order=date.desc.nullslast')
        .then(function (rows) {
          cache = rows.map(mapToCamel);
          writeLocalCache(cache);
          IRC.db.loaded = true;
          console.log('[Supabase] Loaded ' + cache.length + ' classifications');
          return cache;
        })
        .catch(function (err) {
          console.warn('[Supabase] Fetch failed, using localStorage fallback:', err.message);
          cache = readLocalCache();
          IRC.db.loaded = true;
          return cache;
        });
    },

    /**
     * Return cached classifications (synchronous).
     * If load() hasn't been called yet, returns localStorage data.
     */
    getAll: function () {
      if (cache === null) cache = readLocalCache();
      return cache;
    },

    /**
     * Upsert a single classification record.
     * Writes to Supabase first, then updates local cache.
     */
    save: function (record) {
      var row = mapToSnake(record);
      // Remove updated_at so the trigger handles it
      delete row.updated_at;

      return fetch(baseUrl + '?on_conflict=id', {
        method: 'POST',
        headers: Object.assign({}, headers, { 'Prefer': 'return=representation,resolution=merge-duplicates' }),
        body: JSON.stringify(row)
      })
        .then(function (res) {
          if (!res.ok) return res.text().then(function (t) { throw new Error(t); });
          return res.json();
        })
        .then(function (rows) {
          var saved = mapToCamel(rows[0]);
          // Update cache
          if (cache === null) cache = readLocalCache();
          var idx = cache.findIndex(function (c) { return c.id === saved.id; });
          if (idx >= 0) { cache[idx] = saved; } else { cache.push(saved); }
          writeLocalCache(cache);
          return saved;
        })
        .catch(function (err) {
          console.error('[Supabase] Save failed:', err.message);
          // Fallback: save to localStorage only
          if (cache === null) cache = readLocalCache();
          var idx = cache.findIndex(function (c) { return c.id === record.id; });
          if (idx >= 0) { cache[idx] = record; } else { cache.push(record); }
          writeLocalCache(cache);
          return record;
        });
    },

    /**
     * Delete a classification by id.
     */
    remove: function (id) {
      return fetch(baseUrl + '?id=eq.' + id, {
        method: 'DELETE',
        headers: headers
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Delete failed: ' + res.status);
        })
        .then(function () {
          if (cache) {
            cache = cache.filter(function (c) { return c.id !== id; });
            writeLocalCache(cache);
          }
        })
        .catch(function (err) {
          console.error('[Supabase] Delete failed:', err.message);
          // Fallback: remove from localStorage
          if (cache) {
            cache = cache.filter(function (c) { return c.id !== id; });
            writeLocalCache(cache);
          }
        });
    },

    /**
     * Bulk import: used by data.html CSV/Excel import.
     * If replace=true, clears all existing records first.
     *
     * SAFETY: inserts all new data FIRST, then deletes old data.
     * This prevents data loss if the insert fails partway through.
     */
    importBatch: function (records, replace) {
      var rows = records.map(mapToSnake);
      // Remove updated_at from all rows
      rows.forEach(function (r) { delete r.updated_at; });

      // Collect the IDs of all newly-inserted rows so we can identify old ones
      var newIds = [];

      // Batch insert in chunks of 200 (smaller chunks = better error isolation)
      var chunks = [];
      for (var i = 0; i < rows.length; i += 200) {
        chunks.push(rows.slice(i, i + 200));
      }

      var insertErrors = [];

      // Step 1: Insert all new records (upsert to handle any overlapping IDs)
      return chunks.reduce(function (chain, chunk, chunkIdx) {
        return chain.then(function () {
          return fetch(baseUrl, {
            method: 'POST',
            headers: Object.assign({}, headers, { 'Prefer': 'return=representation,resolution=merge-duplicates' }),
            body: JSON.stringify(chunk)
          }).then(function (res) {
            if (!res.ok) {
              return res.text().then(function (t) {
                console.error('[Supabase] Chunk ' + chunkIdx + ' failed:', t);
                insertErrors.push('Chunk ' + chunkIdx + ': ' + t);
                // Continue with remaining chunks instead of aborting
              });
            }
            return res.json().then(function (inserted) {
              if (inserted && inserted.length) {
                inserted.forEach(function (r) { newIds.push(r.id); });
              }
            });
          });
        });
      }, Promise.resolve())
        .then(function () {
          if (insertErrors.length > 0) {
            console.warn('[Supabase] ' + insertErrors.length + ' chunk(s) failed during import');
          }

          // Step 2: If replace mode AND we inserted at least some records,
          // delete old records (those whose IDs are NOT in the newly-inserted set)
          if (replace && newIds.length > 0) {
            // Delete in batches to avoid URL-length issues
            // Use a NOT-IN approach: delete where id not in new set
            // PostgREST doesn't support large NOT-IN via URL, so we use
            // a created_at threshold: old records have older created_at
            // Simpler approach: delete everything, then re-insert is risky.
            // Safest: use RPC or just delete by old IDs.
            // Best approach: fetch all current IDs, diff with newIds, delete the diff.
            return fetchAll(baseUrl + '?select=id')
              .then(function (allRows) {
                var newIdSet = {};
                newIds.forEach(function (id) { newIdSet[id] = true; });
                var toDelete = allRows
                  .map(function (r) { return r.id; })
                  .filter(function (id) { return !newIdSet[id]; });

                if (toDelete.length === 0) return;

                // Delete old records in batches of 100
                var delChunks = [];
                for (var d = 0; d < toDelete.length; d += 100) {
                  delChunks.push(toDelete.slice(d, d + 100));
                }
                return delChunks.reduce(function (dChain, delBatch) {
                  return dChain.then(function () {
                    var idList = delBatch.map(function (id) { return '"' + id + '"'; }).join(',');
                    return fetch(baseUrl + '?id=in.(' + idList + ')', {
                      method: 'DELETE',
                      headers: headers
                    });
                  });
                }, Promise.resolve());
              });
          }
        })
        .then(function () {
          // Reload cache from Supabase
          return IRC.db.load();
        })
        .then(function (data) {
          if (insertErrors.length > 0) {
            console.warn('[Supabase] Import completed with ' + insertErrors.length + ' error(s). ' + newIds.length + ' records inserted successfully.');
          }
          return data;
        });
    },

    /**
     * Delete all records from Supabase. Used by "Delete All" button.
     */
    clearAll: function () {
      return fetch(baseUrl + '?id=not.is.null', { method: 'DELETE', headers: headers })
        .then(function (res) {
          if (!res.ok) throw new Error('Clear failed: ' + res.status);
          cache = [];
          writeLocalCache([]);
        });
    },

    /**
     * One-time migration: if Supabase is empty but localStorage has data,
     * push localStorage records up to Supabase.
     */
    migrateFromLocalStorage: function () {
      var MIGRATE_KEY = 'irc_supabase_migrated_v1';
      if (localStorage.getItem(MIGRATE_KEY)) return Promise.resolve();

      var local = readLocalCache();
      if (!local.length) {
        localStorage.setItem(MIGRATE_KEY, '1');
        return Promise.resolve();
      }

      // Check if Supabase already has data
      return fetch(baseUrl + '?select=id&limit=1', { headers: headers })
        .then(function (res) { return res.json(); })
        .then(function (rows) {
          if (rows.length > 0) {
            // Supabase already has data — skip migration
            localStorage.setItem(MIGRATE_KEY, '1');
            return;
          }
          console.log('[Supabase] Migrating ' + local.length + ' records from localStorage...');
          return IRC.db.importBatch(local, false).then(function () {
            localStorage.setItem(MIGRATE_KEY, '1');
            console.log('[Supabase] Migration complete.');
          });
        })
        .catch(function (err) {
          console.warn('[Supabase] Migration deferred:', err.message);
        });
    }
  };

  // ── Backwards-compatible wrappers ──
  // These replace the old localStorage-only functions so existing page code
  // continues to work without changes (sync calls use cache).
  window.IRC.getClassifications = function () {
    return IRC.db.getAll();
  };

  window.IRC.saveClassifications = function (data) {
    writeLocalCache(data);
    cache = data;
  };

})();

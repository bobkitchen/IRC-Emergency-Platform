/**
 * Supabase Edge Function: /sync-classifications
 *
 * Downloads the IRC Classification Tracking Table from SharePoint,
 * parses it, and upserts new/changed rows into the classifications table.
 *
 * Trigger: POST request (from admin dashboard "Sync Now" button or pg_cron)
 * No auth required on the SharePoint link (public shared file).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// SharePoint direct download URL (derived from sharing link)
const SHAREPOINT_DOWNLOAD_URL =
  Deno.env.get('SHAREPOINT_CLASSIFICATION_URL') ||
  'https://intrescue-my.sharepoint.com/personal/tom_joseph_rescue_org/_layouts/15/download.aspx?share=EZ0I2r4fxU5HjCH3RuNPeI0BEKwGNMcSy7IwMsiTeB7DEw';

const ALLOWED_ORIGINS = [
  'https://bobkitchen.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
];

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ── Column index mapping (from Tracker sheet header row) ──
// Header row (index 1) columns:
//  0: Expiration Date
//  1: code#
//  2: Start reclass (unused)
//  3: "Enter yes here..." (unused)
//  4: Class ID
//  5: ReClassification Count
//  6: Unique ID
//  7: SAP Tracking
//  8: Country
//  9: IRC Region
// 10: Date Expiration Notice Sent
// 11: Date Request Received
// 12: Who Engages CP
// 13: Date Sent for Entry
// 14: Entry By
// 15: Link to Spreadsheet
// 16: Date Reviewed
// 17: Reviewed By
// 18: Raised with CP/region
// 19: Date Approved
// 20: Approved By
// 21: notif_sent (Date Notification Sent)
// 22: Notif Sent By
// 23: Stance
// 24: Severity
// 25: Emergency_Details
// 26: Emergency Type
// 27: IPC 4+ Food Insecurity Used?
// 28: Notes
// 29: Total Affected
// 30: Type of natural hazard

const COL = {
  expirationDate: 0,
  codeNumber: 1,
  classificationId: 4,
  reclassificationNumber: 5,
  uniqueId: 6,
  sapTracking: 7,
  country: 8,
  region: 9,
  dateExpirationNoticeSent: 10,
  dateRequestReceived: 11,
  whoEngagesCp: 12,
  dateSentForEntry: 13,
  entryBy: 14,
  linkToSpreadsheet: 15,
  dateReviewed: 16,
  reviewedBy: 17,
  raisedWithCpRegion: 18,
  dateApproved: 19,
  approvedBy: 20,
  date: 21, // "notif_sent" = Date Notification Sent
  notifSentBy: 22,
  stance: 23,
  severity: 24,
  emergencyName: 25,
  type: 26,
  ipc4Used: 27,
  notes: 28,
  totalAffected: 29,
  hazardType: 30,
};

// ── Normalization helpers (matching shared.js logic) ──

function normalizeStance(raw: string | null): string {
  if (!raw) return 'white';
  const s = raw.toString().trim().toLowerCase();
  if (['white', 'yellow', 'orange', 'red'].includes(s)) return s;
  return 'white';
}

function normalizeType(raw: string | null): string {
  if (!raw) return '';
  const s = raw.toString().trim().toLowerCase();
  const map: Record<string, string> = {
    conflict: 'conflict',
    outbreak: 'outbreak',
    disease: 'disease',
    'food insecurity': 'food',
    food: 'food',
    'natural event': 'hazard',
    natural: 'hazard',
    'natural hazards': 'hazard',
    hazard: 'hazard',
    migration: 'migration',
    complex: 'complex',
    accident: 'accident',
    other: 'other',
  };
  return map[s] || 'other';
}

const COUNTRY_ALIASES: Record<string, string> = {
  car: 'Central African Republic',
  drc: 'Democratic Republic of the Congo',
  iran: 'Iran (Islamic Republic of)',
  palestine: 'State of Palestine',
  syria: 'Syrian Arab Republic',
  tanzania: 'United Republic of Tanzania',
  usa: 'United States of America',
  venezuela: 'Venezuela (Bolivarian Republic of)',
  vietnam: 'Viet Nam',
  'republic of moldova': 'Moldova (Republic of)',
  moldova: 'Moldova (Republic of)',
  congo: 'Congo',
  barbuda: 'Antigua and Barbuda',
  turkey: 'Turkey',
  taiwan: 'Taiwan',
};

function normalizeCountry(raw: string | null): string {
  if (!raw) return '';
  const s = raw.toString().trim();
  return COUNTRY_ALIASES[s.toLowerCase()] || s;
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  const str = val.toString().trim();
  if (!str || str.length < 4) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Try parsing
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(val.toString());
  return isNaN(n) ? null : n;
}

function parseInt2(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(val.toString(), 10);
  return isNaN(n) ? null : n;
}

function calculateExpirationDate(notificationDate: string): string | null {
  if (!notificationDate) return null;
  const d = new Date(notificationDate);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 42); // 6 weeks
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getStr(row: unknown[], idx: number): string {
  const val = row[idx];
  if (val === null || val === undefined) return '';
  return val.toString().trim();
}

// ── Main sync logic ──

interface SyncResult {
  downloaded: boolean;
  totalRows: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: number;
  duration: number;
  errorDetails?: string[];
}

async function syncClassifications(): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    downloaded: false,
    totalRows: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    duration: 0,
  };

  // 1. Download the Excel file
  console.log('[sync] Downloading from SharePoint...');
  const response = await fetch(SHAREPOINT_DOWNLOAD_URL);
  if (!response.ok) {
    throw new Error(`SharePoint download failed: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  result.downloaded = true;
  console.log(`[sync] Downloaded ${(arrayBuffer.byteLength / 1024).toFixed(0)} KB`);

  // 2. Parse the workbook
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: false, raw: false });
  console.log('[sync] Sheets:', workbook.SheetNames.join(', '));

  // 3. Build classname map (ClassID → Emergency Name)
  const classnameMap: Record<string, string> = {};
  const cnSheet = workbook.Sheets['classname'];
  if (cnSheet) {
    const cnData = XLSX.utils.sheet_to_json(cnSheet, { raw: false }) as Record<string, string>[];
    for (const row of cnData) {
      const id = (row['ClassID'] || row['Class ID'] || '').toString().trim();
      const name = (row['Name'] || row['Emergency Name'] || '').toString().trim();
      if (id && name) classnameMap[id] = name;
    }
    console.log(`[sync] Loaded ${Object.keys(classnameMap).length} classname mappings`);
  }

  // 4. Parse Tracker sheet
  const trackerSheet = workbook.Sheets['Tracker'];
  if (!trackerSheet) throw new Error('Tracker sheet not found');

  const rawData = XLSX.utils.sheet_to_json(trackerSheet, {
    header: 1,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  }) as unknown[][];

  // Header is row 1, data starts at row 2
  const dataRows = rawData.slice(2).filter((row) => row && row[COL.country]);
  result.totalRows = dataRows.length;
  console.log(`[sync] Found ${dataRows.length} data rows`);

  // 5. Fetch existing records from DB (for diff)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch all existing unique_ids for fast lookup
  const { data: existingRows, error: fetchError } = await supabase
    .from('classifications')
    .select('id, unique_id, classification_id, reclassification_number, stance, severity, type, emergency_name, date');

  if (fetchError) throw new Error(`DB fetch failed: ${fetchError.message}`);

  // Build lookup indexes
  const byUniqueId: Record<string, typeof existingRows[0]> = {};
  const byClassReclass: Record<string, typeof existingRows[0]> = {};
  for (const row of existingRows || []) {
    if (row.unique_id) byUniqueId[row.unique_id] = row;
    if (row.classification_id) {
      byClassReclass[`${row.classification_id}:${row.reclassification_number || 1}`] = row;
    }
  }
  console.log(`[sync] ${existingRows?.length || 0} existing records in DB`);

  // 6. Process each row → build upsert batch
  const toUpsert: Record<string, unknown>[] = [];
  const errorDetails: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    try {
      const country = normalizeCountry(getStr(row, COL.country));
      if (!country) continue;

      const classId = getStr(row, COL.classificationId);
      const reclassNum = parseInt2(row[COL.reclassificationNumber]) || 1;
      const uniqueId = getStr(row, COL.uniqueId);
      const notifDate = parseDate(row[COL.date]);
      let expDate = parseDate(row[COL.expirationDate]);
      if (!expDate && notifDate) expDate = calculateExpirationDate(notifDate);

      let emergencyName = getStr(row, COL.emergencyName);
      // Fallback to classname map
      if ((!emergencyName || emergencyName.length > 150) && classId && classnameMap[classId]) {
        emergencyName = classnameMap[classId];
      }
      if (emergencyName && emergencyName.length > 200) {
        emergencyName = emergencyName.substring(0, 197) + '...';
      }

      const stance = normalizeStance(getStr(row, COL.stance));
      const severity = parseInt2(row[COL.severity]);
      const type = normalizeType(getStr(row, COL.type));

      const rawSpeed = getStr(row, COL.codeNumber); // Not processing speed — this is code#
      const rawIpc4 = getStr(row, COL.ipc4Used).toLowerCase();
      const ipc4Used = rawIpc4 === 'yes' || rawIpc4 === 'true' || rawIpc4 === '1' ? true : rawIpc4 ? false : null;

      const record: Record<string, unknown> = {
        classification_id: classId || null,
        reclassification_number: reclassNum,
        unique_id: uniqueId || null,
        country,
        region: getStr(row, COL.region) || null,
        date: notifDate,
        expiration_date: expDate,
        stance,
        severity,
        emergency_name: emergencyName || null,
        type: type || null,
        total_affected: parseNumber(row[COL.totalAffected]),
        sap_tracking: getStr(row, COL.sapTracking) || null,
        link_to_spreadsheet: getStr(row, COL.linkToSpreadsheet) || null,
        ipc4_used: ipc4Used,
        hazard_type: getStr(row, COL.hazardType) || null,
        notes: getStr(row, COL.notes) || null,
        code_number: getStr(row, COL.codeNumber) || null,
        date_request_received: parseDate(row[COL.dateRequestReceived]),
        date_sent_for_entry: parseDate(row[COL.dateSentForEntry]),
        date_reviewed: parseDate(row[COL.dateReviewed]),
        date_approved: parseDate(row[COL.dateApproved]),
        date_expiration_notice_sent: parseDate(row[COL.dateExpirationNoticeSent]),
        who_engages_cp: getStr(row, COL.whoEngagesCp) || null,
        entry_by: getStr(row, COL.entryBy) || null,
        reviewed_by: getStr(row, COL.reviewedBy) || null,
        approved_by: getStr(row, COL.approvedBy) || null,
        notif_sent_by: getStr(row, COL.notifSentBy) || null,
        raised_with_cp_region: getStr(row, COL.raisedWithCpRegion) || null,
      };

      // Check if this record already exists
      const existing = (uniqueId && byUniqueId[uniqueId]) ||
        (classId && byClassReclass[`${classId}:${reclassNum}`]);

      if (existing) {
        // Check if anything meaningful changed
        const changed =
          existing.stance !== stance ||
          existing.severity !== severity ||
          existing.type !== type ||
          existing.emergency_name !== emergencyName ||
          existing.date !== notifDate;

        if (changed) {
          record.id = existing.id; // preserve existing UUID
          toUpsert.push(record);
          result.updated++;
        } else {
          result.unchanged++;
        }
      } else {
        // Only create new records if notification has been sent (classification is official)
        if (!notifDate) continue;
        record.id = crypto.randomUUID();
        toUpsert.push(record);
        result.inserted++;
      }
    } catch (err) {
      result.errors++;
      if (errorDetails.length < 10) {
        errorDetails.push(`Row ${i + 3}: ${(err as Error).message}`);
      }
    }
  }

  console.log(`[sync] To upsert: ${toUpsert.length} (${result.inserted} new, ${result.updated} updated, ${result.unchanged} unchanged, ${result.errors} errors)`);

  // 7. Batch upsert
  if (toUpsert.length > 0) {
    const BATCH_SIZE = 200;
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from('classifications')
        .upsert(batch, { onConflict: 'id' });

      if (upsertError) {
        console.error(`[sync] Batch ${Math.floor(i / BATCH_SIZE)} error:`, upsertError.message);
        result.errors += batch.length;
        result.inserted -= batch.filter((r) => !byUniqueId[r.unique_id as string]).length;
        result.updated -= batch.filter((r) => !!byUniqueId[r.unique_id as string]).length;
        if (errorDetails.length < 10) {
          errorDetails.push(`Batch upsert: ${upsertError.message}`);
        }
      }
    }
  }

  if (errorDetails.length > 0) result.errorDetails = errorDetails;
  result.duration = Date.now() - startTime;
  console.log(`[sync] Complete in ${result.duration}ms`);
  return result;
}

// ── HTTP handler ──

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await syncClassifications();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[sync] Fatal error:', (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      }
    );
  }
});

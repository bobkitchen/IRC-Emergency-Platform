/**
 * Supabase client for reading classification data from the shared IRC database.
 * Now imports config from @irc/shared instead of duplicating it.
 */

// @ts-ignore — @irc/shared is a workspace dependency (plain JS)
import { fetchClassifications as sharedFetch } from '@irc/shared/supabase';

export interface Classification {
  id: string;
  classificationId: string;
  type: string;
  country: string;
  region: string;
  emergencyName: string;
  date: string;
  expirationDate: string;
  processingSpeed: string;
  reclassificationNumber: number;
  previousSeverity: number | null;
  metrics: Record<string, unknown>;
  severity: number;
  stance: string;
  notes: string;
  confidence: unknown;
  subnational: unknown;
  totalAffected: number | null;
  linkToSpreadsheet: string | null;
  ipc4Used: boolean | null;
  hazardType: string | null;
  sapTracking: string | null;
  uniqueId: string | null;
  dateRequestReceived: string | null;
  dateSentForEntry: string | null;
  dateReviewed: string | null;
  dateApproved: string | null;
  dateExpirationNoticeSent: string | null;
  whoEngagesCp: string | null;
  entryBy: string | null;
  reviewedBy: string | null;
  approvedBy: string | null;
  notifSentBy: string | null;
  raisedWithCpRegion: string | null;
  codeNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch all classifications from Supabase.
 * Returns an empty array on failure (non-blocking).
 */
export async function fetchClassifications(): Promise<Classification[]> {
  return sharedFetch() as Promise<Classification[]>;
}

declare module '@irc/shared' {
  export const COUNTRY_ALIASES: Record<string, string>;
  export function normalizeCountry(name: string): string;
  export const STANCE_MATRIX: Record<string, Record<string, string>>;
  export const COUNTRIES: any[];
  export const THRESHOLDS: Record<string, any>;
  export const METRIC_CONFIGS: Record<string, any>;
  export const SUPABASE_URL: string;
  export const SUPABASE_KEY: string;
  export function fetchClassifications(): Promise<any[]>;
  export function getSiteConfig(siteId?: string): any;
  export function lookupStance(severity: number, preVulnerability: number, robustness: number): string;
}

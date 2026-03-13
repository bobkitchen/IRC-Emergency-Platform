// crypto-utils.js — Password gate + PAT encryption utilities
// Uses Web Crypto API (SubtleCrypto) — no external dependencies

/**
 * SHA-256 hash a plaintext string. Returns hex digest.
 */
async function hashPassword(plaintext) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(plaintext));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive an AES-GCM key from a plaintext password using PBKDF2.
 * Salt is fixed per-app (acceptable for single-user, single-password use case).
 */
async function deriveKey(password) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('irc-admin-salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext with AES-GCM using a password-derived key.
 * Returns base64 string of iv (12 bytes) + ciphertext.
 */
async function encryptWithPassword(plaintext, password) {
  const key = await deriveKey(password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ct), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64 AES-GCM blob using a password-derived key.
 * Returns plaintext string, or null if decryption fails.
 */
async function decryptWithPassword(base64Blob, password) {
  try {
    const raw = Uint8Array.from(atob(base64Blob), c => c.charCodeAt(0));
    const iv = raw.slice(0, 12);
    const ct = raw.slice(12);
    const key = await deriveKey(password);
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(dec);
  } catch {
    return null;
  }
}

// Expose globally for use by index.html and navigator-upload.js
window.CryptoUtils = { hashPassword, encryptWithPassword, decryptWithPassword };

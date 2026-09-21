/**
 * Personal Profile — Supabase client setup
 * Menggunakan project yang sama dengan e-commerce BenangEstetik Co.
 */
var SUPABASE_URL = 'https://zpswuofpkookvphqlyul.supabase.co';
var SUPABASE_ANON = 'sb_publishable_6QzgKDet6Mdf2qn26zEMxg_odQxI6n7';

window.supabaseClient = null;

try {
  if (typeof supabase !== 'undefined' && supabase && supabase.createClient) {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  } else if (window.supabase && window.supabase.createClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  }
} catch (err) {
  console.warn('[personal_profile/supabase.js] Inisialisasi Supabase client:', err);
}

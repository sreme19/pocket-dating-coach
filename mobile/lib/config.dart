/// Backend configuration. These are public values (already shipped in the web
/// client bundle): the Supabase project URL + anon key, and the Vercel API base
/// that hosts the existing /api/verified-vibe/* routes. The native app reuses
/// this backend unchanged — only the UI is rebuilt.
class Config {
  static const String supabaseUrl = 'https://stikoktiaxqtcsohcxzp.supabase.co';
  static const String supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0aWtva3RpYXhxdGNzb2hjeHpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTk5MzUsImV4cCI6MjA5MzI5NTkzNX0.L-yF5jGPqP59RzqKfr8hnhByuTy4sx_xbjvAKcNtIKQ';
  static const String apiBase = 'https://pocket-dating-coach.vercel.app';

  // Verified Vibe palette (mirrors the web app's dark theme).
  static const int bg1 = 0xFF0B1120;
  static const int bg2 = 0xFF131A2B;
  static const int bg3 = 0xFF1A2336;
  static const int accent = 0xFF34D399;
  static const int text1 = 0xFFF1F5F9;
  static const int text2 = 0xFF94A3B8;
  static const int text3 = 0xFF64748B;
}

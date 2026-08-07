/// Backend configuration. These are public values (already shipped in the web
/// client bundle): the Supabase project URL + anon key, and the Vercel API base
/// that hosts the existing /api/verified-vibe/* routes. The native app reuses
/// this backend unchanged — only the UI is rebuilt.
///
/// Always points at production. An `ENV=dev` dart-define used to be read here,
/// but the value was never used by anything — every URL below is a constant — so
/// passing that flag has no effect. Removed rather than left as a switch that
/// looks live and silently is not.
class Config {
  static const String supabaseUrl = 'https://stikoktiaxqtcsohcxzp.supabase.co';

  static const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0aWtva3RpYXhxdGNzb2hjeHpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTk5MzUsImV4cCI6MjA5MzI5NTkzNX0.L-yF5jGPqP59RzqKfr8hnhByuTy4sx_xbjvAKcNtIKQ';

  static const String apiBase = 'https://www.riteangle.dating';

  // Voice calls are suspended: the Fly worker that plays her AI Bestie is
  // destroyed and the server's VOICE_CALLS_ENABLED kill switch is off, so the
  // "Call Bestie" pill could only ever fail. Hidden rather than deleted — flip
  // this back to true (with the worker up and the server flag on) to restore it.
  static const bool voiceCallsEnabled = false;

  // riteangle palette (light theme — cream page, white cards, hot-pink accent).
  static const int bg1 = 0xFFFFF3F0; // page background (cream)
  static const int bg2 = 0xFFFFFFFF; // card / surface (white)
  static const int bg3 = 0xFFFBE9E6; // subtle fill
  static const int accent = 0xFFFF3B6B; // riteangle primary (hot pink)
  static const int accentBright = 0xFFE11D54; // accent strong (deep pink)
  static const int text1 = 0xFF1B1020; // primary text (warm ink)
  static const int text2 = 0xFF6E5F64; // secondary text
  static const int text3 = 0xFFA08B91; // tertiary text

  // Secondary riteangle accents (added for the reskin — used by screens that
  // want a coral highlight or a faint pink tint fill).
  static const int coral = 0xFFFF7A4D; // secondary accent (coral)
  static const int accentTint = 0xFFFFE1EA; // subtle pink-tint fill

  // Season-independent status colours — these must read as state, not as brand,
  // so they stay put when Networking Season repaints the accent. Values match the
  // literals already scattered through the app (hand-off urgency, trust cards).
  static const int alert = 0xFFDC2626; // alert / unread red
  static const int warn = 0xFFF59E0B; // in-progress amber
  static const int success = 0xFF10B981; // done emerald
}

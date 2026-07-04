/// Backend configuration. These are public values (already shipped in the web
/// client bundle): the Supabase project URL + anon key, and the Vercel API base
/// that hosts the existing /api/verified-vibe/* routes. The native app reuses
/// this backend unchanged — only the UI is rebuilt.
///
/// Build with --dart-define=ENV=dev to point at the development project.
/// Default (no flag) → production.
class Config {
  static const bool _isDev =
      String.fromEnvironment('ENV', defaultValue: 'prod') == 'dev';

  static const String supabaseUrl = _isDev
      ? 'https://jufgdjzhzhbzrortieqe.supabase.co'
      : 'https://stikoktiaxqtcsohcxzp.supabase.co';

  static const String supabaseAnonKey = _isDev
      ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1ZmdkanpoemhienJvcnRpZXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwOTYwNDcsImV4cCI6MjA5ODY3MjA0N30.i3APzp75JYFL4ntAe6NeZ8qKFRudbUgMXb6X0BZQzh0'
      : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0aWtva3RpYXhxdGNzb2hjeHpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTk5MzUsImV4cCI6MjA5MzI5NTkzNX0.L-yF5jGPqP59RzqKfr8hnhByuTy4sx_xbjvAKcNtIKQ';

  static const String apiBase = 'https://riteangle.dating';

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
}

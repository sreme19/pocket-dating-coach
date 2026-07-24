import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'config.dart';
import 'api.dart' as api;

/// Networking Season — global "season" state.
///
/// A per-user flag: date (default) or networking. When networking, the app's
/// accent flips from riteangle pink to a calm teal on the surfaces that opt in
/// via [Brand] (the app theme seed, the bottom nav, the season banner, and the
/// Discover screen). It is NOT a matching-engine change — see
/// docs/requirements/Networking_Mode_Design.md.
///
/// Mirrors the ValueNotifier pattern already used by
/// ChatListScreen.unreadNotifier so widgets can react without a state library.
class SeasonState {
  SeasonState._();

  /// true = networking season, false = date. Listen to reskin/react.
  static final ValueNotifier<bool> networking = ValueNotifier<bool>(false);
  static bool get isNetworking => networking.value;

  static String _prefsKey() => 'discovery_networking_${api.currentUserId() ?? 'anon'}';

  /// Paint instantly from the local cache, then reconcile with the backend.
  /// Call once when the authenticated shell mounts.
  static Future<void> hydrate() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cached = prefs.getBool(_prefsKey());
      if (cached != null) networking.value = cached;
    } catch (_) {}
    try {
      final server = await api.getDiscoveryMode();
      networking.value = server;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_prefsKey(), server);
    } catch (_) {}
  }

  /// Flip the season. Local-first: the UI + local cache update immediately, and
  /// the backend sync is best-effort. This keeps the toggle fully functional in
  /// the tester build even before the discovery-mode endpoint is live in
  /// production (the Flutter app always talks to the prod API). Once the backend
  /// ships, the same call persists server-side for matching/discovery.
  /// Returns the backend response (empty map on failure) — carries
  /// `returnedFromNetworking` + `activeContacts` on a networking→date flip so the
  /// caller can offer the return-to-Date consent prompt (Phase 4).
  static Future<Map<String, dynamic>> set(bool value) async {
    networking.value = value;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_prefsKey(), value);
    } catch (_) {}
    try {
      return await api.setDiscoveryMode(value);
    } catch (_) {
      // backend not deployed / offline — local state still holds
      return <String, dynamic>{};
    }
  }
}

/// Runtime accent palette. Read these (non-const) instead of
/// `const Color(Config.accent)` on any surface that should reskin with the
/// season. Everything not routed through [Brand] stays riteangle pink.
class Brand {
  Brand._();

  // Networking (teal) counterparts to the riteangle pink accents.
  static const int _netAccent = 0xFF0E9AAE; // teal primary
  static const int _netAccentBright = 0xFF0A7C8C; // teal strong
  static const int _netAccentTint = 0xFFE1F4F6; // pale teal fill
  static const int _netSecondary = 0xFF5AA9E6; // sky (coral counterpart)

  static bool get _net => SeasonState.networking.value;

  static Color get accent => Color(_net ? _netAccent : Config.accent);
  static Color get accentBright => Color(_net ? _netAccentBright : Config.accentBright);
  static Color get accentTint => Color(_net ? _netAccentTint : Config.accentTint);
  static Color get secondary => Color(_net ? _netSecondary : Config.coral);

  /// 15%-opacity accent for the nav indicator (mirrors the pink 0x26FF3B6B).
  static Color get navIndicator => Color(_net ? 0x260E9AAE : 0x26FF3B6B);

  static int get accentValue => _net ? _netAccent : Config.accent;
}

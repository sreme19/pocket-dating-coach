/// attribution.dart — keeping the advert that produced an install.
///
/// WHAT WAS WRONG. Play hands the install referrer to the app exactly once, and
/// the landing pages put their utm_* in it. captureInstallReferrer read that
/// string, pulled `ra_claim` out, and returned early when there wasn't one —
/// dropping the campaign sitting in the same query string. /get never sends
/// `ra_claim`, so every paid /get install read its own attribution and threw it
/// away. Downstream, every signup, onboarding step, verification and message was
/// recorded with no campaign attached, and "which advert produced members?" had
/// no answer in SQL.
///
/// This module now owns the read: it keeps the WHOLE referrer regardless of what
/// is in it, and the claim code is one value extracted from it rather than the
/// precondition for keeping anything.
///
/// TWO MOMENTS, DELIBERATELY. Reading the referrer has to happen at first launch,
/// before anything expires; reporting it needs a session, which does not exist
/// until sign-up finishes. So the referrer is parked in SharedPreferences and
/// reported later, which is also why [reportAcquisitionIfPending] is safe to call
/// on every launch — the parked copy survives until the server confirms a write.
///
/// ANDROID ONLY. iOS has no install referrer and no equivalent to read. An iOS
/// member therefore reports platform and nothing else, and shows up as
/// unattributable — which is not the same as organic, and the dashboard has to
/// keep them apart.
library;

import 'dart:convert';
import 'dart:io' show Platform;

import 'package:android_play_install_referrer/android_play_install_referrer.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'aibestie_claim.dart' show storePendingClaimCode;
import 'api.dart';
import 'app_logger.dart';

/// Set once the referrer has been read, successfully or not. Play keeps it for 90
/// days, so this is not a closing window — it is about not paying a
/// platform-channel round trip on every cold start forever.
const _kReferrerRead = 'attribution.referrer_read';

/// The referrer exactly as Play returned it, held until the server has it.
const _kReferrerRaw = 'attribution.referrer_raw';

/// The utm_* parsed out of it, as JSON.
const _kUtm = 'attribution.utm';

/// Which landing page sent them, from `ra_lp`.
const _kLandingPage = 'attribution.landing_page';

/// When the device read the referrer — the install moment, which can be days
/// before sign-up finishes.
const _kCapturedAt = 'attribution.captured_at';

/// Cleared only once the server confirms the row is written.
const _kReported = 'attribution.reported';

/// The query keys the landing pages append alongside the utm_*.
const _kClaimParam = 'ra_claim';
const _kLandingParam = 'ra_lp';

/// Read the Play install referrer once and keep all of it.
///
/// Silent on every failure: this runs during startup for every user, most of whom
/// did not come from an advert. Nothing here is worth blocking a launch for.
Future<void> captureInstallReferrer() async {
  if (!Platform.isAndroid) return;

  final prefs = await SharedPreferences.getInstance();
  if (prefs.getBool(_kReferrerRead) == true) return;

  try {
    final details = await AndroidPlayInstallReferrer.installReferrer;
    // Marked read BEFORE parsing. A referrer we cannot parse will not parse next
    // launch either, and retrying forever costs a round trip on every cold start.
    await prefs.setBool(_kReferrerRead, true);

    final raw = details.installReferrer;
    if (raw == null || raw.isEmpty) return;

    final params = Uri.splitQueryString(raw);

    // Everything is kept, whether or not there is a claim code in it. This is the
    // line the old version got wrong: it returned here when ra_claim was absent,
    // which is the normal case for /get and therefore for most paid installs.
    await prefs.setString(_kReferrerRaw, raw);
    await prefs.setString(_kCapturedAt, DateTime.now().toUtc().toIso8601String());

    final utm = <String, String>{
      for (final e in params.entries)
        if (e.key.startsWith('utm_')) e.key: e.value,
    };
    await prefs.setString(_kUtm, jsonEncode(utm));

    final landing = params[_kLandingParam];
    if (landing != null && landing.trim().isNotEmpty) {
      await prefs.setString(_kLandingPage, landing.trim());
    }

    AppLogger.instance.action('attribution', 'referrer_captured', meta: {
      'hasUtm': utm.isNotEmpty,
      'landingPage': landing ?? '',
    });

    // The claim code is now one value read out of the referrer rather than the
    // reason for reading it. Storage still belongs to aibestie_claim.dart, which
    // owns when a code is retried and when it is given up on.
    final code = params[_kClaimParam];
    if (code != null && code.trim().isNotEmpty) {
      await storePendingClaimCode(code.trim().toUpperCase());
      AppLogger.instance.action('aibestie', 'referrer_code_captured');
    }
  } catch (e) {
    // No Play Store, a sideloaded build, an emulator, a dead service. All
    // ordinary, none of them the user's problem.
    await prefs.setBool(_kReferrerRead, true);
    AppLogger.instance.error(e, screen: 'attribution', action: 'capture_referrer');
  }
}

/// Send the parked attribution up, if there is a session and it has not landed yet.
///
/// Safe to call on any launch and at any point in onboarding: it no-ops without a
/// session or without something to report, and stops permanently once the server
/// confirms the write. The retry matters — the first launch after an install
/// usually has no session at all, so the startup call almost always defers to the
/// one after sign-up.
Future<void> reportAcquisitionIfPending() async {
  final prefs = await SharedPreferences.getInstance();
  if (prefs.getBool(_kReported) == true) return;
  if (Supabase.instance.client.auth.currentSession == null) return;

  final raw = prefs.getString(_kReferrerRaw);
  final utmJson = prefs.getString(_kUtm);

  // On iOS there is nothing to read, and on an organic Android install the
  // referrer is empty. Both are still worth one call: a row with a platform and
  // no campaign records "we know where this member came from — nowhere paid",
  // which a missing row cannot say.
  final utm = <String, String>{};
  if (utmJson != null && utmJson.isNotEmpty) {
    try {
      final decoded = jsonDecode(utmJson);
      if (decoded is Map) {
        decoded.forEach((k, v) {
          if (k is String && v is String) utm[k] = v;
        });
      }
    } catch (_) {
      /* corrupt entry — report the rest rather than nothing */
    }
  }

  try {
    final ok = await reportInstallAttribution(
      utm: utm,
      referrerRaw: raw,
      landingPage: prefs.getString(_kLandingPage),
      claimCode: null,
      platform: Platform.isIOS ? 'ios' : 'android',
      capturedAt: prefs.getString(_kCapturedAt),
    );

    // Only a confirmed write stops the retries. A failure here is most often a
    // migration that has not been run yet, which the next launch may well fix —
    // and dropping the referrer on a recoverable error would lose it forever.
    if (ok) {
      await prefs.setBool(_kReported, true);
      AppLogger.instance.action('attribution', 'reported', meta: {
        'hasUtm': utm.isNotEmpty,
      });
    }
  } catch (e) {
    AppLogger.instance.error(e, screen: 'attribution', action: 'report');
  }
}

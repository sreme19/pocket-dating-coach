/// aibestie_claim.dart — reuniting a new member with the conversation he had
/// before he installed.
///
/// He tapped a Snap advert, talked to a woman's AI bestie on /aibestie, and was
/// sent here by the "Sign up on Google Play" button. That button appends
/// `ra_claim=RA-XXXXXX` to the Play install referrer, so the code arrives with the
/// install and he never has to type anything.
///
/// TWO ROUTES, BECAUSE THE REFERRER IS NOT DEPENDABLE. Play delivers it only when
/// the install actually came from that tap — not if he searched the store himself,
/// not if he already had the app, and never on iOS. So the page also prints the
/// code on screen and [claimTypedCode] takes it by hand. Both end at the same
/// endpoint, which is idempotent on `claimed_at`, so the pair firing for one
/// install is expected rather than a race to prevent.
///
/// WHY THE CLAIM DOES NOT FIRE AT SIGN-IN. The server refuses a claimer who is
/// not a man — the thread is the man's side of a woman→man proxy, and handing it
/// to a woman produces a thread that exists and is permanently silent. Gender is
/// written by saveGenderArchetype, one step INTO onboarding, so a claim fired the
/// moment a session appears would be rejected as `wrong_gender` and the code
/// discarded. It runs after that step instead.
library;

import 'dart:io' show Platform;

import 'package:android_play_install_referrer/android_play_install_referrer.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'api.dart';
import 'app_logger.dart';

/// Set once the referrer has been read, successfully or not. The Play referrer is
/// available for 90 days, so this is not about a closing window — it is about not
/// paying a platform-channel round trip on every cold start forever.
const _kReferrerRead = 'aibestie.referrer_read';

/// The code waiting to be claimed. Cleared on success and on any verdict that
/// cannot change (a wrong code, an already-claimed conversation), kept only for
/// failures that a later attempt could genuinely fix.
const _kPendingCode = 'aibestie.pending_code';

/// The query key the landing page appends to the install referrer.
const _kClaimParam = 'ra_claim';

/// Read the Play install referrer once and keep any conversation code in it.
///
/// Android only, and silent on every failure: this runs during startup for every
/// user, and the overwhelming majority of them did not come from an advert. There
/// is nothing here worth showing anyone or worth blocking a launch for.
Future<void> captureInstallReferrer() async {
  if (!Platform.isAndroid) return;

  final prefs = await SharedPreferences.getInstance();
  if (prefs.getBool(_kReferrerRead) == true) return;

  try {
    final details = await AndroidPlayInstallReferrer.installReferrer;
    // Mark it read BEFORE parsing. A referrer we cannot parse is not going to
    // parse next launch either, and retrying forever costs a platform-channel
    // call on every cold start for the lifetime of the install.
    await prefs.setBool(_kReferrerRead, true);

    final raw = details.installReferrer;
    if (raw == null || raw.isEmpty) return;

    // Play hands back the referrer as a query string — the exact value the page
    // put in `&referrer=`, so utm_* live alongside the claim code.
    final code = Uri.splitQueryString(raw)[_kClaimParam];
    if (code == null || code.trim().isEmpty) return;

    await prefs.setString(_kPendingCode, code.trim().toUpperCase());
    AppLogger.instance.action('aibestie', 'referrer_code_captured');
  } catch (e) {
    // No Play Store, a sideloaded build, an emulator, a dead service. All
    // ordinary, none of them the user's problem.
    await prefs.setBool(_kReferrerRead, true);
    AppLogger.instance.error(e, screen: 'aibestie', action: 'capture_referrer');
  }
}

/// Try to claim a stored code, if there is one and the account can take it.
///
/// Safe to call on any launch and after onboarding: it is a no-op without a
/// pending code or a session.
Future<AibestieClaimResult?> claimPendingConversation() async {
  final prefs = await SharedPreferences.getInstance();
  final code = prefs.getString(_kPendingCode);
  if (code == null || code.isEmpty) return null;
  if (Supabase.instance.client.auth.currentSession == null) return null;

  final result = await claimAibestieConversation(code);

  // Keep the code ONLY when a later attempt could succeed. A wrong code, a
  // conversation already claimed, or an account that cannot take it are all
  // final — holding onto those means retrying a dead code on every cold start.
  if (result.ok || !result.retryable) {
    await prefs.remove(_kPendingCode);
  }

  AppLogger.instance.action('aibestie', 'claim_attempt', meta: {
    'ok': result.ok,
    'retryable': result.retryable,
    'messagesMoved': result.messagesMoved,
  });
  return result;
}

/// Claim a code the member typed in by hand.
///
/// Deliberately does not touch the pending-code storage: this is his second
/// attempt at something the automatic path already failed or never had, and a
/// typo should not overwrite a good code waiting for a retry.
Future<AibestieClaimResult> claimTypedCode(String raw) async {
  final code = raw.trim().toUpperCase().replaceAll(RegExp(r'\s+'), '');
  if (code.isEmpty) {
    return const AibestieClaimResult(ok: false, message: 'Enter the code from the chat.');
  }
  final result = await claimAibestieConversation(code);
  AppLogger.instance.action('aibestie', 'claim_typed', meta: {'ok': result.ok});
  return result;
}

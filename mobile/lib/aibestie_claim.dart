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

import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'api.dart';
import 'app_logger.dart';

/// The code waiting to be claimed. Cleared on success and on any verdict that
/// cannot change (a wrong code, an already-claimed conversation), kept only for
/// failures that a later attempt could genuinely fix.
const _kPendingCode = 'aibestie.pending_code';

/// Park a claim code read out of the Play install referrer.
///
/// The referrer read itself now lives in attribution.dart, which keeps the WHOLE
/// referrer rather than only the rows that happen to carry a claim code — the old
/// version returned early when `ra_claim` was absent and threw away the campaign
/// in the same query string, which is the normal case for /get. The code is one
/// value extracted from that read; when to retry it and when to give up on it
/// still belong here.
Future<void> storePendingClaimCode(String code) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_kPendingCode, code);
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

/// Classifying a caught error from its string form, in one place.
///
/// Every screen used to do this inline, and every one of them made the same
/// mistake: treating `DioException` as proof of a network problem. Dio wraps
/// EVERY failed request in a DioException — a 500, a 404, a bad payload — so a
/// server outage told users their internet was down and sent them to check the
/// WiFi. The chat list went further and called it a rate limit, which is what
/// hid a real 500 for an afternoon on 2026-08-04.
///
/// So: never match on the exception's class name. Match on what actually went
/// wrong. Dio spells the HTTP status out in the message ("status code of 500"),
/// and genuine transport failures always name the transport ("connection
/// timeout", "SocketException", "Failed host lookup").
library;

import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// The API returned 5xx. Matched on Dio's own phrasing rather than a bare "500",
/// which would also hit any id, duration or count containing those digits.
bool isServerError(String s) => s.contains('status code of 5') || s.contains('HTTP 5');

/// The request never got a usable answer out of the network.
///
/// Deliberately does NOT include 'DioException' — see the note above. Dio's own
/// transport failures still land here because their messages carry 'connection
/// timeout', 'connection error' or the underlying SocketException.
bool isNetworkError(String s) =>
    s.contains('SocketException') ||
    s.contains('Failed host lookup') ||
    s.contains('Network is unreachable') ||
    s.contains('Connection refused') ||
    s.contains('connection timeout') ||
    s.contains('connection error') ||
    s.contains('receive timeout') ||
    s.contains('send timeout') ||
    s.contains('timeout');

/// Did the request fail to reach us at all — as opposed to reaching us and
/// coming back wrong? Answers the question [isNetworkError] can only guess at,
/// by reading Dio's `type` when the caught object is still a `DioException`.
///
/// Takes the error object rather than its string because `type` is the one
/// place that separates a transport failure from a response we did not like.
/// Falls back to the message for the two cases where `type` is already gone:
/// a raw `SocketException`, and a transport failure a caller has re-thrown as
/// one of the [kNetworkErrorMessage] wrappers.
///
/// A 5xx is never connectivity, even when the server's own words are "gateway
/// timeout": that failure is ours and has to stay visible.
bool isConnectivityFailure(Object err) {
  final msg = err.toString();
  if (isServerError(msg)) return false;

  if (err is DioException) {
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.connectionError:
        return true;
      default:
        break;
    }
  }
  return isNetworkError(msg) || _isRewrappedNetworkFailure(msg);
}

/// Did a caller already turn this into one of our own user-facing wrappers?
///
/// None of the three phrasings below contains a word [isNetworkError] looks
/// for, so a re-thrown timeout looked like a fresh unexplained failure — which
/// is how "Exception: No internet connection" arrived as an emailed app error
/// on 2026-09-02 alongside the timeouts that caused it.
bool _isRewrappedNetworkFailure(String s) =>
    s.contains(kNetworkErrorMessage) ||
    s.contains(kConnectionErrorMessage) ||
    s.contains(kNetworkRetryMessage);

/// Auth codes that describe the user's situation rather than a fault in the app.
///
/// A ban is something we did on purpose; an expired code is someone typing the
/// old one out of an old email. Neither is news, and both arrive over and over
/// from the same person, because the natural response to a rejected login is to
/// try again.
///
/// Matched on gotrue's `code`, never on the class name — `AuthApiException` is
/// also what a 500 from the auth server arrives as, and that one has to stay
/// visible. Same rule the `DioException` note above exists for.
const _expectedAuthCodes = {
  'user_banned',
  'otp_expired',
  'invalid_credentials',
  'over_email_send_rate_limit',
};

/// Is this login failure an outcome, rather than a bug?
///
/// Recorded either way; the difference is whether it pages a human. On
/// 2026-09-06 a single banned account retrying `verify_otp` emailed an app
/// error that no amount of code could have fixed — the account was closed, and
/// the alert said only that the person had noticed.
///
/// A 5xx is never an expected outcome, even when the auth server phrases its
/// own failure as a rejection.
bool isExpectedAuthOutcome(Object err) {
  if (isServerError(err.toString())) return false;
  if (err is! AuthApiException) return false;
  final status = err.statusCode;
  if (status != null && status.startsWith('5')) return false;
  return _expectedAuthCodes.contains(err.code);
}

/// The session is gone or was never valid.
bool isAuthError(String s) => s.contains('401') || s.contains('Unauthorized');

/// Genuinely throttled — the only case where "please wait" is useful advice.
bool isRateLimited(String s) => s.contains('429') || s.contains('Rate limit');

/// What to tell someone when the fault is ours. Says so plainly: a user who
/// thinks they broke something goes looking for a fix that doesn't exist.
const String kServerErrorMessage =
    "Something went wrong on our end. It's not you — please try again shortly.";

/// What to tell someone whose request never reached us.
///
/// Constants rather than a phrase typed at each `throw`, because
/// [isConnectivityFailure] has to recognise these coming back the other way:
/// a caller that re-wraps a socket timeout in a plain `Exception` destroys
/// every trace of what went wrong, and the alert path can only tell that this
/// is a dead spot rather than a bug if the wording is one it knows. Three of
/// them because three call sites had each worded their own before this
/// existed; reuse one instead of inventing a fourth.
const String kNetworkErrorMessage =
    'No internet connection. Please check your network and retry.';
const String kConnectionErrorMessage =
    'Connection error — please check your internet and try again.';
const String kNetworkRetryMessage =
    'Network error — check your connection and try again.';

/// What to tell someone whose account we closed.
///
/// The old wording here was "That code is incorrect or has expired", which is
/// both false and an instruction to keep trying: it sent a banned user back to
/// request another code, indefinitely. If the answer is no, say no, and say
/// where to take it.
const String kAccountBannedMessage =
    'This account has been closed and can no longer sign in. '
    'If you think that\'s a mistake, email support@riteangle.dating.';

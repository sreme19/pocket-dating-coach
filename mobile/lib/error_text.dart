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

/// The session is gone or was never valid.
bool isAuthError(String s) => s.contains('401') || s.contains('Unauthorized');

/// Genuinely throttled — the only case where "please wait" is useful advice.
bool isRateLimited(String s) => s.contains('429') || s.contains('Rate limit');

/// What to tell someone when the fault is ours. Says so plainly: a user who
/// thinks they broke something goes looking for a fix that doesn't exist.
const String kServerErrorMessage =
    "Something went wrong on our end. It's not you — please try again shortly.";

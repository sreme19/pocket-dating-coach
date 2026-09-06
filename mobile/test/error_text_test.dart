import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:verified_vibe/error_text.dart';

/// A real `DioException` rather than its string form: `isConnectivityFailure`
/// reads `type`, which is the part that survives when the message does not.
DioException _dio(DioExceptionType type, {int? status}) => DioException(
      requestOptions: RequestOptions(path: '/api/verified-vibe/matchmaker/find-matches'),
      type: type,
      response: status == null
          ? null
          : Response(
              requestOptions: RequestOptions(path: '/api/verified-vibe/matchmaker/find-matches'),
              statusCode: status,
            ),
    );

/// Verbatim Dio message strings, because the whole class of bug this guards
/// against came from pattern-matching the wrong part of them.
const _dio500 =
    'DioException [bad response]: This exception was thrown because the response '
    'has a status code of 500 and RequestOptions.validateStatus was configured to '
    'throw for this status code.';
const _dio404 =
    'DioException [bad response]: This exception was thrown because the response '
    'has a status code of 404 and RequestOptions.validateStatus was configured to '
    'throw for this status code.';
const _dio429 =
    'DioException [bad response]: This exception was thrown because the response '
    'has a status code of 429 and RequestOptions.validateStatus was configured to '
    'throw for this status code.';
const _dio401 =
    'DioException [bad response]: This exception was thrown because the response '
    'has a status code of 401 and RequestOptions.validateStatus was configured to '
    'throw for this status code.';
const _dioConnTimeout =
    'DioException [connection timeout]: The request connection took longer than '
    '0:00:15.000000 and it was aborted.';
const _dioRecvTimeout =
    'DioException [receive timeout]: The request took longer than '
    '0:00:45.000000 to receive data.';
const _dioConnError =
    'DioException [connection error]: The connection errored: Failed host lookup: '
    "'www.riteangle.dating'";
const _socket =
    "SocketException: Connection refused (OS Error: Connection refused, errno = 111)";
const _loggedHttp500 = 'HTTP 500 on GET /api/verified-vibe/chat/conversations';

void main() {
  group('isServerError', () {
    test('catches a Dio 5xx and the logged HTTP 5xx form', () {
      expect(isServerError(_dio500), isTrue);
      expect(isServerError(_loggedHttp500), isTrue);
      expect(isServerError('HTTP 503 on GET /api/foo'), isTrue);
    });

    test('does not claim a server fault for 4xx or transport failures', () {
      expect(isServerError(_dio404), isFalse);
      expect(isServerError(_dio429), isFalse);
      expect(isServerError(_dio401), isFalse);
      expect(isServerError(_dioConnTimeout), isFalse);
      expect(isServerError(_socket), isFalse);
    });

    test('is not fooled by digits inside ids, counts or durations', () {
      // The reason this matches Dio's phrasing and not a bare '500'.
      expect(isServerError('Exception: match 500e7390-4a1b failed to load'), isFalse);
      expect(isServerError('Exception: took 1500ms'), isFalse);
      expect(isServerError('Exception: 502 items queued'), isFalse);
    });
  });

  group('isNetworkError', () {
    test('catches Dio transport failures and raw socket errors', () {
      expect(isNetworkError(_dioConnTimeout), isTrue);
      expect(isNetworkError(_dioRecvTimeout), isTrue);
      expect(isNetworkError(_dioConnError), isTrue);
      expect(isNetworkError(_socket), isTrue);
    });

    test('does NOT treat a bad HTTP response as a connection problem', () {
      // The original bug: every one of these stringifies with 'DioException',
      // and matching that word sent users to check their WiFi during an outage.
      expect(isNetworkError(_dio500), isFalse);
      expect(isNetworkError(_dio404), isFalse);
      expect(isNetworkError(_dio429), isFalse);
      expect(isNetworkError(_dio401), isFalse);
      expect(isNetworkError(_loggedHttp500), isFalse);
    });
  });

  group('isAuthError / isRateLimited', () {
    test('classify their own status and nothing else', () {
      expect(isAuthError(_dio401), isTrue);
      expect(isAuthError('Exception: Unauthorized'), isTrue);
      expect(isAuthError(_dio500), isFalse);

      expect(isRateLimited(_dio429), isTrue);
      expect(isRateLimited('Rate limit exceeded. Try again in an hour.'), isTrue);
      expect(isRateLimited(_dio500), isFalse);
      expect(isRateLimited(_dioConnTimeout), isFalse);
    });
  });

  group('every failure gets exactly one classification', () {
    // Screens chain these as if/else, so a string matching two predicates would
    // be reported as whichever happens to be tested first.
    test('no overlap across the four categories', () {
      const cases = {
        _dio500: 'server',
        _loggedHttp500: 'server',
        _dio401: 'auth',
        _dio429: 'rate',
        _dioConnTimeout: 'network',
        _dioConnError: 'network',
        _socket: 'network',
      };
      cases.forEach((message, expected) {
        final hits = <String>[
          if (isServerError(message)) 'server',
          if (isAuthError(message)) 'auth',
          if (isRateLimited(message)) 'rate',
          if (isNetworkError(message)) 'network',
        ];
        expect(hits, [expected], reason: 'for: $message');
      });
    });
  });

  group('isConnectivityFailure', () {
    // Guards the alert path: a connectivity failure is the user's network, so
    // it must never email. Anything else has to stay loud.
    test('true for every Dio transport type', () {
      expect(isConnectivityFailure(_dio(DioExceptionType.connectionTimeout)), isTrue);
      expect(isConnectivityFailure(_dio(DioExceptionType.sendTimeout)), isTrue);
      expect(isConnectivityFailure(_dio(DioExceptionType.receiveTimeout)), isTrue);
      expect(isConnectivityFailure(_dio(DioExceptionType.connectionError)), isTrue);
    });

    test('true once a screen has re-wrapped the error in its own Exception', () {
      // chat_list's _load rethrows this, so `type` is long gone by then.
      expect(
        isConnectivityFailure(Exception('No internet connection. Please check your network and retry.')),
        isTrue,
      );
      expect(isConnectivityFailure(_socket), isTrue);
    });

    test('false for a response that did arrive — including our own 5xx', () {
      expect(isConnectivityFailure(_dio(DioExceptionType.badResponse, status: 500)), isFalse);
      expect(isConnectivityFailure(_dio(DioExceptionType.badResponse, status: 404)), isFalse);
      expect(isConnectivityFailure(_dio500), isFalse);
      expect(isConnectivityFailure(_dio401), isFalse);
      expect(isConnectivityFailure(_loggedHttp500), isFalse);
    });

    test('a 5xx stays ours even when the server calls it a timeout', () {
      // 'timeout' alone would send a real gateway failure down the silent path.
      expect(isConnectivityFailure('HTTP 504 on GET /api/verified-vibe/tips — gateway timeout'), isFalse);
    });

    test('false for an ordinary app bug', () {
      expect(isConnectivityFailure(TypeError()), isFalse);
      expect(isConnectivityFailure(StateError('Not authenticated')), isFalse);
      expect(isConnectivityFailure(Exception('Null check operator used on a null value')), isFalse);
    });
  });

  group('isExpectedAuthOutcome', () {
    // The alert that prompted this: one closed account retrying verify_otp,
    // emailing an "app error" nothing in the app could fix.
    test('a banned account is an outcome, not a bug', () {
      expect(
        isExpectedAuthOutcome(
            AuthApiException('User is banned', statusCode: '403', code: 'user_banned')),
        isTrue,
      );
    });

    test('the everyday login failures are outcomes too', () {
      for (final code in ['otp_expired', 'invalid_credentials', 'over_email_send_rate_limit']) {
        expect(
          isExpectedAuthOutcome(AuthApiException('rejected', statusCode: '400', code: code)),
          isTrue,
          reason: code,
        );
      }
    });

    // The reason this reads `code` and not the class: the auth server falling
    // over arrives as the same exception type, and has to keep paging us.
    test('an auth server 5xx is still ours', () {
      expect(
        isExpectedAuthOutcome(AuthApiException('Internal server error',
            statusCode: '500', code: 'unexpected_failure')),
        isFalse,
      );
      expect(
        isExpectedAuthOutcome(AuthApiException('upstream is banned',
            statusCode: '503', code: 'user_banned')),
        isFalse,
        reason: 'a 5xx outranks a recognised code',
      );
    });

    test('an unrecognised auth code stays visible', () {
      expect(
        isExpectedAuthOutcome(
            AuthApiException('boom', statusCode: '400', code: 'something_new')),
        isFalse,
      );
    });

    test('false for anything that is not an auth failure', () {
      expect(isExpectedAuthOutcome(StateError('Not authenticated')), isFalse);
      expect(isExpectedAuthOutcome(_dio(DioExceptionType.receiveTimeout)), isFalse);
    });
  });

  test('the banned message closes the door instead of inviting a retry', () {
    expect(kAccountBannedMessage.toLowerCase(), contains('closed'));
    expect(kAccountBannedMessage, contains('support@riteangle.dating'));
    // The wording it replaced sent banned users back for another code.
    expect(kAccountBannedMessage.toLowerCase(), isNot(contains('try again')));
    expect(kAccountBannedMessage.toLowerCase(), isNot(contains('expired')));
  });

  test('the server-fault message blames us, not the user', () {
    expect(kServerErrorMessage, contains('our end'));
    expect(kServerErrorMessage.toLowerCase(), isNot(contains('your connection')));
    expect(kServerErrorMessage.toLowerCase(), isNot(contains('internet')));
  });
}

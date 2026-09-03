import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:dio/dio.dart';
import 'config.dart';
import 'error_text.dart';

/// Dio interceptor attached to the shared `_dio` in api.dart.
/// - Logs all successful write operations (POST/PUT/PATCH/DELETE) as 'action'.
/// - Logs all HTTP errors (4xx/5xx) and network errors as 'error'.
/// - Skips successful GETs to avoid flooding the log.
class _ApiLogInterceptor extends Interceptor {
  final AppLogger _log;
  final _starts = <int, int>{}; // request hashCode → start ms

  _ApiLogInterceptor(this._log);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    _starts[options.hashCode] = DateTime.now().millisecondsSinceEpoch;
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final method = response.requestOptions.method.toUpperCase();
    final ms     = _elapsed(response.requestOptions);
    final path   = _path(response.requestOptions.uri);
    _log._write('action',
      action: '$method $path',
      meta: {
        'method': method,
        'path': path,
        'status': response.statusCode,
        'latency_ms': ms,
        'ok': true,
      },
    );
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final method = err.requestOptions.method.toUpperCase();
    final ms     = _elapsed(err.requestOptions);
    final path   = _path(err.requestOptions.uri);
    final status = err.response?.statusCode;

    // Extract response body safely (truncate to 300 chars)
    String? body;
    try {
      final raw = err.response?.data;
      if (raw != null) body = raw.toString().substring(0, raw.toString().length.clamp(0, 300));
    } catch (_) {}

    _log._write('error',
      action: '$method $path',
      errorType: 'DioException',
      errorMessage: 'HTTP ${status ?? "?"} on $method $path',
      meta: {
        'method': method,
        'path': path,
        'status': status,
        'latency_ms': ms,
        'ok': false,
        if (body != null) 'response_body': body,
        if (err.message != null) 'dio_message': err.message,
      },
    );

    handler.next(err);
  }

  int _elapsed(RequestOptions req) {
    final start = _starts.remove(req.hashCode);
    return start != null ? DateTime.now().millisecondsSinceEpoch - start : 0;
  }

  String _path(Uri uri) {
    // Strip base URL — log only the path so we don't store tokens in query params
    return uri.path;
  }
}

/// Singleton service that records user actions and errors to Supabase
/// `mobile_event_log` table. Errors also fire an email alert via the
/// /api/mobile-error Vercel endpoint, with a 5-minute per-error-type cooldown
/// to prevent alert spam.
///
/// Usage:
///   AppLogger.instance.screen('discover');
///   AppLogger.instance.action('profile_edit', 'save_identity');
///   AppLogger.instance.error(e, stack: s, screen: 'auth', action: 'send_otp');
class AppLogger {
  AppLogger._();
  static final AppLogger instance = AppLogger._();

  /// Stamped onto every logged event and every alert email. Kept in step with
  /// `pubspec.yaml` by a test, because it had already drifted three releases
  /// behind it: the 2026-09-02 alerts all claimed 1.0.5 while the build in the
  /// store was 1.0.8, which points triage at the wrong code.
  static const appVersion = '1.0.8';

  /// Stamped onto every event so admin tooling can tell which OS a user is on
  /// even when they declined push permission (no `device_tokens` row to read).
  static final _platform = defaultTargetPlatform == TargetPlatform.iOS
      ? 'ios'
      : defaultTargetPlatform == TargetPlatform.android
          ? 'android'
          : defaultTargetPlatform.name;

  String? _userId;

  /// Call on auth state change (sign-in / sign-out).
  void setUser(String? userId) => _userId = userId;

  /// Attach the API interceptor to a Dio instance. Call once when Dio is created.
  void attachToDio(Dio dio) {
    dio.interceptors.add(_ApiLogInterceptor(this));
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /// Log a screen view (navigation event). Fire-and-forget, no email.
  void screen(String name) {
    _write('navigation', screen: name);
  }

  /// Log a user action (button tap, feature use). Fire-and-forget, no email.
  void action(String screenName, String actionName, {Map<String, dynamic>? meta}) {
    _write('action', screen: screenName, action: actionName, meta: meta);
  }

  /// Log a client-side error. Writes to DB and sends an email alert
  /// (subject to a 5-minute cooldown per error type × screen × action).
  ///
  /// Connectivity failures are the exception: they get the DB row but never the
  /// email. A phone in a dead spot is not a bug in the app, and the polling
  /// screens make one dead spot look like an outage — chat_list alone refreshes
  /// five endpoints a minute, so a single 15-second stall fires an alert per
  /// endpoint. That is what happened on 2026-09-02: a burst of Dio connect
  /// timeouts emailed `load_matchmaker_status failed` while every server-side
  /// GET on either side of the burst returned 200. The interceptor's own row
  /// (endpoint, elapsed ms, Dio's message) is what actually diagnoses these.
  Future<void> error(
    dynamic err, {
    StackTrace? stack,
    String? screen,
    String? action,
    Map<String, dynamic>? meta,
  }) async {
    final msg     = err.toString();
    final errType = err.runtimeType.toString();

    final stackLines = stack != null
        ? stack.toString().split('\n').take(12).join('\n')
        : null;

    _write('error',
      screen: screen,
      action: action,
      errorMessage: msg,
      errorType: errType,
      meta: {
        if (stackLines != null) 'stack': stackLines,
        ...?meta,
      },
    );

    // The user's network dropped — recorded above, but nothing to act on.
    if (err is Object && isConnectivityFailure(err)) return;

    // Rate-limit email alerts: same error type + screen + action → max 1 email
    // per 5 min. The action belongs in the key: without it every literal-string
    // error on a screen shared the key `String:chat_list`, so the first one
    // through silenced all the others for five minutes.
    final cooldownKey = '$errType:${screen ?? '_'}:${action ?? '_'}';
    final last = _alertCooldown[cooldownKey];
    if (last != null && DateTime.now().difference(last).inMinutes < 5) return;
    _alertCooldown[cooldownKey] = DateTime.now();

    await _sendAlert(
      errorMessage: msg,
      errorType: errType,
      screen: screen,
      action: action,
      stack: stackLines,
      meta: meta,
    );
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  final Map<String, DateTime> _alertCooldown = {};

  /// Fire-and-forget write to Supabase. Never throws.
  void _write(
    String eventType, {
    String? screen,
    String? action,
    String? errorMessage,
    String? errorType,
    Map<String, dynamic>? meta,
  }) {
    scheduleMicrotask(() async {
      try {
        await Supabase.instance.client.from('mobile_event_log').insert({
          'user_id':       _userId,
          'event_type':    eventType,
          'screen':        screen,
          'action':        action,
          'error_message': errorMessage,
          'error_type':    errorType,
          'metadata':      {'platform': _platform, ...?meta},
          'app_version':   appVersion,
        });
      } catch (e) {
        if (kDebugMode) debugPrint('[AppLogger] DB write failed: $e');
      }
    });
  }

  /// POST to /api/mobile-error → Vercel sends email via Resend. Never throws.
  Future<void> _sendAlert({
    required String errorMessage,
    String? errorType,
    String? screen,
    String? action,
    String? stack,
    Map<String, dynamic>? meta,
  }) async {
    try {
      final token = Supabase.instance.client.auth.currentSession?.accessToken;
      final dio = Dio();
      await dio.post(
        '${Config.apiBase}/api/mobile-error',
        options: Options(
          headers: {
            if (token != null) 'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
          sendTimeout:    const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 8),
        ),
        data: {
          'userId':       _userId,
          'errorMessage': errorMessage,
          'errorType':    errorType,
          'screen':       screen,
          'action':       action,
          'appVersion':   appVersion,
          'stack':        stack,
          'meta':         meta,
        },
      );
    } catch (e) {
      if (kDebugMode) debugPrint('[AppLogger] alert POST failed: $e');
    }
  }
}

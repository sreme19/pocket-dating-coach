import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:dio/dio.dart';
import 'config.dart';

/// Dio interceptor attached to the shared `_dio` in api.dart.
/// - Logs all successful write operations (POST/PUT/PATCH/DELETE) as 'api_call'.
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
    _log._write('api_call',
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

  static const _appVersion = '1.0.5';

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
  /// (subject to a 5-minute cooldown per error type × screen).
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

    // Rate-limit email alerts: same error type + screen → max 1 email per 5 min
    final cooldownKey = '$errType:${screen ?? '_'}';
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
          'metadata':      meta,
          'app_version':   _appVersion,
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
          'appVersion':   _appVersion,
          'stack':        stack,
          'meta':         meta,
        },
      );
    } catch (e) {
      if (kDebugMode) debugPrint('[AppLogger] alert POST failed: $e');
    }
  }
}

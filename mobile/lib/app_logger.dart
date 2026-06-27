import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:dio/dio.dart';
import 'config.dart';

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

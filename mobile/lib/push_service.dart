import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'firebase_options.dart';
import 'api.dart';
import 'config.dart';
import 'conversation_screen.dart';

@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  // Notification-payload messages are shown by the OS automatically while
  // backgrounded; this is the hook for any data-only handling later.
}

/// Initialize Firebase + register the background handler. Call once at startup.
Future<void> initFirebasePush() async {
  try {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
  } catch (e) {
    if (kDebugMode) debugPrint('Firebase init failed: $e');
  }
}

class PushService {
  static bool _done = false;

  /// Set from main(): drives deep-link navigation from notification taps.
  static GlobalKey<NavigatorState>? navKey;

  /// Set from HomeShell: switches the bottom-nav tab (0=Discover,1=Chat,2=Profile).
  static void Function(int tab)? onSwitchTab;

  /// Request permission, get the FCM token, register it with the backend
  /// (POST /api/push/register), and wire tap/foreground handlers.
  /// Safe to call repeatedly; the registration body runs once.
  static Future<void> registerForUser() async {
    if (_done) return;
    try {
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission(alert: true, badge: true, sound: true);
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;

      final token = await messaging.getToken();
      if (token != null && token.isNotEmpty) {
        await registerPushToken(token);
        _done = true;
        if (kDebugMode) debugPrint('✅ FCM token registered (${token.substring(0, 12)}…)');
      }
      messaging.onTokenRefresh.listen((t) => registerPushToken(t).catchError((_) {}));

      // Notification interactions ───────────────────────────────────────────
      // Foreground: OS does NOT auto-display, so surface a tappable banner.
      FirebaseMessaging.onMessage.listen(_handleForeground);
      // Tapped while backgrounded.
      FirebaseMessaging.onMessageOpenedApp.listen((m) => _handleDeepLink(m.data));
      // Tapped while terminated (cold start).
      final initial = await messaging.getInitialMessage();
      if (initial != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _handleDeepLink(initial.data));
      }
    } catch (e) {
      if (kDebugMode) debugPrint('Push register failed: $e');
    }
  }

  static void _handleForeground(RemoteMessage m) {
    final n = m.notification;
    final ctx = navKey?.currentContext;
    if (n == null || ctx == null) return;
    final title = n.title ?? 'New notification';
    final body = n.body ?? '';
    ScaffoldMessenger.of(ctx).showSnackBar(
      SnackBar(
        backgroundColor: const Color(Config.bg2),
        content: Text(
          body.isEmpty ? title : '$title — $body',
          style: const TextStyle(color: Color(Config.text1)),
        ),
        action: SnackBarAction(
          label: 'View',
          textColor: const Color(Config.accent),
          onPressed: () => _handleDeepLink(m.data),
        ),
      ),
    );
  }

  /// Routes a notification's `data` payload to the right screen.
  /// Backend sends `data.deepLink` as either a relative path
  /// (`/chat/<id>`, `/conversations/<id>`) or a keyword (`wingman_chat`).
  static void _handleDeepLink(Map<String, dynamic> data) {
    final link = (data['deepLink'] ?? data['deep_link'])?.toString();
    if (link == null || link.isEmpty) return;

    // Conversation thread → switch to Chat tab first, then open conversation.
    // Switching tab first ensures the back button returns to Chat (not Discover).
    final convo = RegExp(r'^/(?:chat|conversations)/([^/?#]+)').firstMatch(link);
    if (convo != null) {
      final id = convo.group(1)!;
      onSwitchTab?.call(1); // ensure Chat tab is active before pushing
      navKey?.currentState?.push(
        MaterialPageRoute(builder: (_) => ConversationScreen(conversationId: id, title: 'Chat')),
      );
      return;
    }

    // AI Wingman / intelligence report → Chat tab (advisor lives there).
    if (link == 'wingman_chat' || link.startsWith('/wingman') || data['type'] == 'intelligence_report') {
      onSwitchTab?.call(1);
      return;
    }

    // Notice Me / Secret Admirer / Tip → Chat tab (Messages lives there).
    if (link == '/messages' ||
        data['type'] == 'secret_admirer' ||
        data['type'] == 'craving_attention' ||
        data['type'] == 'profile_tip') {
      onSwitchTab?.call(1);
      return;
    }

    // Anything else just brings the app forward.
  }

  /// Clear the once-flag on sign-out so the next user re-registers.
  static void reset() => _done = false;

  /// Stop push delivery to this device on sign-out: delete the FCM token
  /// (server prunes the stale row on its next failed send) and reset state.
  static Future<void> signOutCleanup() async {
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {
      // best-effort
    }
    reset();
  }
}

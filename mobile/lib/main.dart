import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config.dart';
import 'season.dart';
import 'api.dart';
import 'app_logger.dart';
import 'auth_screen.dart';
import 'home_shell.dart';
import 'onboarding_flow.dart';
import 'push_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Catch Flutter framework errors (widget build failures, rendering errors, etc.)
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details); // keep default console output
    AppLogger.instance.error(
      details.exception,
      stack: details.stack,
      screen: 'FlutterError',
      meta: {
        if (details.library != null) 'library': details.library,
        if (details.context != null) 'context': details.context.toString(),
      },
    );
  };

  // Catch unhandled async errors (outside Flutter's zone)
  PlatformDispatcher.instance.onError = (error, stack) {
    AppLogger.instance.error(error, stack: stack, screen: 'PlatformDispatcher');
    return true; // mark as handled
  };

  await Supabase.initialize(
    url: Config.supabaseUrl,
    anonKey: Config.supabaseAnonKey,
  );
  await initFirebasePush();
  PushService.navKey = navigatorKey;
  runApp(const VerifiedVibeApp());
}

/// Global navigator key so push notifications can navigate from outside the tree.
final navigatorKey = GlobalKey<NavigatorState>();

SupabaseClient get supabase => Supabase.instance.client;

class VerifiedVibeApp extends StatelessWidget {
  const VerifiedVibeApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Rebuild the theme when the season flips so the accent (and every
    // ColorScheme-driven widget) follows pink ↔ teal app-wide.
    return ValueListenableBuilder<bool>(
      valueListenable: SeasonState.networking,
      builder: (context, _, __) {
        final accent = Brand.accent;
        return MaterialApp(
          title: 'riteangle',
          navigatorKey: navigatorKey,
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            useMaterial3: true,
            brightness: Brightness.light,
            fontFamily: 'Gabarito',
            scaffoldBackgroundColor: const Color(Config.bg1),
            colorScheme: ColorScheme.fromSeed(
              seedColor: accent,
              brightness: Brightness.light,
            ),
            // Dark-themed dialogs & snackbars consistent with app design
            dialogTheme: const DialogThemeData(
              backgroundColor: Color(Config.bg2),
              titleTextStyle: TextStyle(
                color: Color(Config.text1), fontSize: 18, fontWeight: FontWeight.w700, fontFamily: 'Gabarito',
              ),
              contentTextStyle: TextStyle(color: Color(Config.text2), fontSize: 14, fontFamily: 'Gabarito'),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(16))),
            ),
            snackBarTheme: SnackBarThemeData(
              backgroundColor: const Color(Config.bg2),
              contentTextStyle: const TextStyle(color: Color(Config.text1), fontFamily: 'Gabarito'),
              actionTextColor: accent,
              behavior: SnackBarBehavior.floating,
              shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
            ),
          ),
          home: const AuthGate(),
        );
      },
    );
  }
}

/// Routes between auth, onboarding, and the app based on the Supabase session +
/// onboarding state. Reacts to sign-in/out via the auth stream; a brand-new
/// user (no archetype yet) is sent through OnboardingFlow first.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  int _recheck = 0; // bump to re-evaluate onboarding (after it completes)

  // Memoise the onboarding check per (user, _recheck). onAuthStateChange fires
  // on routine events — token refreshes, app resume — and each emission rebuilds
  // this StreamBuilder. Calling needsOnboarding() inline made a fresh future
  // every time, flipping the tree to the loading spinner and back and TEARING
  // DOWN + RECREATING HomeShell (and all its state) on every auth event. That
  // reset per-screen state such as the chat list's "hand-off popup already
  // shown" guard, causing the "Your turn to step in" modal to re-pop. Caching
  // the future keeps the same key resolved, so a token refresh is a no-op here.
  Future<bool>? _onbFuture;
  String? _onbKey;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: supabase.auth.onAuthStateChange,
      builder: (context, snapshot) {
        // Keep AppLogger in sync with the current user
        final session = supabase.auth.currentSession;
        AppLogger.instance.setUser(session?.user.id);

        if (session == null) {
          // Signed out — drop the cache so the next sign-in re-checks.
          _onbFuture = null;
          _onbKey = null;
          return const AuthScreen();
        }
        final onbKey = 'onb_${session.user.id}_$_recheck';
        if (_onbKey != onbKey) {
          _onbKey = onbKey;
          _onbFuture = needsOnboarding();
        }
        return FutureBuilder<bool>(
          key: ValueKey(onbKey),
          future: _onbFuture,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return Scaffold(
                backgroundColor: const Color(Config.bg1),
                body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const BrandLockup(),
                  const SizedBox(height: 40),
                  const SizedBox(width: 24, height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(Config.accent))),
                ])),
              );
            }
            if (snap.data == true) {
              return OnboardingFlow(onComplete: () => setState(() => _recheck++));
            }
            return const HomeShell();
          },
        );
      },
    );
  }
}

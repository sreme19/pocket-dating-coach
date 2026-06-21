import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config.dart';
import 'api.dart';
import 'auth_screen.dart';
import 'home_shell.dart';
import 'onboarding_flow.dart';
import 'push_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
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
          seedColor: const Color(Config.accent),
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
        snackBarTheme: const SnackBarThemeData(
          backgroundColor: Color(Config.bg2),
          contentTextStyle: TextStyle(color: Color(Config.text1), fontFamily: 'Gabarito'),
          actionTextColor: Color(Config.accent),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
        ),
      ),
      home: const AuthGate(),
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

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: supabase.auth.onAuthStateChange,
      builder: (context, _) {
        final session = supabase.auth.currentSession;
        if (session == null) return const AuthScreen();
        return FutureBuilder<bool>(
          key: ValueKey('onb_${session.user.id}_$_recheck'),
          future: needsOnboarding(),
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

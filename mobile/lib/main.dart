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
      title: 'Verified Vibe',
      navigatorKey: navigatorKey,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(Config.bg1),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(Config.accent),
          brightness: Brightness.dark,
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
              return const Scaffold(body: Center(child: CircularProgressIndicator(color: Color(Config.accent))));
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

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config.dart';
import 'auth_screen.dart';
import 'profile_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: Config.supabaseUrl,
    anonKey: Config.supabaseAnonKey,
  );
  runApp(const VerifiedVibeApp());
}

SupabaseClient get supabase => Supabase.instance.client;

class VerifiedVibeApp extends StatelessWidget {
  const VerifiedVibeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Verified Vibe',
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

/// Routes between auth and the app based on the Supabase session, reacting to
/// sign-in / sign-out via the auth state stream (session is persisted natively).
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: supabase.auth.onAuthStateChange,
      builder: (context, _) {
        final session = supabase.auth.currentSession;
        if (session != null) return const ProfileScreen();
        return const AuthScreen();
      },
    );
  }
}

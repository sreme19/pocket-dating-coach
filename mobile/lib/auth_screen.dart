import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config.dart';

/// Email one-time-code sign-in, mirroring the web flow:
/// signInWithOtp(email) → verifyOtp(email, code). On success the auth state
/// stream in AuthGate swaps to the app. Auth talks directly to Supabase.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  bool _codeSent = false;
  bool _loading = false;
  String? _error;

  SupabaseClient get _sb => Supabase.instance.client;

  Future<void> _sendCode() async {
    final email = _email.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Enter a valid email address.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await _sb.auth.signInWithOtp(email: email);
      setState(() { _codeSent = true; _loading = false; });
    } catch (e) {
      setState(() { _error = 'Could not send code: $e'; _loading = false; });
    }
  }

  Future<void> _verify() async {
    final email = _email.text.trim();
    final token = _code.text.trim();
    if (token.length < 6) {
      setState(() => _error = 'Enter the 6-digit code.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await _sb.auth.verifyOTP(email: email, token: token, type: OtpType.email);
      // AuthGate reacts to the auth state change.
    } catch (e) {
      setState(() { _error = 'Invalid or expired code.'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _Brand(),
                  const SizedBox(height: 32),
                  Text(
                    _codeSent ? 'Check your email' : 'Welcome back',
                    style: const TextStyle(
                      fontSize: 28, fontWeight: FontWeight.bold,
                      color: Color(Config.text1),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _codeSent
                        ? 'We sent a 6-digit code to ${_email.text.trim()}.'
                        : "We'll email you a 6-digit code. No password needed.",
                    style: const TextStyle(fontSize: 15, color: Color(Config.text2)),
                  ),
                  const SizedBox(height: 24),
                  if (!_codeSent) ...[
                    _field(_email, 'you@example.com', TextInputType.emailAddress),
                    const SizedBox(height: 16),
                    _primaryButton('Send code', _loading ? null : _sendCode),
                  ] else ...[
                    _field(_code, '6-digit code', TextInputType.number),
                    const SizedBox(height: 16),
                    _primaryButton('Verify', _loading ? null : _verify),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: _loading ? null : () => setState(() { _codeSent = false; _code.clear(); _error = null; }),
                      child: const Text('Use a different email'),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Text(_error!, style: const TextStyle(color: Color(0xFFF87171))),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _field(TextEditingController c, String hint, TextInputType kb) {
    return TextField(
      controller: c,
      keyboardType: kb,
      autocorrect: false,
      style: const TextStyle(color: Color(Config.text1)),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(Config.text3)),
        filled: true,
        fillColor: const Color(Config.bg2),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0x22FFFFFF)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(Config.accent)),
        ),
      ),
    );
  }

  Widget _primaryButton(String label, VoidCallback? onTap) {
    return SizedBox(
      height: 52,
      child: FilledButton(
        onPressed: onTap,
        style: FilledButton.styleFrom(
          backgroundColor: const Color(Config.accent),
          foregroundColor: const Color(0xFF052819),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
        child: _loading
            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF052819)))
            : Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
      ),
    );
  }
}

class _Brand extends StatelessWidget {
  const _Brand();
  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(
            color: const Color(Config.accent),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(Icons.verified_user, color: Color(0xFF052819)),
        ),
        const SizedBox(width: 12),
        const Text('Verified Vibe',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(Config.text1))),
      ],
    );
  }
}

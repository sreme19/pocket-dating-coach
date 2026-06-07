import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config.dart';
import 'onboarding_flow.dart' show GateStep, pendingSignupGender;

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
  bool _signUp = false; // false = sign in, true = create account (same OTP flow)
  int _signupStep = 0; // signup: 0 = "two questions" gate, 1 = email
  String _gateGender = 'man';
  bool _gateOver18 = false;
  bool _loading = false;
  String? _error;

  void _setMode(bool signUp) {
    setState(() {
      _signUp = signUp;
      _signupStep = 0;
      _error = null;
      if (!signUp) pendingSignupGender = null; // back to sign-in: drop pre-pick
    });
  }

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
    // Create account → "Two questions" gate first (mirrors web). The chosen
    // gender is held in pendingSignupGender so onboarding skips the gate later.
    if (_signUp && !_codeSent && _signupStep == 0) {
      return GateStep(
        gender: _gateGender,
        over18: _gateOver18,
        onGender: (g) => setState(() => _gateGender = g),
        onOver18: (v) => setState(() => _gateOver18 = v),
        onContinue: _gateOver18
            ? () { pendingSignupGender = _gateGender; setState(() => _signupStep = 1); }
            : null,
        onSignIn: () => _setMode(false),
      );
    }
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
                  if (!_codeSent) ...[
                    _ModeToggle(
                      signUp: _signUp,
                      onChanged: _setMode,
                    ),
                    const SizedBox(height: 20),
                  ],
                  Text(
                    _codeSent
                        ? 'Check your email'
                        : (_signUp ? 'Create your account' : 'Welcome back'),
                    style: const TextStyle(
                      fontSize: 28, fontWeight: FontWeight.bold,
                      color: Color(Config.text1),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _codeSent
                        ? 'We sent a 6-digit code to ${_email.text.trim()}.'
                        : (_signUp
                            ? "Enter your email and we'll send a 6-digit code to set you up. No password — you'll pick your vibe next."
                            : "We'll email you a 6-digit code. No password needed."),
                    style: const TextStyle(fontSize: 15, color: Color(Config.text2), height: 1.4),
                  ),
                  const SizedBox(height: 24),
                  if (!_codeSent) ...[
                    _field(_email, 'you@example.com', TextInputType.emailAddress),
                    const SizedBox(height: 16),
                    _primaryButton(_signUp ? 'Create account' : 'Send code', _loading ? null : _sendCode),
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
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: _loading
            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF052819)))
            : Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
      ),
    );
  }
}

/// Segmented Sign in / Create account toggle. Both use the same passwordless
/// OTP flow — a brand-new email is auto-created on verify, then AuthGate routes
/// it into onboarding (no archetype yet). The toggle is the new-user cue.
class _ModeToggle extends StatelessWidget {
  final bool signUp;
  final ValueChanged<bool> onChanged;
  const _ModeToggle({required this.signUp, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0x18FFFFFF)),
      ),
      child: Row(children: [
        _seg('Sign in', !signUp, () => onChanged(false)),
        _seg('Create account', signUp, () => onChanged(true)),
      ]),
    );
  }

  Widget _seg(String label, bool active, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: active ? const Color(Config.accent) : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: active ? const Color(0xFF052819) : const Color(Config.text2),
            ),
          ),
        ),
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

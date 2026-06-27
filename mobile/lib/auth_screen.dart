import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:dio/dio.dart';
import 'config.dart';
import 'app_logger.dart';
import 'onboarding_flow.dart' show GateStep, pendingSignupGender, pendingSignupArchetype;
import 'pre_auth_lane_screen.dart';

/// Email one-time-code sign-in, mirroring the web flow:
/// signInWithOtp(email) → verifyOtp(email, code). On success the auth state
/// stream in AuthGate swaps to the app. Auth talks directly to Supabase.
///
/// Special case: the demo account (review@riteangle.com / 123456) bypasses
/// OTP email delivery for App Store reviewers who cannot receive OTP emails.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  // Demo account for App Store review — bypasses email OTP delivery.
  static const _demoEmail = 'review@riteangle.com';
  static const _demoCode  = '123456';

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
      if (!signUp) pendingSignupGender = null;
    });
  }

  SupabaseClient get _sb => Supabase.instance.client;

  Future<void> _sendCode() async {
    final email = _email.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Enter a valid email address.');
      return;
    }

    // Demo account: skip email delivery, just show the OTP field.
    if (email == _demoEmail) {
      setState(() { _codeSent = true; _loading = false; });
      return;
    }

    setState(() { _loading = true; _error = null; });
    try {
      await _sb.auth.signInWithOtp(email: email);
      setState(() { _codeSent = true; _loading = false; });
    } catch (e) {
      setState(() => _loading = false);
      if (!mounted) return;
      final msg = e.toString();
      if (msg.contains('429') || msg.toLowerCase().contains('rate') || msg.contains('over_email_send_rate_limit')) {
        final waitMatch = RegExp(r'(\d+)\s*second').firstMatch(msg);
        final waitSecs = waitMatch?.group(1);
        _showAlert(
          title: 'Too many requests',
          body: waitSecs != null
              ? 'Please wait $waitSecs seconds before requesting another code.'
              : 'You\'ve requested too many codes. Please wait a moment and try again.',
        );
      } else {
        AppLogger.instance.error(e, screen: 'auth', action: 'send_otp',
            meta: {'email': _email.text.trim()});
        _showAlert(title: 'Something went wrong', body: 'Could not send the code. Please check your connection and try again.');
      }
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

    // Demo account: bypass Supabase OTP and create session via edge function.
    if (email == _demoEmail && token == _demoCode) {
      await _demoSignIn();
      return;
    }

    try {
      await _sb.auth.verifyOTP(email: email, token: token, type: OtpType.email);
      // AuthGate reacts to the auth state change.
    } catch (e) {
      AppLogger.instance.error(e, screen: 'auth', action: 'verify_otp');
      setState(() => _loading = false);
      if (!mounted) return;
      _showAlert(title: 'Invalid code', body: 'That code is incorrect or has expired. Check your email and try again.');
    }
  }

  Future<void> _demoSignIn() async {
    try {
      final dio = Dio();
      final response = await dio.post(
        '${Config.supabaseUrl}/functions/v1/demo-login',
        options: Options(headers: {
          'Authorization': 'Bearer ${Config.supabaseAnonKey}',
          'Content-Type': 'application/json',
        }),
        data: {'email': _demoEmail, 'code': _demoCode},
      );
      final refreshToken = response.data['refresh_token'] as String;
      await _sb.auth.setSession(refreshToken);
      // AuthGate reacts to the auth state change.
    } catch (e) {
      AppLogger.instance.error(e, screen: 'auth', action: 'demo_sign_in');
      setState(() => _loading = false);
      if (!mounted) return;
      _showAlert(title: 'Something went wrong', body: 'Demo login failed. Please try again.');
    }
  }

  void _showAlert({required String title, required String body}) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(Config.bg2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(title, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 17)),
        content: Text(body, style: const TextStyle(color: Color(Config.text2), fontSize: 14, height: 1.5)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Got it', style: TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final int screenKey;
    final Widget screen;

    // Step 0 — "Two questions" gate (gender + 18+).
    if (_signUp && !_codeSent && _signupStep == 0) {
      screenKey = 1;
      screen = GateStep(
        gender: _gateGender,
        over18: _gateOver18,
        onGender: (g) => setState(() => _gateGender = g),
        onOver18: (v) => setState(() => _gateOver18 = v),
        onContinue: _gateOver18
            ? () { setState(() => _signupStep = 1); }
            : null,
        onSignIn: () => _setMode(false),
      );
    }
    // Step 1 — "Pick your lane" (pre-auth archetype selection).
    else if (_signUp && !_codeSent && _signupStep == 1) {
      screenKey = 2;
      screen = PreAuthLaneScreen(
        gender: _gateGender,
        onPick: (archetypeId) {
          pendingSignupGender = _gateGender;
          pendingSignupArchetype = archetypeId;
          setState(() => _signupStep = 2);
        },
        onBack: () => setState(() => _signupStep = 0),
      );
    }
    // Email / OTP form (sign-in or create account step 2+)
    else {
      screenKey = _signUp ? 3 : 0;
      screen = Scaffold(
      backgroundColor: const Color(Config.bg1),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const BrandLockup(),
                  const SizedBox(height: 32),
                  // Card
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: const Color(Config.bg2),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x0F000000),
                          blurRadius: 24,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          _codeSent
                              ? 'Check your email'
                              : (_signUp ? 'Create your account' : 'Welcome back'),
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Color(Config.text1),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _codeSent
                              ? 'We sent a 6-digit code to ${_email.text.trim()}.'
                              : (_signUp
                                  ? "Enter your email and we'll send a 6-digit code. No password needed."
                                  : "We'll email you a 6-digit code. No password needed."),
                          style: const TextStyle(
                            fontSize: 15,
                            color: Color(Config.text2),
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 24),
                        if (!_codeSent) ...[
                          const Text(
                            'Email address',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(Config.text2),
                            ),
                          ),
                          const SizedBox(height: 8),
                          _field(_email, 'you@example.com', TextInputType.emailAddress),
                          const SizedBox(height: 16),
                          _primaryButton(
                            _signUp ? 'Create account →' : 'Send code →',
                            _loading ? null : _sendCode,
                          ),
                          const SizedBox(height: 16),
                          _privacyText(),
                          const SizedBox(height: 16),
                          _switchModeLink(),
                        ] else ...[
                          const Text(
                            'Verification code',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(Config.text2),
                            ),
                          ),
                          const SizedBox(height: 8),
                          _field(_code, '6-digit code', TextInputType.number),
                          const SizedBox(height: 16),
                          _primaryButton('Verify →', _loading ? null : _verify),
                          const SizedBox(height: 12),
                          TextButton(
                            onPressed: _loading
                                ? null
                                : () => setState(() {
                                      _codeSent = false;
                                      _code.clear();
                                      _error = null;
                                    }),
                            child: const Text(
                              'Use a different email',
                              style: TextStyle(color: Color(Config.accent)),
                            ),
                          ),
                        ],
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Text(
                            _error!,
                            style: const TextStyle(color: Color(0xFFF87171), fontSize: 14),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    } // end else (email/OTP form)

    return _Transition(screenKey: screenKey, child: screen);
  }

  Widget _privacyText() {
    return RichText(
      textAlign: TextAlign.center,
      text: TextSpan(
        style: const TextStyle(
          fontSize: 12,
          color: Color(Config.text3),
          height: 1.5,
        ),
        children: [
          const TextSpan(text: 'By continuing you agree to our '),
          TextSpan(
            text: 'Privacy Policy',
            style: const TextStyle(color: Color(Config.accent)),
            recognizer: TapGestureRecognizer()..onTap = () {},
          ),
          const TextSpan(text: '. New accounts are created automatically.'),
        ],
      ),
    );
  }

  Widget _switchModeLink() {
    return RichText(
      textAlign: TextAlign.center,
      text: TextSpan(
        style: const TextStyle(fontSize: 14, color: Color(Config.text2)),
        children: [
          TextSpan(text: _signUp ? 'Already have an account? ' : 'New here? '),
          TextSpan(
            text: _signUp ? 'Sign in →' : 'Create an account →',
            style: const TextStyle(
              color: Color(Config.accent),
              fontWeight: FontWeight.w600,
            ),
            recognizer: TapGestureRecognizer()..onTap = () => _setMode(!_signUp),
          ),
        ],
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
        fillColor: const Color(Config.bg3),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(Config.accent), width: 1.5),
        ),
      ),
    );
  }

  Widget _primaryButton(String label, VoidCallback? onTap) {
    return SizedBox(
      height: 56,
      child: FilledButton(
        onPressed: onTap,
        style: FilledButton.styleFrom(
          backgroundColor: const Color(Config.accent),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(50)),
          elevation: 0,
        ),
        child: _loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            : Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
      ),
    );
  }
}

/// Shared smooth fade+slide transition used between sign-up steps.
class _Transition extends StatelessWidget {
  final int screenKey;
  final Widget child;
  const _Transition({required this.screenKey, required this.child});

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 300),
      transitionBuilder: (c, animation) => FadeTransition(
        opacity: CurvedAnimation(parent: animation, curve: Curves.easeIn),
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0.04, 0),
            end: Offset.zero,
          ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
          child: c,
        ),
      ),
      child: KeyedSubtree(key: ValueKey(screenKey), child: child),
    );
  }
}

/// riteangle brand lockup — icon mark + wordmark + tagline.
/// SVG paths ported from RiteLogo.svelte (web project).
class BrandLockup extends StatelessWidget {
  const BrandLockup();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Icon mark in rounded square
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: const Color(Config.accentTint),
            borderRadius: BorderRadius.circular(20),
          ),
          child: CustomPaint(
            painter: RiteMarkPainter(),
          ),
        ),
        const SizedBox(width: 14),
        // Wordmark + tagline
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            RichText(
              text: const TextSpan(
                style: TextStyle(
                  fontFamily: 'Gabarito',
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                  height: 1,
                ),
                children: [
                  TextSpan(
                    text: 'rite',
                    style: TextStyle(color: Color(Config.text1)),
                  ),
                  TextSpan(
                    text: 'angle',
                    style: TextStyle(
                      color: Color(Config.accent),
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Trust-first dating',
              style: TextStyle(
                fontSize: 14,
                color: Color(Config.accent),
                fontStyle: FontStyle.italic,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// Paints the riteangle mark: rotated L-angle (coral + pink) with heart.
/// Ported from RiteLogo.svelte viewBox="0 0 100 100".
class RiteMarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 100.0;
    canvas.scale(s, s);

    // L-angle rotated -10° around (50, 52)
    canvas.save();
    canvas.translate(50, 52);
    canvas.rotate(-10 * 3.14159265 / 180);
    canvas.translate(-50, -52);

    final vertPaint = Paint()
      ..color = const Color(0xFFFF7A4D)
      ..strokeWidth = 13
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    final horizPaint = Paint()
      ..color = const Color(0xFFFF3B6B)
      ..strokeWidth = 13
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    canvas.drawLine(const Offset(37, 26), const Offset(37, 72), vertPaint);
    canvas.drawLine(const Offset(37, 72), const Offset(80, 72), horizPaint);
    canvas.restore();

    // Heart — path from RiteLogo.svelte, transform: translate(39.67,22.22) scale(1.778)
    canvas.save();
    canvas.translate(39.67, 22.22);
    canvas.scale(1.778, 1.778);

    final heartPath = Path()
      ..moveTo(12, 21)
      ..cubicTo(12, 21, 3, 14.6, 3, 8.6)
      ..cubicTo(3, 5.4, 5.3, 3.4, 7.9, 3.4)
      ..cubicTo(9.8, 3.4, 11.3, 4.6, 12, 5.9)
      ..cubicTo(12.7, 4.6, 14.2, 3.4, 16.1, 3.4)
      ..cubicTo(18.7, 3.4, 21, 5.4, 21, 8.6)
      ..cubicTo(21, 14.6, 12, 21, 12, 21)
      ..close();

    canvas.drawPath(
      heartPath,
      Paint()
        ..color = const Color(0xFFE11D54)
        ..style = PaintingStyle.fill,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

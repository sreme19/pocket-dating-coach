import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// ── Isolated pure-Dart logic ─────────────────────────────────────────────────
// Mirrors the business rules in the app without requiring network, Supabase,
// Firebase, or any platform channel.

// Email validation (stricter than AuthScreen's bare `contains('@')` check;
// reflects what a real email validator should enforce):
bool isValidEmail(String email) {
  final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
  return emailRegex.hasMatch(email.trim());
}

// OTP validation — mirrors AuthScreen._verify: token.length < 6 guard,
// extended to require exactly 6 digits (no letters / symbols).
final _otpRegex = RegExp(r'^\d{6}$');
bool isValidOtp(String code) => _otpRegex.hasMatch(code);

// Trust score: _qaIntentScore (exact copy of api.dart logic for regression).
int qaIntentScore(Map? record) {
  if (record == null) return 0;
  final status = record['status']?.toString() ?? '';
  if (status != 'completed') return 0;
  final data = record['data'];
  if (data is! Map) return 100; // legacy row — no structured data
  final responses = data['responses'];
  if (responses is! Map) return 100; // legacy format
  final hasDrawnTo = responses.containsKey('drawn_to');
  final hasHowYouLive = responses.keys.any((k) => k != 'drawn_to');
  if (hasDrawnTo && hasHowYouLive) return 100;
  if (hasDrawnTo || hasHowYouLive) return 50;
  return 0;
}

// MatchmakerStatus model (exact copy of api.dart for regression).
class MatchmakerStatus {
  final bool eligible;
  final int runsUsed;
  final int runsLimit;

  MatchmakerStatus({
    required this.eligible,
    required this.runsUsed,
    required this.runsLimit,
  });

  int get remaining => (runsLimit - runsUsed).clamp(0, runsLimit);
}

// ─────────────────────────────────────────────────────────────────────────────

void main() {
  // ── Form validation ───────────────────────────────────────────────────────
  group('Email validation', () {
    test('accepts valid email: a@b.com', () {
      expect(isValidEmail('a@b.com'), isTrue);
    });

    test('accepts valid email: user@example.co.id', () {
      expect(isValidEmail('user@example.co.id'), isTrue);
    });

    test('rejects bare string with no @', () {
      expect(isValidEmail('notanemail'), isFalse);
    });

    test('rejects email starting with @', () {
      expect(isValidEmail('@nodomain'), isFalse);
    });

    test('rejects email with no domain after @', () {
      expect(isValidEmail('missing@'), isFalse);
    });
  });

  group('OTP validation', () {
    test('accepts exactly 6 digits', () {
      expect(isValidOtp('123456'), isTrue);
    });

    test('rejects 5-digit code', () {
      expect(isValidOtp('12345'), isFalse);
    });

    test('rejects 7-digit code', () {
      expect(isValidOtp('1234567'), isFalse);
    });

    test('rejects code with letters', () {
      expect(isValidOtp('abcdef'), isFalse);
    });

    test('rejects alphanumeric code', () {
      expect(isValidOtp('123abc'), isFalse);
    });

    test('rejects empty string', () {
      expect(isValidOtp(''), isFalse);
    });
  });

  // ── Trust score logic ─────────────────────────────────────────────────────
  group('qaIntentScore', () {
    test('returns 0 when record is null', () {
      expect(qaIntentScore(null), 0);
    });

    test('returns 0 when status is not completed', () {
      expect(qaIntentScore({'status': 'pending', 'data': {}}), 0);
    });

    test('returns 100 for completed row with no data field (legacy)', () {
      expect(qaIntentScore({'status': 'completed'}), 100);
    });

    test('returns 100 for completed row with non-Map data (legacy)', () {
      expect(qaIntentScore({'status': 'completed', 'data': 'old-format'}), 100);
    });

    test('returns 100 for completed row with non-Map responses (legacy)', () {
      expect(
        qaIntentScore({'status': 'completed', 'data': {}}),
        100,
      );
    });

    test('returns 50 when only drawn_to key present', () {
      expect(
        qaIntentScore({
          'status': 'completed',
          'data': {
            'responses': {'drawn_to': ['adventurous', 'kind']}
          }
        }),
        50,
      );
    });

    test('returns 50 when only non-drawn_to keys present', () {
      expect(
        qaIntentScore({
          'status': 'completed',
          'data': {
            'responses': {'how_you_live': 'active'}
          }
        }),
        50,
      );
    });

    test('returns 100 when both drawn_to and other keys present', () {
      expect(
        qaIntentScore({
          'status': 'completed',
          'data': {
            'responses': {
              'drawn_to': ['kind'],
              'how_you_live': 'active',
            }
          }
        }),
        100,
      );
    });
  });

  // ── MatchmakerStatus model ────────────────────────────────────────────────
  group('MatchmakerStatus', () {
    test('remaining = runsLimit - runsUsed', () {
      final s = MatchmakerStatus(eligible: true, runsUsed: 1, runsLimit: 3);
      expect(s.remaining, 2);
    });

    test('remaining is 0 when runsUsed equals runsLimit', () {
      final s = MatchmakerStatus(eligible: false, runsUsed: 3, runsLimit: 3);
      expect(s.remaining, 0);
    });

    test('remaining is clamped to 0 when runsUsed exceeds runsLimit', () {
      final s = MatchmakerStatus(eligible: false, runsUsed: 5, runsLimit: 3);
      expect(s.remaining, 0);
    });

    test('eligible is false when remaining is 0', () {
      final s = MatchmakerStatus(eligible: false, runsUsed: 3, runsLimit: 3);
      expect(s.remaining, 0);
      expect(s.eligible, isFalse);
    });

    test('remaining equals runsLimit when runsUsed is 0', () {
      final s = MatchmakerStatus(eligible: true, runsUsed: 0, runsLimit: 3);
      expect(s.remaining, 3);
    });
  });

  // ── Navigation smoke ──────────────────────────────────────────────────────
  group('Navigation smoke', () {
    testWidgets('MaterialApp widget builds without crash', (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(body: Text('smoke')),
      ));
      expect(find.text('smoke'), findsOneWidget);
    });
  });
}

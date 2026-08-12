import 'package:flutter_test/flutter_test.dart';

// ── Isolated pure-Dart logic ─────────────────────────────────────────────────
// Mirrors two rules from VerificationScreen (verification_screen.dart, fixed
// in bd836481) without requiring Supabase, network, or widget mounting.
//
// Handoff context: step 0 (the selfie) used to be skippable two ways — a link
// on the step itself, and the header Skip button jumping straight to step 3.
// Skipping left the profile with no anchor selfie, which made every later
// photo check fall back to bare face detection and kept the profile invisible
// in Discover and the matchmaker pool (POOL_REQUIRED_STEPS = liveness +
// photos). Four live users reached that state before the fix.

/// Mirrors the loop in VerificationScreen._loadExisting that preloads
/// `_livenessDone`. Only a `completed` liveness row counts — `under_review`
/// must still show its retake affordance, or a user mid-review would see the
/// step as unpassable in the *other* direction (told to redo work in review).
bool hasCompletedLiveness(List<Map<String, dynamic>> verificationRows) {
  for (final row in verificationRows) {
    if (row['step'] == 'liveness' && row['status'] == 'completed') return true;
  }
  return false;
}

/// Mirrors the header Skip button's visibility condition. Steps 0 (selfie)
/// and 3 (name/age/city/photos) are mandatory and show no Skip; only the two
/// Q&A steps (1, 2) are skippable.
bool showsSkipButton(int step) => step != 0 && step != 3;

void main() {
  group('hasCompletedLiveness — selfie preload (bd836481)', () {
    test('true when a liveness row is completed', () {
      expect(
        hasCompletedLiveness([
          {'step': 'liveness', 'status': 'completed', 'data': {}},
        ]),
        isTrue,
      );
    });

    test('false when the liveness row is only under_review — must still offer retake', () {
      expect(
        hasCompletedLiveness([
          {'step': 'liveness', 'status': 'under_review', 'data': {}},
        ]),
        isFalse,
      );
    });

    test('false when there is no liveness row at all (fresh onboarding)', () {
      expect(
        hasCompletedLiveness([
          {'step': 'photos', 'status': 'completed', 'data': {}},
        ]),
        isFalse,
      );
    });

    test('false on an empty row set', () {
      expect(hasCompletedLiveness([]), isFalse);
    });

    test('ignores a completed row for a different step entirely', () {
      expect(
        hasCompletedLiveness([
          {'step': 'spending_or_qa', 'status': 'completed', 'data': {}},
        ]),
        isFalse,
      );
    });
  });

  group('showsSkipButton — mandatory steps show no escape hatch (bd836481)', () {
    test('step 0 (selfie) has no Skip — this is the regression the fix closes', () {
      expect(showsSkipButton(0), isFalse);
    });

    test('step 3 (photos) has no Skip — unchanged, was always mandatory', () {
      expect(showsSkipButton(3), isFalse);
    });

    test('step 1 (Q&A) still offers Skip', () {
      expect(showsSkipButton(1), isTrue);
    });

    test('step 2 (Q&A) still offers Skip', () {
      expect(showsSkipButton(2), isTrue);
    });
  });
}

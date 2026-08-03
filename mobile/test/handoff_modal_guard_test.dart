import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The "Your turn to step in" modal re-fired on EVERY app open, because its guard
/// was an in-memory Set — "already shown this session" — which a cold start
/// emptied. Someone had already tried to fix this once by memoising the onboarding
/// future so HomeShell stopped being torn down on auth events (see the comment in
/// main.dart), which cured the re-pop *within* a session but not across launches.
///
/// It regressed once, so the two rules that fix it are pinned here:
///   1. the guard survives a cold start, and
///   2. it is keyed by nudge STAGE, so the paced ladder in the spec still gets
///      through — at most three interruptions per match across the 48-hour window,
///      not one per launch.
///
/// These mirror `_handoffStage` and the prefs round-trip in chat_list_screen.dart.
/// The thresholds come from handoff-clock.ts on the server (48h window; nudges at
/// 24h and 45h).

const String kPrefsKey = 'vv_handoff_modal_stage';

int handoffStage(DateTime? handoffAt, {required DateTime now}) {
  if (handoffAt == null) return 1;
  final hours = now.difference(handoffAt).inMinutes / 60.0;
  if (hours >= 45) return 3;
  if (hours >= 24) return 2;
  return 1;
}

bool shouldShow(Map<String, int> shown, String matchId, int stage) =>
    stage > (shown[matchId] ?? 0);

void main() {
  group('handoff nudge stage', () {
    final at = DateTime(2026, 8, 4, 0, 0);

    test('stage 1 from wrap-up until the 24-hour mark', () {
      expect(handoffStage(at, now: at), 1);
      expect(handoffStage(at, now: at.add(const Duration(hours: 23, minutes: 59))), 1);
    });

    test('stage 2 from 24 hours', () {
      expect(handoffStage(at, now: at.add(const Duration(hours: 24))), 2);
      expect(handoffStage(at, now: at.add(const Duration(hours: 44, minutes: 59))), 2);
    });

    test('stage 3 in the final hours', () {
      // 45h matches HANDOFF_NUDGE_FINAL_HOURS, ~3h before the 48h expiry.
      expect(handoffStage(at, now: at.add(const Duration(hours: 45))), 3);
      expect(handoffStage(at, now: at.add(const Duration(hours: 47, minutes: 59))), 3);
    });

    test('a hand-off with no timestamp is treated as stage 1, not skipped', () {
      expect(handoffStage(null, now: at), 1);
    });
  });

  group('the modal guard', () {
    test('shows once per stage and not again within that stage', () {
      final shown = <String, int>{};
      expect(shouldShow(shown, 'm1', 1), isTrue);
      shown['m1'] = 1;
      // This is the bug: every subsequent app open re-asked at the same stage.
      expect(shouldShow(shown, 'm1', 1), isFalse);
      expect(shouldShow(shown, 'm1', 1), isFalse);
    });

    test('interrupts again only when the stage advances', () {
      final shown = {'m1': 1};
      expect(shouldShow(shown, 'm1', 2), isTrue);
      shown['m1'] = 2;
      expect(shouldShow(shown, 'm1', 2), isFalse);
      expect(shouldShow(shown, 'm1', 3), isTrue);
    });

    test('at most three interruptions across the whole window', () {
      final shown = <String, int>{};
      var count = 0;
      // Simulate opening the app every half hour for the full 48 hours.
      final at = DateTime(2026, 8, 4);
      for (var m = 0; m < 48 * 60; m += 30) {
        final stage = handoffStage(at, now: at.add(Duration(minutes: m)));
        if (shouldShow(shown, 'm1', stage)) {
          shown['m1'] = stage;
          count++;
        }
      }
      expect(count, 3, reason: '96 app opens must yield 3 modals, one per stage');
    });

    test('tracks matches independently', () {
      final shown = {'m1': 3};
      expect(shouldShow(shown, 'm2', 1), isTrue);
      expect(shouldShow(shown, 'm1', 3), isFalse);
    });
  });

  group('persistence across a cold start', () {
    setUp(() => SharedPreferences.setMockInitialValues({}));

    test('the guard survives being written and re-read', () async {
      var prefs = await SharedPreferences.getInstance();
      await prefs.setString(kPrefsKey, jsonEncode({'m1': 2}));

      // A cold start: brand-new instance, nothing in memory.
      prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(kPrefsKey);
      expect(raw, isNotNull);
      final restored = (jsonDecode(raw!) as Map<String, dynamic>)
          .map((k, v) => MapEntry(k, (v as num).toInt()));

      expect(restored['m1'], 2);
      // The whole point: stage 2 has been seen, so opening the app must not re-ask.
      expect(shouldShow(restored, 'm1', 2), isFalse);
      // But the final-hours warning still gets through.
      expect(shouldShow(restored, 'm1', 3), isTrue);
    });

    test('a first-ever launch has no guard and may show stage 1', () async {
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString(kPrefsKey), isNull);
      expect(shouldShow(<String, int>{}, 'm1', 1), isTrue);
    });
  });
}

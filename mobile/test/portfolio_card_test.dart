import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:verified_vibe/advisor_screen.dart';
import 'package:verified_vibe/api.dart';

// The pinned Trust & Boost portfolio card at the top of the advisor thread.
//
// Two cases here are load-bearing rather than cosmetic:
//
//   - Money categories must be presented as verification and nothing else: no
//     profile-strength delta, no named match, no appeal gain (App Store guideline
//     1.1.4). The endpoint already excludes them from `actions`, so this test
//     covers the day someone changes that.
//   - The header counts proof CATEGORIES and the band line counts Profile Strength
//     POINTS. Those numbers collide on real data (`0 of 13 proofs` above a 13-point
//     band gap), so both lines have to name their unit.

Widget wrap(AdvisorPortfolio p) => MaterialApp(
      home: Scaffold(body: Column(children: [PortfolioCard(p: p, onOpen: (_) {})])),
    );

AdvisorPortfolio get _full => AdvisorPortfolio.fromJson({
      'done': 4,
      'total': 13,
      'completed': ['lifestyle', 'discipline', 'travel', 'photos'],
      'profileStrength': 24.5,
      'band': 'Getting started',
      'nextBand': 'Building',
      'pointsToNextBand': 0.5,
      'actions': [
        {
          'id': 'linkedin',
          'label': 'Career',
          'askPhrase': 'career (a LinkedIn screenshot, or your resume)',
          'deltaPS': 5,
          'crossesBand': true,
          'bandAfter': 'Building',
          'appealGains': [
            {'name': 'Aisha', 'delta': 3.2}
          ],
          'matchesHelped': 1
        }
      ],
    });

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('full payload renders', (t) async {
    await t.pumpWidget(wrap(_full));
    await t.pumpAndSettle();
    expect(find.text('4 of 13 proofs'), findsOneWidget);
    expect(find.text('Getting started - 0.5 points to "Building"'), findsOneWidget);
    expect(find.text('Next: add career'), findsOneWidget);
    expect(find.text('+5 profile strength - moves you up to "Building"'), findsOneWidget);
    expect(find.text('Add proof'), findsOneWidget);
    expect(find.text('Photos'), findsOneWidget); // unknown id still shows
  });

  testWidgets('no vectors: counts only, no action block', (t) async {
    await t.pumpWidget(wrap(AdvisorPortfolio.fromJson(
        {'done': 0, 'total': 13, 'completed': <String>[], 'actions': <dynamic>[]})));
    await t.pumpAndSettle();
    expect(find.text('0 of 13 proofs'), findsOneWidget);
    expect(find.text('Add proof'), findsNothing);
  });

  testWidgets('zero proofs leaves the meter empty', (t) async {
    await t.pumpWidget(wrap(AdvisorPortfolio.fromJson(
        {'done': 0, 'total': 13, 'completed': <String>[], 'actions': <dynamic>[]})));
    await t.pumpAndSettle();
    final meter = t.widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator));
    expect(meter.value, 0); // no minimum sliver — zero looks like zero
  });

  testWidgets('band line names its unit, and singular reads "point"', (t) async {
    await t.pumpWidget(wrap(AdvisorPortfolio.fromJson({
      'done': 0,
      'total': 13,
      'completed': <String>[],
      'band': 'Building',
      'nextBand': 'Climbing',
      'pointsToNextBand': 13,
      'actions': <dynamic>[],
    })));
    await t.pumpAndSettle();
    // Both 13s on screen, each naming what it counts.
    expect(find.text('0 of 13 proofs'), findsOneWidget);
    expect(find.text('Building - 13 points to "Climbing"'), findsOneWidget);

    await t.pumpWidget(wrap(AdvisorPortfolio.fromJson({
      'done': 0, 'total': 13, 'completed': <String>[],
      'band': 'Building', 'nextBand': 'Climbing', 'pointsToNextBand': 1,
      'actions': <dynamic>[],
    })));
    await t.pumpAndSettle();
    expect(find.text('Building - 1 point to "Climbing"'), findsOneWidget);
  });

  testWidgets('money action shows verification language only', (t) async {
    await t.pumpWidget(wrap(AdvisorPortfolio.fromJson({
      'done': 1,
      'total': 13,
      'completed': ['travel'],
      'band': 'Building',
      'actions': [
        {
          'id': 'wealth',
          'label': 'Financial verification',
          'deltaPS': 9,
          'crossesBand': true,
          'bandAfter': 'Strong',
          'appealGains': [
            {'name': 'Aisha', 'delta': 4}
          ],
          'matchesHelped': 2
        }
      ],
    })));
    await t.pumpAndSettle();
    expect(find.text('Next: verify financial verification'), findsOneWidget);
    expect(find.textContaining('profile strength'), findsNothing);
    expect(find.textContaining('Aisha'), findsNothing);
    expect(find.textContaining('Lifts you'), findsNothing);
  });

  // ── Collapse ──────────────────────────────────────────────────────────────

  testWidgets('starts expanded when nothing is stored', (t) async {
    await t.pumpWidget(wrap(_full));
    await t.pumpAndSettle();
    expect(find.text('Add proof'), findsOneWidget);
  });

  testWidgets('tapping the header collapses to header + meter, and persists', (t) async {
    await t.pumpWidget(wrap(_full));
    await t.pumpAndSettle();

    await t.tap(find.text('YOUR PROOF PORTFOLIO'));
    await t.pumpAndSettle();

    // Header and meter survive; everything below is gone.
    expect(find.text('4 of 13 proofs'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(find.text('Getting started - 0.5 points to "Building"'), findsNothing);
    expect(find.text('Next: add career'), findsNothing);
    expect(find.text('Add proof'), findsNothing);
    expect(find.text('Career'), findsNothing); // chip row hidden

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString(PortfolioCard.openKey), '0');

    // And it toggles back.
    await t.tap(find.text('YOUR PROOF PORTFOLIO'));
    await t.pumpAndSettle();
    expect(find.text('Add proof'), findsOneWidget);
    expect((await SharedPreferences.getInstance()).getString(PortfolioCard.openKey), '1');
  });

  testWidgets('a stored collapse is restored on next open', (t) async {
    SharedPreferences.setMockInitialValues({PortfolioCard.openKey: '0'});
    await t.pumpWidget(wrap(_full));
    await t.pumpAndSettle();
    expect(find.text('4 of 13 proofs'), findsOneWidget);
    expect(find.text('Add proof'), findsNothing);
  });
}

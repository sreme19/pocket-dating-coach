import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:verified_vibe/advisor_screen.dart';
import 'package:verified_vibe/api.dart';

// The pinned Trust & Boost portfolio card at the top of the advisor thread.
//
// The third case is the load-bearing one: money categories must be presented as
// verification and nothing else — no profile-strength delta, no named match, no
// appeal gain (App Store guideline 1.1.4). The server already keeps them out of
// `actions`, so this test covers the day someone changes that.

Widget wrap(AdvisorPortfolio p) => MaterialApp(
      home: Scaffold(body: Column(children: [PortfolioCard(p: p, onOpen: (_) {})])),
    );

void main() {
  testWidgets('full payload renders', (t) async {
    await t.pumpWidget(wrap(AdvisorPortfolio.fromJson({
      'done': 4, 'total': 13,
      'completed': ['lifestyle', 'discipline', 'travel', 'photos'],
      'profileStrength': 24.5, 'band': 'Getting started',
      'nextBand': 'Building', 'pointsToNextBand': 0.5,
      'actions': [
        {'id': 'linkedin', 'label': 'Career',
         'askPhrase': 'career (a LinkedIn screenshot, or your resume)',
         'deltaPS': 5, 'crossesBand': true, 'bandAfter': 'Building',
         'appealGains': [{'name': 'Aisha', 'delta': 3.2}], 'matchesHelped': 1}
      ],
    })));
    expect(find.text('4 of 13 proven'), findsOneWidget);
    expect(find.text('Getting started - 0.5 to go to "Building"'), findsOneWidget);
    expect(find.text('Next: add career'), findsOneWidget);
    expect(find.text('+5 profile strength - moves you up to "Building"'), findsOneWidget);
    expect(find.text('Add proof'), findsOneWidget);
    expect(find.text('Photos'), findsOneWidget); // unknown id still shows
  });

  testWidgets('no vectors: counts only, no action block', (t) async {
    await t.pumpWidget(wrap(AdvisorPortfolio.fromJson(
        {'done': 0, 'total': 13, 'completed': <String>[], 'actions': <dynamic>[]})));
    expect(find.text('0 of 13 proven'), findsOneWidget);
    expect(find.text('Add proof'), findsNothing);
  });

  testWidgets('money action shows verification language only', (t) async {
    await t.pumpWidget(wrap(AdvisorPortfolio.fromJson({
      'done': 1, 'total': 13, 'completed': ['travel'], 'band': 'Building',
      'actions': [
        {'id': 'wealth', 'label': 'Financial verification', 'deltaPS': 9,
         'crossesBand': true, 'bandAfter': 'Strong',
         'appealGains': [{'name': 'Aisha', 'delta': 4}], 'matchesHelped': 2}
      ],
    })));
    expect(find.text('Next: verify financial verification'), findsOneWidget);
    expect(find.textContaining('profile strength'), findsNothing);
    expect(find.textContaining('Aisha'), findsNothing);
    expect(find.textContaining('Lifts you'), findsNothing);
  });
}

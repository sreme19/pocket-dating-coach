import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:verified_vibe/onboarding_questions.dart';
import 'package:verified_vibe/onboarding_qa_step.dart';

const _allArchetypes = [
  'casual_generous_man', 'spoiled_casual_woman',
  'hopeless_romantic_man', 'hopeless_romantic_woman',
  'forever_focused_man', 'forever_focused_woman',
  'traditional_matrimony_man', 'traditional_matrimony_woman',
  'rebound_healing_man', 'rebound_healing_woman',
  'untouched_heart_man', 'untouched_heart_woman',
  'second_chapter_man', 'second_chapter_woman',
  'just_friends_man', 'just_friends_woman',
];

void main() {
  group('data integrity — every archetype', () {
    for (final a in _allArchetypes) {
      test('$a has 4 Drawn-To + 4 How-You-Live sections, valid options', () {
        final drawn = drawnToSections(a);
        final how = howYouLiveSections(a);
        expect(drawn.length, 4, reason: 'DrawnTo sections for $a');
        expect(how.length, 4, reason: 'HowYouLive sections for $a');

        for (final s in [...drawn, ...how]) {
          expect(s.key, isNotEmpty);
          expect(s.title, isNotEmpty);
          expect(s.options, isNotEmpty, reason: '${s.key} has options');
          // no empty labels; no duplicate labels within a section
          final labels = [...s.options, ...s.more].map((o) => o.label).toList();
          expect(labels.where((l) => l.trim().isEmpty), isEmpty);
          expect(labels.toSet().length, labels.length, reason: 'no dup labels in ${s.key}');
          if (s.kind == QKind.multi) {
            expect(s.max, greaterThanOrEqualTo(3), reason: 'multi cap for ${s.key}');
          }
        }
      });

      test('$a required keys are a subset of its section keys', () {
        final drawnKeys = drawnToSections(a).map((s) => s.key).toSet();
        final howKeys = howYouLiveSections(a).map((s) => s.key).toSet();
        // DrawnTo: ALL sections required (web: filledSections >= length)
        expect(drawnToRequiredKeys(a).toSet(), drawnKeys);
        // HowYouLive: required is a 3-key subset
        final req = howYouLiveRequiredKeys(a);
        expect(req.length, 3);
        expect(howKeys.containsAll(req), isTrue, reason: 'required ⊆ sections for $a');

        expect(drawnToTitle(a), isNotEmpty);
        expect(howYouLiveTitle(a), isNotEmpty);
      });
    }

    test('faithful spot-checks against web source', () {
      final energy = drawnToSections('casual_generous_man').first;
      expect(energy.key, 'energy');
      expect(energy.options.map((o) => o.label), contains('Confident'));
      expect(energy.options.map((o) => o.label), contains('Glamorous'));
      expect(energy.more.map((o) => o.label), contains('Magnetic presence'));

      final religion = howYouLiveSections('traditional_matrimony_man')
          .firstWhere((s) => s.key == 'religion');
      expect(religion.kind, QKind.single);
      expect(religion.options.map((o) => o.label), containsAll(['Hindu', 'Muslim', 'Christian']));

      final lifestyleCard = howYouLiveSections('casual_generous_man')
          .firstWhere((s) => s.key == 'lifestyle');
      expect(lifestyleCard.kind, QKind.card);
      expect(lifestyleCard.options.first.sub, isNotNull); // cards carry a subtitle

      // private "chemistry" caps at 5 (web `?? 5`), not the model default of 3
      final chem = howYouLiveSections('casual_generous_man')
          .firstWhere((s) => s.key == 'chemistry');
      expect(chem.private, isTrue);
      expect(chem.max, 5);
    });
  });

  group('QaStep rendering', () {
    testWidgets('renders Drawn-To chips + "+ more options"', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: QaStep(
              sections: drawnToSections('casual_generous_man'),
              picks: const {},
              onTap: (_, __) {},
            ),
          ),
        ),
      ));
      expect(find.text("Energy you're drawn to"), findsOneWidget);
      expect(find.text('Confident'), findsOneWidget);
      expect(find.text('International travel'), findsOneWidget);
      expect(find.text('+ more options'), findsWidgets);
    });

    testWidgets('renders How-You-Live card + PRIVATE badge', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: QaStep(
              sections: howYouLiveSections('casual_generous_man'),
              picks: const {},
              onTap: (_, __) {},
            ),
          ),
        ),
      ));
      expect(find.text('Comfortable & established'), findsOneWidget); // card label
      expect(find.text('PRIVATE'), findsWidgets); // chemistry + income are private
    });

    testWidgets('onTap fires with the tapped section + label', (tester) async {
      QSection? gotSection;
      String? gotLabel;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: QaStep(
              sections: drawnToSections('casual_generous_man'),
              picks: const {},
              onTap: (s, l) { gotSection = s; gotLabel = l; },
            ),
          ),
        ),
      ));
      await tester.tap(find.text('Confident'));
      expect(gotLabel, 'Confident');
      expect(gotSection?.key, 'energy');
    });
  });
}

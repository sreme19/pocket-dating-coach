import 'package:flutter/material.dart';

import 'api.dart';
import 'config.dart';
import 'app_logger.dart';

/// "Report issue" — the in-app escape hatch for anything the automated screens
/// got wrong, and the human backstop behind the photo content gate.
///
/// The content screen answers "ok" when it is unsure and fails open on an API
/// error, so some nudity or distressing imagery WILL reach a profile. That trade
/// is only defensible because a human can flag it quickly. This is that path.
///
/// Deliberately distinct from the Report action in a chat (see
/// conversation_screen): that reports the PERSON and feeds account moderation.
/// This reports what is on screen, and may be about nobody at all.
const _categories = <List<String>>[
  ['nudity', 'Nudity or sexual content'],
  ['disturbing', 'Disturbing or graphic content'],
  ['wrong_person', "The photos aren't this person"],
  ['bug', 'Something is broken'],
  ['other', 'Something else'],
];

/// A quiet footer affordance. Not a red button: it has to be findable the moment
/// someone needs it without implying the profile they're looking at is suspect.
class ReportIssueFooter extends StatelessWidget {
  const ReportIssueFooter({
    super.key,
    required this.subjectUserId,
    required this.surface,
    this.subjectUrl,
    this.subjectName,
  });

  final String subjectUserId;
  final String surface;
  final String? subjectUrl;
  final String? subjectName;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: Column(children: [
        const Divider(height: 24, color: Color(0x14000000)),
        Align(
          alignment: Alignment.center,
          child: TextButton.icon(
            onPressed: () => showReportIssueSheet(
              context,
              subjectUserId: subjectUserId,
              surface: surface,
              subjectUrl: subjectUrl,
              subjectName: subjectName,
            ),
            icon: const Icon(Icons.flag_outlined, size: 16, color: Color(Config.text3)),
            label: const Text('Report issue',
                style: TextStyle(fontSize: 13, color: Color(Config.text3))),
          ),
        ),
      ]),
    );
  }
}

/// Opens the category sheet, then posts the report. Never a one-tap send: a
/// report with no category is the least actionable thing the team can receive.
Future<void> showReportIssueSheet(
  BuildContext context, {
  required String subjectUserId,
  required String surface,
  String? subjectUrl,
  String? subjectName,
}) async {
  final category = await showModalBottomSheet<String>(
    context: context,
    backgroundColor: const Color(Config.bg2),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Report an issue',
                style: TextStyle(
                    color: Color(Config.text1), fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            const Text(
              "What's wrong here? Someone on our team reviews every report, and we act on "
              'anything that breaks our rules.',
              style: TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.4),
            ),
          ]),
        ),
        for (final c in _categories)
          ListTile(
            title: Text(c[1], style: const TextStyle(color: Color(Config.text1))),
            onTap: () => Navigator.pop(ctx, c[0]),
          ),
        const SizedBox(height: 8),
      ]),
    ),
  );
  if (category == null) return;

  final messenger = ScaffoldMessenger.of(context);
  try {
    await reportIssue(
      category: category,
      surface: surface,
      subjectUserId: subjectUserId,
      subjectUrl: subjectUrl,
      context: {if (subjectName != null) 'name': subjectName},
    );
    messenger.showSnackBar(const SnackBar(
      duration: Duration(seconds: 5),
      content: Text("Thanks — we got it. Someone on our team reviews every report."),
    ));
  } catch (e) {
    AppLogger.instance.error(e, screen: 'report_issue', action: 'submit');
    messenger.showSnackBar(SnackBar(content: Text('Could not send that report: $e')));
  }
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';
import 'app_logger.dart';
import 'config.dart';

/// Refer & Earn — women invite men (Model A: "come talk to me").
///
/// Kept in LOCKSTEP with the web equivalent at
/// src/routes/verified-vibe/refer/+page.svelte: copy, women-only gating (403),
/// and the "N invited . M signed up" status line must match. She shares her
/// /beta link with the men already in her DMs on other apps; her AI Bestie gets
/// to know and ranks each of them and hands her the gems. No money changes
/// hands, the vetted men are the reward. Data comes from
/// GET /api/verified-vibe/referral-link (see api.dart fetchReferralLink).
///
/// House style note: display strings use DOUBLE quotes so straight apostrophes
/// ("I've", "don't", "you're") are safe without escaping.
class ReferScreen extends StatefulWidget {
  const ReferScreen({super.key});

  @override
  State<ReferScreen> createState() => _ReferScreenState();
}

enum _View { loading, ready, denied, error }

class _ReferScreenState extends State<ReferScreen> {
  static const _border1 = Color(0xFFF1E0E3);
  static const _border2 = Color(0xFFE7D2D7);

  _View _view = _View.loading;
  ReferralLink? _link;
  int _invited = 0;
  int _signedUp = 0;
  bool _copiedLink = false;
  bool _copiedMsg = false;
  final _msg = TextEditingController();

  @override
  void initState() {
    super.initState();
    AppLogger.instance.screen('refer');
    _load();
  }

  @override
  void dispose() {
    _msg.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _view = _View.loading);
    try {
      final link = await fetchReferralLink();
      if (!mounted) return;
      setState(() {
        _link = link;
        _invited = link.invited;
        _signedUp = link.signedUp;
        _msg.text = _messageFor(link.shareUrl);
        _view = _View.ready;
      });
    } on ReferralLinkDenied {
      if (mounted) setState(() => _view = _View.denied);
    } catch (_) {
      if (mounted) setState(() => _view = _View.error);
    }
  }

  String _messageFor(String url) =>
      "hey! sorry, I've got hundreds of messages here and don't have time to reply to them all. "
      "but I'd genuinely love to talk if you're my type. I'm moving my convos over to the Riteangle app, "
      "so if you actually wanna get to know me, start here 👉 $url";

  String get _prettyUrl =>
      (_link?.shareUrl ?? '').replaceFirst(RegExp(r'^https?://'), '');

  Future<void> _shareWhatsApp() async {
    AppLogger.instance.action('refer', 'share_whatsapp');
    final uri = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(_msg.text)}');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  void _copy(String text, {required bool isLink}) {
    Clipboard.setData(ClipboardData(text: text));
    AppLogger.instance.action('refer', isLink ? 'copy_link' : 'copy_message');
    setState(() {
      if (isLink) {
        _copiedLink = true;
      } else {
        _copiedMsg = true;
      }
    });
    Future.delayed(const Duration(milliseconds: 1600), () {
      if (!mounted) return;
      setState(() {
        if (isLink) {
          _copiedLink = false;
        } else {
          _copiedMsg = false;
        }
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(Config.bg1),
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(Config.text2)),
        title: const Text('Refer & Earn',
            style: TextStyle(fontWeight: FontWeight.w700, color: Color(Config.text1))),
        centerTitle: true,
      ),
      body: _content(),
    );
  }

  Widget _content() {
    switch (_view) {
      case _View.loading:
        return const Center(
          child: CircularProgressIndicator(color: Color(Config.accent)),
        );
      case _View.denied:
        return _pad(const Text(
          "Refer & Earn is for women inviting the men in their DMs. It isn't available on your account.",
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(Config.text2), height: 1.5, fontSize: 15),
        ));
      case _View.error:
        return _pad(Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              "Couldn't load your link. Check your connection and try again.",
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(Config.text2), height: 1.5, fontSize: 15),
            ),
            const SizedBox(height: 14),
            OutlinedButton(onPressed: _load, child: const Text('Retry')),
          ],
        ));
      case _View.ready:
        return _readyBody();
    }
  }

  Widget _pad(Widget child) => Center(
        child: Padding(padding: const EdgeInsets.all(32), child: child),
      );

  Widget _readyBody() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Turn your DMs into dates.',
              style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: Color(Config.text1),
                  height: 1.1,
                  letterSpacing: -0.5)),
          const SizedBox(height: 6),
          const Text('Your AI Bestie speaks to them. Not you.',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(Config.accentBright))),
          const SizedBox(height: 16),
          const Text(
            "Hundreds of guys sliding into your DMs on Instagram, WhatsApp and Tinder? "
            "Most are creeps 🙄 but a few are genuine, successful, even high-earning. "
            "You don't have the time to text them all. So send them your link: your Bestie "
            "talks to every one of them, ranks them, and brings you only the ones worth your time.",
            style: TextStyle(fontSize: 14.5, color: Color(Config.text2), height: 1.55),
          ),
          const SizedBox(height: 22),
          _step(1, 'Share your link with the guys already chasing you.'),
          const SizedBox(height: 10),
          _step(2, "Your Bestie gets to know and ranks each of them, so you don't have to."),
          const SizedBox(height: 10),
          _step(3, 'The best ones get handed straight to you. You only meet the gems.'),
          const SizedBox(height: 22),
          _linkCard(),
          const SizedBox(height: 12),
          _shareRow(),
          const SizedBox(height: 22),
          _messageBlock(),
          const SizedBox(height: 22),
          _statusLine(),
        ],
      ),
    );
  }

  Widget _step(int n, String text) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _border1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
                color: Color(Config.accent), shape: BoxShape.circle),
            child: Text('$n',
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(text,
                style: const TextStyle(
                    fontSize: 14, color: Color(Config.text1), height: 1.4)),
          ),
        ],
      ),
    );
  }

  Widget _linkCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(Config.accentTint),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(Config.accent)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('YOUR LINK',
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.0,
                  color: Color(Config.accentBright))),
          const SizedBox(height: 3),
          Text(_prettyUrl,
              style: const TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w700, color: Color(Config.text1))),
        ],
      ),
    );
  }

  Widget _shareRow() {
    return Row(
      children: [
        Expanded(
          child: _filledBtn(
            onTap: _shareWhatsApp,
            icon: Icons.send_rounded,
            label: 'Share on WhatsApp',
          ),
        ),
        const SizedBox(width: 8),
        _outlinedBtn(
          onTap: () => _copy(_link?.shareUrl ?? '', isLink: true),
          label: _copiedLink ? 'Copied ✓' : 'Copy link',
        ),
      ],
    );
  }

  Widget _filledBtn(
      {required VoidCallback onTap, required IconData icon, required String label}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(
            color: const Color(Config.accent), borderRadius: BorderRadius.circular(12)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: Colors.white),
            const SizedBox(width: 8),
            Text(label,
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
          ],
        ),
      ),
    );
  }

  Widget _outlinedBtn({required VoidCallback onTap, required String label}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(Config.bg2),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _border2),
        ),
        child: Text(label,
            style: const TextStyle(
                color: Color(Config.text1), fontWeight: FontWeight.w700, fontSize: 14)),
      ),
    );
  }

  Widget _messageBlock() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('WHAT LANDS IN HIS DM',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                    color: Color(Config.text3))),
            GestureDetector(
              onTap: () => _copy(_msg.text, isLink: false),
              child: Text(_copiedMsg ? 'Copied ✓' : 'Copy message',
                  style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: Color(Config.accentBright))),
            ),
          ],
        ),
        const SizedBox(height: 7),
        TextField(
          controller: _msg,
          minLines: 4,
          maxLines: 7,
          style: const TextStyle(fontSize: 14, color: Color(Config.text1), height: 1.5),
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(Config.bg2),
            contentPadding: const EdgeInsets.all(12),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: _border2),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(Config.accent), width: 2),
            ),
          ),
        ),
        const Padding(
          padding: EdgeInsets.only(top: 6, left: 2),
          child: Text('Edit it to sound like you before you send.',
              style: TextStyle(fontSize: 12, color: Color(Config.text3))),
        ),
      ],
    );
  }

  Widget _statusLine() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _border1),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _stat('$_invited', 'invited', const Color(Config.text1)),
          Container(
            width: 4,
            height: 4,
            margin: const EdgeInsets.symmetric(horizontal: 12),
            decoration:
                const BoxDecoration(color: Color(Config.text3), shape: BoxShape.circle),
          ),
          _stat('$_signedUp', 'signed up', const Color(Config.accentBright)),
        ],
      ),
    );
  }

  Widget _stat(String k, String label, Color kColor) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(k,
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: kColor)),
        const SizedBox(width: 5),
        Text(label, style: const TextStyle(fontSize: 14, color: Color(Config.text2))),
      ],
    );
  }
}

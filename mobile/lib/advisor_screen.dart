import 'package:flutter/material.dart';
import 'api.dart';
import 'config.dart';
import 'markdown.dart';

/// AI advisor chat — Wingman (men) or Bestie (women). Proactive greeting on
/// open, quick-action intent chips, markdown replies, Bestie drafts, and
/// thumbs feedback. Each send posts the running history to the chat endpoint.
class AdvisorScreen extends StatefulWidget {
  final bool wingman;
  const AdvisorScreen({super.key, required this.wingman});

  @override
  State<AdvisorScreen> createState() => _AdvisorScreenState();
}

class _Turn {
  final String role; // 'user' | 'assistant' | 'greeting'
  final String content;
  final List<AdvisorDraft> drafts;
  final String? greetingId;
  int feedback = 0; // -1, 0, 1
  _Turn(this.role, this.content, {this.drafts = const [], this.greetingId});
}

class _AdvisorScreenState extends State<AdvisorScreen> {
  final _composer = TextEditingController();
  final _scroll = ScrollController();
  final List<_Turn> _turns = [];
  bool _thinking = false;

  bool get _wm => widget.wingman;
  String get _name => _wm ? 'AI Wingman' : 'AI Bestie';

  List<({String label, String intent})> get _chips => [
        (label: 'Summarize matches', intent: 'summary'),
        (label: _wm ? 'New insights' : 'Fresh insights', intent: 'insights'),
        (label: 'Better matches', intent: 'better_matches'),
        (label: 'Update profile', intent: 'update_profile'),
      ];

  @override
  void initState() {
    super.initState();
    _loadGreeting();
  }

  Future<void> _loadGreeting() async {
    final g = await fetchGreeting();
    if (g != null && mounted) {
      setState(() => _turns.add(_Turn('greeting', g.content, greetingId: g.id)));
      _scrollToBottom();
    }
  }

  /// History as role/content maps, excluding greeting + non-text turns.
  List<Map<String, String>> get _history => [
        for (final t in _turns)
          if (t.role == 'user' || t.role == 'assistant')
            {'role': t.role == 'user' ? 'user' : 'assistant', 'content': t.content},
      ];

  Future<void> _chip(String intent, String label) async {
    if (_thinking) return;
    if (intent == 'update_profile') {
      setState(() => _turns.add(_Turn('assistant',
          'Head to your **Profile** tab to edit your photos, About, archetype, and proof signals. Boosting your trust score there is the fastest way to better matches.')));
      _scrollToBottom();
      return;
    }
    if (intent == 'better_matches') {
      await _send(text: 'How can I get better matches?');
      return;
    }
    // summary / insights — empty message + intent
    setState(() => _turns.add(_Turn('user', label)));
    await _run(message: '', intent: intent);
  }

  Future<void> _send({String? text}) async {
    final t = (text ?? _composer.text).trim();
    if (t.isEmpty || _thinking) return;
    _composer.clear();
    setState(() => _turns.add(_Turn('user', t)));
    await _run(message: t, intent: 'chat');
  }

  Future<void> _run({required String message, required String intent}) async {
    setState(() => _thinking = true);
    _scrollToBottom();
    try {
      final history = _history.where((m) => m['content'] != message).toList();
      final r = await askAdvisor(wingman: _wm, message: message, history: history, intent: intent);
      setState(() {
        _turns.add(_Turn('assistant', r.reply, drafts: r.drafts));
        _thinking = false;
      });
    } catch (e) {
      setState(() {
        _turns.add(_Turn('assistant', '⚠️ Could not reach $_name: $e'));
        _thinking = false;
      });
    }
    _scrollToBottom();
  }

  Future<void> _sendDraft(AdvisorDraft d) async {
    try {
      await sendMessage(d.matchId, d.content);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Sent to ${d.matchName} 💬')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  Future<void> _feedback(_Turn t, bool positive) async {
    setState(() => t.feedback = positive ? 1 : -1);
    try {
      if (t.role == 'greeting' && t.greetingId != null && t.greetingId!.isNotEmpty) {
        await submitGreetingFeedback(t.greetingId!, positive ? 1 : -1);
      } else {
        await submitMessageFeedback(wingman: _wm, messageContent: t.content, positive: positive);
      }
    } catch (_) {/* non-fatal */}
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      }
    });
  }

  @override
  void dispose() {
    _composer.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        title: Row(children: [
          Text(_wm ? '🛡️ ' : '💚 ', style: const TextStyle(fontSize: 18)),
          Text(_name, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
        ]),
      ),
      body: Column(children: [
        Expanded(
          child: _turns.isEmpty && !_thinking
              ? _Intro(wingman: _wm)
              : ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.all(12),
                  itemCount: _turns.length + (_thinking ? 1 : 0),
                  itemBuilder: (context, i) {
                    if (i >= _turns.length) return const _Thinking();
                    return _Bubble(turn: _turns[i], onSendDraft: _sendDraft, onFeedback: _feedback);
                  },
                ),
        ),
        // Quick-action chips
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            children: [
              for (final c in _chips)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ActionChip(
                    label: Text(c.label, style: const TextStyle(color: Color(Config.accent), fontSize: 13)),
                    backgroundColor: const Color(0x2210B981),
                    side: const BorderSide(color: Color(0x4D10B981)),
                    onPressed: _thinking ? null : () => _chip(c.intent, c.label),
                  ),
                ),
            ],
          ),
        ),
        _composerBar(),
      ]),
    );
  }

  Widget _composerBar() => SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 6, 12, 8),
          color: const Color(Config.bg2),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: _composer,
                style: const TextStyle(color: Color(Config.text1)),
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
                decoration: InputDecoration(
                  hintText: 'Ask $_name…',
                  hintStyle: const TextStyle(color: Color(Config.text3)),
                  filled: true,
                  fillColor: const Color(Config.bg3),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: _send,
              child: const CircleAvatar(
                radius: 22,
                backgroundColor: Color(Config.accent),
                child: Icon(Icons.arrow_upward, color: Color(0xFF052819)),
              ),
            ),
          ]),
        ),
      );
}

class _Intro extends StatelessWidget {
  final bool wingman;
  const _Intro({required this.wingman});
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Text(
          wingman
              ? 'Your Wingman reads your matches and helps you make the right move. Ask anything, or tap a shortcut below.'
              : 'Your Bestie has your back — match reads, tips, and drafts. Ask anything, or tap a shortcut below.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: Color(Config.text2), fontSize: 15, height: 1.4),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  final _Turn turn;
  final void Function(AdvisorDraft) onSendDraft;
  final void Function(_Turn, bool) onFeedback;
  const _Bubble({required this.turn, required this.onSendDraft, required this.onFeedback});

  @override
  Widget build(BuildContext context) {
    final mine = turn.role == 'user';
    final greeting = turn.role == 'greeting';
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.82),
        decoration: BoxDecoration(
          color: mine ? const Color(Config.accent) : const Color(Config.bg3),
          borderRadius: BorderRadius.circular(16),
          border: greeting ? Border.all(color: const Color(0x4D10B981)) : null,
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (greeting)
            const Padding(
              padding: EdgeInsets.only(bottom: 4),
              child: Text('👋 A note for you',
                  style: TextStyle(color: Color(Config.accent), fontSize: 11, fontWeight: FontWeight.w700)),
            ),
          mine
              ? Text(turn.content, style: const TextStyle(color: Color(0xFF052819), fontSize: 15, height: 1.35))
              : buildMarkdown(turn.content, color: const Color(Config.text1)),
          for (final d in turn.drafts) _DraftCard(draft: d, onSend: () => onSendDraft(d)),
          if (!mine) _Feedback(turn: turn, onFeedback: onFeedback),
        ]),
      ),
    );
  }
}

class _DraftCard extends StatelessWidget {
  final AdvisorDraft draft;
  final VoidCallback onSend;
  const _DraftCard({required this.draft, required this.onSend});
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(Config.bg2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0x22FFFFFF)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Draft for ${draft.matchName}',
            style: const TextStyle(color: Color(Config.text2), fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Text(draft.content, style: const TextStyle(color: Color(Config.text1), fontSize: 14, height: 1.3)),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton(
            onPressed: draft.matchId.isEmpty ? null : onSend,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(Config.accent),
              foregroundColor: const Color(0xFF052819),
              visualDensity: VisualDensity.compact,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Send', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
      ]),
    );
  }
}

class _Feedback extends StatelessWidget {
  final _Turn turn;
  final void Function(_Turn, bool) onFeedback;
  const _Feedback({required this.turn, required this.onFeedback});
  @override
  Widget build(BuildContext context) {
    if (turn.feedback != 0) {
      return Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text(turn.feedback > 0 ? 'Thanks 👍' : 'Noted 🙏',
            style: const TextStyle(color: Color(Config.text3), fontSize: 12)),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        GestureDetector(
          onTap: () => onFeedback(turn, true),
          child: const Icon(Icons.thumb_up_outlined, size: 16, color: Color(Config.text3)),
        ),
        const SizedBox(width: 16),
        GestureDetector(
          onTap: () => onFeedback(turn, false),
          child: const Icon(Icons.thumb_down_outlined, size: 16, color: Color(Config.text3)),
        ),
      ]),
    );
  }
}

class _Thinking extends StatelessWidget {
  const _Thinking();
  @override
  Widget build(BuildContext context) {
    return const Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: EdgeInsets.all(12),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent))),
          SizedBox(width: 10),
          Text('thinking…', style: TextStyle(color: Color(Config.text2))),
        ]),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'api.dart';
import 'config.dart';

/// AI advisor chat — Wingman (men) or Bestie (women). Stateless server turn:
/// each send posts the running history to /ai-wingman|ai-bestie/chat.
class AdvisorScreen extends StatefulWidget {
  final bool wingman;
  const AdvisorScreen({super.key, required this.wingman});

  @override
  State<AdvisorScreen> createState() => _AdvisorScreenState();
}

class _AdvisorScreenState extends State<AdvisorScreen> {
  final _composer = TextEditingController();
  final _scroll = ScrollController();
  final List<Map<String, String>> _turns = []; // {role: user|assistant, content}
  bool _thinking = false;

  String get _name => widget.wingman ? 'AI Wingman' : 'AI Bestie';

  Future<void> _send() async {
    final text = _composer.text.trim();
    if (text.isEmpty || _thinking) return;
    _composer.clear();
    setState(() {
      _turns.add({'role': 'user', 'content': text});
      _thinking = true;
    });
    _scrollToBottom();
    try {
      // History is everything before this turn.
      final history = _turns.sublist(0, _turns.length - 1);
      final reply = await askAdvisor(wingman: widget.wingman, message: text, history: history);
      setState(() {
        _turns.add({'role': 'assistant', 'content': reply});
        _thinking = false;
      });
    } catch (e) {
      setState(() {
        _turns.add({'role': 'assistant', 'content': '⚠️ Could not reach $_name: $e'});
        _thinking = false;
      });
    }
    _scrollToBottom();
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
          Text(widget.wingman ? '🛡️ ' : '💚 ', style: const TextStyle(fontSize: 18)),
          Text(_name, style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
        ]),
      ),
      body: Column(children: [
        Expanded(
          child: _turns.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Text(
                      widget.wingman
                          ? 'Your Wingman reads your matches and helps you make the right move. Ask anything.'
                          : 'Your Bestie has your back — match reads, tips, and drafts. Ask anything.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Color(Config.text2), fontSize: 15, height: 1.4),
                    ),
                  ),
                )
              : ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.all(12),
                  itemCount: _turns.length + (_thinking ? 1 : 0),
                  itemBuilder: (context, i) {
                    if (i >= _turns.length) return const _Thinking();
                    final t = _turns[i];
                    return _AdvisorBubble(text: t['content'] ?? '', mine: t['role'] == 'user');
                  },
                ),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
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
        ),
      ]),
    );
  }
}

class _AdvisorBubble extends StatelessWidget {
  final String text;
  final bool mine;
  const _AdvisorBubble({required this.text, required this.mine});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
        decoration: BoxDecoration(
          color: mine ? const Color(Config.accent) : const Color(Config.bg3),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(text,
            style: TextStyle(
                color: mine ? const Color(0xFF052819) : const Color(Config.text1),
                fontSize: 15, height: 1.35)),
      ),
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

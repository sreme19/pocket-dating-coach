import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import 'api.dart';
import 'app_logger.dart';
import 'archetypes.dart';
import 'config.dart';

// ── Photo manager ────────────────────────────────────────────────────────────

/// Open the photo manager; returns after the user is done (caller refreshes).
Future<void> openPhotoManager(BuildContext context, ProfileData data, VoidCallback onChanged) async {
  final changed = await Navigator.of(context).push<bool>(
    MaterialPageRoute(builder: (_) => _PhotoManagerScreen(initial: data.uploadedPhotos, gender: data.gender)),
  );
  if (changed == true) onChanged();
}

class _PhotoManagerScreen extends StatefulWidget {
  final List<PhotoItem> initial;
  final String? gender;
  const _PhotoManagerScreen({required this.initial, required this.gender});
  @override
  State<_PhotoManagerScreen> createState() => _PhotoManagerScreenState();
}

class _PhotoManagerScreenState extends State<_PhotoManagerScreen> {
  late final List<PhotoItem> _photos = List.of(widget.initial);
  final _picker = ImagePicker();
  bool _busy = false;
  bool _dirty = false;
  String? _error;

  // Gender photo model: men get up to 3 (shown AI-enhanced), women up to 6 (real).
  bool get _isMan => widget.gender == 'man';
  int get _maxPhotos => _isMan ? 3 : 6;
  bool get _atCap => _photos.length >= _maxPhotos;

  Future<void> _add(ImageSource source) async {
    if (_busy || _atCap) return;
    setState(() { _busy = true; _error = null; });
    try {
      final x = await _picker.pickImage(source: source, maxWidth: 1800, imageQuality: 85);
      if (x == null) { setState(() => _busy = false); return; }
      final bytes = await x.readAsBytes();
      final ext = x.path.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
      final dataUrl = 'data:image/$ext;base64,${base64Encode(bytes)}';
      final label = _photos.isEmpty ? 'lead' : 'photo-${_photos.length}';
      final url = await uploadPhoto(dataUrl, label);
      setState(() { _photos.add(PhotoItem(url, label)); _dirty = true; _busy = false; });
    } catch (e) {
      AppLogger.instance.error(e, screen: 'profile_edit', action: 'upload_photo');
      setState(() { _busy = false; _error = 'Upload failed: $e'; });
    }
  }

  void _remove(int i) => setState(() { _photos.removeAt(i); _dirty = true; });

  void _makeLead(int i) => setState(() {
        final p = _photos.removeAt(i);
        _photos.insert(0, PhotoItem(p.url, 'lead'));
        _dirty = true;
      });

  Future<void> _save() async {
    setState(() { _busy = true; _error = null; });
    try {
      await savePhotos(_photos);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      AppLogger.instance.error(e, screen: 'profile_edit', action: 'save_photos');
      setState(() { _busy = false; _error = 'Save failed: $e'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        title: const Text('Manage photos', style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
        actions: [
          if (_dirty)
            TextButton(
              onPressed: _busy ? null : _save,
              child: const Text('Save', style: TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w700)),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            _isMan
                ? 'Up to 3 photos. Viewers only ever see an AI-enhanced version — your raw photo is never shown to anyone. First photo is your lead; long-press another to make it lead.'
                : 'Up to 6 real photos — no AI filters, authenticity is the point. First photo is your lead; long-press another to make it lead.',
            style: const TextStyle(color: Color(Config.text2), fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 8),
          Text(
            '${_photos.length}/$_maxPhotos photos${_atCap ? ' · maximum reached' : ''}',
            style: TextStyle(
              color: _atCap ? const Color(Config.accent) : const Color(Config.text3),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 14),
          GridView.count(
            crossAxisCount: 3,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              for (var i = 0; i < _photos.length; i++) _tile(i),
              if (!_atCap) _addTile(),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 13)),
          ],
          if (_busy) ...[
            const SizedBox(height: 16),
            const Center(child: CircularProgressIndicator(color: Color(Config.accent))),
          ],
        ],
      ),
    );
  }

  Widget _tile(int i) {
    return GestureDetector(
      onLongPress: i == 0 ? null : () => _makeLead(i),
      child: Stack(
        fit: StackFit.expand,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: CachedNetworkImage(
              imageUrl: _photos[i].url,
              fit: BoxFit.cover,
              placeholder: (c, _) => const ColoredBox(
                color: Color(Config.bg3),
                child: Center(
                  child: SizedBox(
                    width: 18, height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent)),
                  ),
                ),
              ),
              errorWidget: (c, _, _) => const ColoredBox(
                color: Color(Config.bg3),
                child: Center(
                  child: Icon(Icons.broken_image_outlined, color: Color(Config.text3), size: 22),
                ),
              ),
            ),
          ),
          if (i == 0)
            Positioned(
              left: 6, bottom: 6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xCCFF3B6B), borderRadius: BorderRadius.circular(999)),
                child: const Text('LEAD', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFFFFFFFF))),
              ),
            ),
          Positioned(
            right: 4, top: 4,
            child: GestureDetector(
              onTap: () => _remove(i),
              child: Container(
                padding: const EdgeInsets.all(3),
                decoration: const BoxDecoration(color: Color(0xCC000000), shape: BoxShape.circle),
                child: const Icon(Icons.close, size: 16, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _addTile() {
    return GestureDetector(
      onTap: _busy ? null : () => _pickSource(),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(Config.bg3),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0x331B1020)),
        ),
        child: const Center(child: Icon(Icons.add_a_photo_outlined, color: Color(Config.text2))),
      ),
    );
  }

  void _pickSource() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(Config.bg2),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.photo_library_outlined, color: Color(Config.text1)),
            title: const Text('Choose from library', style: TextStyle(color: Color(Config.text1))),
            onTap: () { Navigator.pop(ctx); _add(ImageSource.gallery); },
          ),
          ListTile(
            leading: const Icon(Icons.camera_alt_outlined, color: Color(Config.text1)),
            title: const Text('Take a photo', style: TextStyle(color: Color(Config.text1))),
            onTap: () { Navigator.pop(ctx); _add(ImageSource.camera); },
          ),
        ]),
      ),
    );
  }
}

// ── Archetype picker ─────────────────────────────────────────────────────────

Future<void> editArchetype(BuildContext context, ProfileData data, VoidCallback onChanged) async {
  final gender = data.gender == 'woman' ? 'woman' : 'man';
  final sections = laneSectionsFor(gender);
  final picked = await showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(Config.bg2),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.9,
      builder: (ctx, scroll) => ListView(
        controller: scroll,
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
        children: [
          const Text('Change your dating style',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(Config.text1))),
          const SizedBox(height: 12),
          for (final sec in sections) ...[
            Padding(
              padding: const EdgeInsets.only(top: 10, bottom: 6),
              child: Text(sec.label.toUpperCase(),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: Color(Config.text3))),
            ),
            for (final a in sec.archetypes)
              _ArchetypeRow(a: a, selected: a.id == data.archetype, onTap: () => Navigator.pop(ctx, a.id)),
          ],
        ],
      ),
    ),
  );
  if (picked == null || picked == data.archetype) return;
  try {
    await saveArchetype(picked);
    onChanged();
  } catch (e) {
    AppLogger.instance.error(e, screen: 'profile_edit', action: 'save_archetype');
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Couldn’t update: $e")));
    }
  }
}

class _ArchetypeRow extends StatelessWidget {
  final Archetype a;
  final bool selected;
  final VoidCallback onTap;
  const _ArchetypeRow({required this.a, required this.selected, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? const Color(0x22FF3B6B) : const Color(Config.bg3),
          borderRadius: BorderRadius.circular(12),
          border: selected ? Border.all(color: const Color(0x4DFF3B6B)) : null,
        ),
        child: Row(children: [
          Text(a.emoji, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(a.name, style: TextStyle(fontWeight: FontWeight.w700,
                  color: selected ? const Color(Config.accent) : const Color(Config.text1))),
              const SizedBox(height: 2),
              Text(a.tag, style: const TextStyle(fontSize: 12, color: Color(Config.text2))),
            ]),
          ),
          if (selected) const Icon(Icons.check_circle, color: Color(Config.accent), size: 20),
        ]),
      ),
    );
  }
}

// ── Hard-nos editor ──────────────────────────────────────────────────────────

Future<void> editHardNos(BuildContext context, ProfileData data, VoidCallback onChanged) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(Config.bg2),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) => _HardNosEditor(initial: data.hardNos, onChanged: onChanged),
  );
}

class _HardNosEditor extends StatefulWidget {
  final List<String> initial;
  final VoidCallback onChanged;
  const _HardNosEditor({required this.initial, required this.onChanged});
  @override
  State<_HardNosEditor> createState() => _HardNosEditorState();
}

class _HardNosEditorState extends State<_HardNosEditor> {
  late final List<String> _items = List.of(widget.initial);
  final _ctrl = TextEditingController();
  bool _adding = false;
  bool _saving = false;
  String? _error;

  Future<void> _add() async {
    final raw = _ctrl.text.trim();
    if (raw.isEmpty || _adding) return;
    setState(() => _adding = true);
    final cleaned = await cleanupText(raw);
    setState(() {
      if (!_items.contains(cleaned)) _items.add(cleaned);
      _ctrl.clear();
      _adding = false;
    });
  }

  Future<void> _save() async {
    setState(() { _saving = true; _error = null; });
    try {
      await saveHardNos(_items);
      if (mounted) Navigator.of(context).pop();
      widget.onChanged();
    } catch (e) {
      AppLogger.instance.error(e, screen: 'profile_edit', action: 'save_hard_nos');
      setState(() { _saving = false; _error = 'Save failed: $e'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 18, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Hard nos', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(Config.text1))),
          const SizedBox(height: 4),
          const Text('Your dealbreakers. We tidy the wording for you.',
              style: TextStyle(fontSize: 13, color: Color(Config.text2))),
          const SizedBox(height: 14),
          if (_items.isNotEmpty)
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (var i = 0; i < _items.length; i++)
                Chip(
                  backgroundColor: const Color(Config.bg3),
                  label: Text(_items[i], style: const TextStyle(color: Color(Config.text1))),
                  deleteIcon: const Icon(Icons.close, size: 16, color: Color(Config.text2)),
                  onDeleted: () => setState(() => _items.removeAt(i)),
                ),
            ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: TextField(
                controller: _ctrl,
                style: const TextStyle(color: Color(Config.text1)),
                textCapitalization: TextCapitalization.sentences,
                onSubmitted: (_) => _add(),
                decoration: InputDecoration(
                  hintText: 'e.g. dishonesty',
                  hintStyle: const TextStyle(color: Color(Config.text3)),
                  filled: true,
                  fillColor: const Color(Config.bg3),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              onPressed: _adding ? null : _add,
              icon: _adding
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Color(Config.accent)))
                  : const Icon(Icons.add_circle, color: Color(Config.accent)),
            ),
          ]),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 13)),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity, height: 50,
            child: FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(Config.accent),
                foregroundColor: const Color(0xFFFFFFFF),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _saving
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFFFFFF)))
                  : const Text('Save', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }
}

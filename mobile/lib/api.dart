import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config.dart';

/// The user's profile, assembled from the same two sources the web app uses:
///  1. `verified_vibe_users` row (identity, avatar_url, trust) — direct Supabase.
///  2. `/api/verified-vibe/master-profile` (about, photos, proofs) — Vercel API
///     with a Bearer token. (Native HTTP ignores CORS, so no preflight needed.)
class ProfileData {
  final String name;
  final int? age;
  final String? city;
  final String? heroPhotoUrl;
  final int trustScore;
  final int proofsCount;
  final String about;
  final bool profileComplete;

  ProfileData({
    required this.name,
    required this.age,
    required this.city,
    required this.heroPhotoUrl,
    required this.trustScore,
    required this.proofsCount,
    required this.about,
    required this.profileComplete,
  });
}

final _dio = Dio(BaseOptions(
  connectTimeout: const Duration(seconds: 15),
  receiveTimeout: const Duration(seconds: 20),
));

int _asInt(dynamic v) => v is num ? v.toInt() : (int.tryParse('$v') ?? 0);

Future<ProfileData> fetchProfile() async {
  final supabase = Supabase.instance.client;
  final user = supabase.auth.currentUser;
  final session = supabase.auth.currentSession;
  if (user == null || session == null) {
    throw StateError('Not authenticated');
  }

  // 1. Identity + avatar + trust — direct Supabase (RLS lets a user read self).
  final row = await supabase
      .from('verified_vibe_users')
      .select('first_name, age, city, avatar_url, trust_score, gender, archetype')
      .eq('id', user.id)
      .maybeSingle();

  // 2. Master profile — remote API with Bearer token.
  Map<String, dynamic> master = {};
  try {
    final resp = await _dio.get(
      '${Config.apiBase}/api/verified-vibe/master-profile',
      options: Options(headers: {'Authorization': 'Bearer ${session.accessToken}'}),
    );
    if (resp.data is Map) master = Map<String, dynamic>.from(resp.data as Map);
  } catch (_) {
    // Non-fatal — fall back to whatever the users row gives us.
  }

  final photos = (master['photos'] as List?) ?? const [];
  final aiPhotos = (master['aiPhotos'] as List?) ?? const [];
  final generated = master['generatedProfile'] as Map?;
  final draft = master['profileDraft'] as Map?;
  final proofs = (master['proofInsightsLocalStorage'] as List?) ?? const [];

  // Hero photo resolution mirrors the web heroPhoto derived:
  // ai photo → uploaded photo → users.avatar_url.
  String? hero;
  if (aiPhotos.isNotEmpty && aiPhotos.first is Map) {
    hero = (aiPhotos.first as Map)['url'] as String?;
  }
  if (hero == null && photos.isNotEmpty && photos.first is Map) {
    hero = (photos.first as Map)['dataUrl'] as String?;
  }
  hero ??= row?['avatar_url'] as String?;

  final name = (row?['first_name'] ?? draft?['firstName'] ?? 'You').toString();
  final age = row?['age'] != null ? _asInt(row!['age']) : (draft?['age'] != null ? _asInt(draft!['age']) : null);
  final city = (row?['city'] ?? draft?['city'])?.toString();
  final about = (generated?['about'] ?? '').toString();
  final trust = row?['trust_score'] != null ? _asInt(row!['trust_score']) : 0;

  return ProfileData(
    name: name,
    age: (age != null && age > 0) ? age : null,
    city: (city != null && city.isNotEmpty) ? city : null,
    heroPhotoUrl: hero,
    trustScore: trust,
    proofsCount: proofs.length,
    about: about,
    profileComplete: draft != null || generated != null,
  );
}

/// A match card in the Discover feed (from /api/verified-vibe/discovery-feed,
/// `data.profiles[]`). Native HTTP, Bearer auth.
class DiscoveryProfile {
  final String id;
  final String firstName;
  final int? age;
  final String? city;
  final String? avatar;
  final int trustScore;
  final String archetypeLabel;
  final String? intent;
  final String? distance;
  final int verifiedCount;

  DiscoveryProfile({
    required this.id,
    required this.firstName,
    required this.age,
    required this.city,
    required this.avatar,
    required this.trustScore,
    required this.archetypeLabel,
    required this.intent,
    required this.distance,
    required this.verifiedCount,
  });

  String get trustLabel {
    if (trustScore >= 80) return 'High Trust';
    if (trustScore >= 60) return 'Trusted';
    if (trustScore >= 40) return 'Building Trust';
    return 'New here';
  }

  /// Turn a raw archetype code into a label, e.g.
  /// `hopeless_romantic_woman` → `Hopeless-Romantic`.
  static String prettyArchetype(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    final stripped = raw.replaceAll(RegExp(r'_(man|woman)$'), '');
    final parts = stripped
        .split('_')
        .where((p) => p.isNotEmpty)
        .map((p) => p[0].toUpperCase() + p.substring(1));
    return parts.join('-');
  }
}

Future<List<DiscoveryProfile>> fetchDiscovery({int limit = 12}) async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) throw StateError('Not authenticated');

  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/discovery-feed',
    queryParameters: {'limit': limit, 'sortBy': 'trustScore'},
    options: Options(headers: {'Authorization': 'Bearer ${session.accessToken}'}),
  );

  final body = resp.data is Map ? resp.data as Map : const {};
  final data = body['data'] is Map ? body['data'] as Map : const {};
  final profiles = (data['profiles'] as List?) ?? const [];

  return profiles.whereType<Map>().map((p) {
    return DiscoveryProfile(
      id: '${p['id']}',
      firstName: (p['firstName'] ?? p['first_name'] ?? '—').toString(),
      age: p['age'] is num ? (p['age'] as num).toInt() : null,
      city: (p['city'] as String?)?.trim().isNotEmpty == true ? p['city'] as String : null,
      avatar: p['avatar'] as String?,
      trustScore: p['trustScore'] is num ? (p['trustScore'] as num).toInt() : 0,
      archetypeLabel: DiscoveryProfile.prettyArchetype(p['archetype'] as String?),
      intent: (p['looking'] ?? p['hereFor']) as String?,
      distance: p['distance'] as String?,
      verifiedCount: (p['verified'] as List?)?.length ?? 0,
    );
  }).toList();
}

// ── Chat ────────────────────────────────────────────────────────────────────

String _bearer() {
  final s = Supabase.instance.client.auth.currentSession;
  if (s == null) throw StateError('Not authenticated');
  return 'Bearer ${s.accessToken}';
}

/// A conversation row (from /api/verified-vibe/chat/conversations). The
/// conversation id == match id (verified_vibe_matches.id).
class Conversation {
  final String id;
  final String name;
  final int? age;
  final String? avatar;
  final String lastMessage;
  final DateTime? lastMessageTime;
  final int unreadCount;
  final bool hasMessages;

  Conversation({
    required this.id,
    required this.name,
    required this.age,
    required this.avatar,
    required this.lastMessage,
    required this.lastMessageTime,
    required this.unreadCount,
    required this.hasMessages,
  });
}

DateTime? _dt(dynamic v) => v == null ? null : DateTime.tryParse(v.toString());

Future<List<Conversation>> fetchConversations() async {
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/chat/conversations',
    options: Options(headers: {'Authorization': _bearer()}),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final data = body['data'] is Map ? body['data'] as Map : const {};
  final convos = (data['conversations'] as List?) ?? const [];
  return convos.whereType<Map>().map((c) {
    final u = (c['matchedUser'] as Map?) ?? const {};
    return Conversation(
      id: (c['id'] ?? c['matchId']).toString(),
      name: (u['firstName'] ?? '—').toString(),
      age: u['age'] is num ? (u['age'] as num).toInt() : null,
      avatar: u['avatar'] as String?,
      lastMessage: (c['lastMessage'] ?? '').toString(),
      lastMessageTime: _dt(c['lastMessageTime']),
      unreadCount: c['unreadCount'] is num ? (c['unreadCount'] as num).toInt() : 0,
      hasMessages: c['hasMessages'] == true,
    );
  }).toList();
}

class ChatMessage {
  final String id;
  final String senderId;
  final String content;
  final bool isAi;
  final String? aiSignal;
  final DateTime? createdAt;

  ChatMessage({
    required this.id,
    required this.senderId,
    required this.content,
    required this.isAi,
    required this.aiSignal,
    required this.createdAt,
  });

  factory ChatMessage.fromApi(Map m) => ChatMessage(
        id: (m['id'] ?? '').toString(),
        senderId: (m['senderId'] ?? m['sender_id'] ?? '').toString(),
        content: (m['content'] ?? '').toString(),
        isAi: (m['isAi'] ?? m['is_ai']) == true,
        aiSignal: (m['aiSignal'] ?? m['ai_signal']) as String?,
        createdAt: _dt(m['createdAt'] ?? m['created_at']),
      );
}

class ConversationThread {
  final String otherName;
  final String? otherAvatar;
  final List<ChatMessage> messages;
  ConversationThread({required this.otherName, required this.otherAvatar, required this.messages});
}

Future<ConversationThread> fetchConversation(String conversationId) async {
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/chat/$conversationId',
    options: Options(headers: {'Authorization': _bearer()}),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final data = body['data'] is Map ? body['data'] as Map : const {};
  final u = (data['matchedUser'] as Map?) ?? const {};
  final msgs = (data['messages'] as List?) ?? const [];
  return ConversationThread(
    otherName: (u['firstName'] ?? 'Chat').toString(),
    otherAvatar: u['avatar'] as String?,
    messages: msgs.whereType<Map>().map(ChatMessage.fromApi).toList(),
  );
}

Future<ChatMessage?> sendMessage(String conversationId, String content) async {
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/chat/send',
    data: {'conversationId': conversationId, 'content': content},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final data = body['data'] is Map ? body['data'] as Map : const {};
  final m = data['message'] as Map?;
  return m == null ? null : ChatMessage.fromApi(m);
}

/// Current user's gender ('man' / 'woman') — gates the AI Wingman vs Bestie row.
Future<String?> fetchCurrentUserGender() async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) return null;
  final row = await Supabase.instance.client
      .from('verified_vibe_users')
      .select('gender, archetype')
      .eq('id', uid)
      .maybeSingle();
  final g = row?['gender'] as String?;
  if (g != null && g.isNotEmpty) return g;
  final a = row?['archetype'] as String?;
  if (a != null && a.endsWith('_man')) return 'man';
  if (a != null && a.endsWith('_woman')) return 'woman';
  return null;
}

// ── Like / Pass ─────────────────────────────────────────────────────────────

/// Returns true if the like created a mutual match.
Future<bool> likeProfile(String profileId) async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) throw StateError('Not authenticated');
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/like',
    data: {'profileId': profileId, 'userId': uid},
    options: Options(headers: {'Content-Type': 'application/json'}),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final data = body['data'] is Map ? body['data'] as Map : body;
  return data['matched'] == true || data['isMatch'] == true || data['mutual'] == true;
}

Future<void> passProfile(String profileId) async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) throw StateError('Not authenticated');
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/pass',
    data: {'profileId': profileId, 'userId': uid},
    options: Options(headers: {'Content-Type': 'application/json'}),
  );
}

// ── Match detail (rich public profile) ─────────────────────────────────────

class MatchDetail {
  final String name;
  final int? age;
  final String? city;
  final String? avatar;
  final int trustScore;
  final String archetypeLabel;
  final String archetypeEmoji;
  final String? hereFor;
  final String? about;
  final List<String> vibeWords;
  final List<({String emoji, String text})> whatBrings;
  final List<String> travel;

  MatchDetail({
    required this.name,
    required this.age,
    required this.city,
    required this.avatar,
    required this.trustScore,
    required this.archetypeLabel,
    required this.archetypeEmoji,
    required this.hereFor,
    required this.about,
    required this.vibeWords,
    required this.whatBrings,
    required this.travel,
  });
}

Future<MatchDetail> fetchMatchDetail(String profileId) async {
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/public-profile/$profileId',
    options: Options(headers: {'Authorization': _bearer()}),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final d = (body['data'] is Map ? body['data'] as Map : const {});
  final brings = (d['whatBrings'] as List?) ?? const [];
  return MatchDetail(
    name: (d['firstName'] ?? '—').toString(),
    age: d['age'] is num ? (d['age'] as num).toInt() : null,
    city: d['city'] as String?,
    avatar: d['avatar'] as String?,
    trustScore: d['trustScore'] is num ? (d['trustScore'] as num).toInt() : 0,
    archetypeLabel: (d['archetypeName'] ?? DiscoveryProfile.prettyArchetype(d['archetype'] as String?)).toString(),
    archetypeEmoji: (d['archetypeEmoji'] ?? '✨').toString(),
    hereFor: d['hereFor'] as String?,
    about: d['about'] as String?,
    vibeWords: ((d['vibeWords'] as List?) ?? const []).map((e) => e.toString()).toList(),
    whatBrings: brings.whereType<Map>().map((b) => (emoji: (b['emoji'] ?? '•').toString(), text: (b['text'] ?? '').toString())).toList(),
    travel: ((d['travelLocations'] as List?) ?? const []).map((e) => e.toString()).toList(),
  );
}

/// AI advisor turn (Wingman for men, Bestie for women). userId in body; no
/// Bearer required by the endpoint. Returns the assistant's reply text.
Future<String> askAdvisor({
  required bool wingman,
  required String message,
  required List<Map<String, String>> history,
}) async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) throw StateError('Not authenticated');
  final path = wingman ? 'ai-wingman' : 'ai-bestie';
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/$path/chat',
    data: {'userId': uid, 'message': message, 'intent': 'chat', 'history': history},
    options: Options(
      headers: {'Content-Type': 'application/json'},
      receiveTimeout: const Duration(seconds: 60),
    ),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  return (body['reply'] ?? body['error'] ?? '…').toString();
}

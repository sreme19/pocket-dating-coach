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

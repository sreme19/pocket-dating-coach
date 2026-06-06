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

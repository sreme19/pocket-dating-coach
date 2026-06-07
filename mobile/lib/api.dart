import 'dart:io' show Platform;
import 'package:dio/dio.dart';
// hide MultipartFile: both dio and http (via supabase) export it; we use dio's.
import 'package:supabase_flutter/supabase_flutter.dart' hide MultipartFile;
import 'config.dart';

/// The user's profile, assembled from the same two sources the web app uses:
///  1. `verified_vibe_users` row (identity, avatar_url, trust) — direct Supabase.
///  2. `/api/verified-vibe/master-profile` (about, photos, proofs) — Vercel API
///     with a Bearer token. (Native HTTP ignores CORS, so no preflight needed.)
/// An AI-read insight chip (emoji + label) within a verified-signal group.
class InsightChip {
  final String emoji;
  final String label;
  InsightChip(this.emoji, this.label);
}

/// A group of verified-signal chips for one category, with the AI summary line.
class SignalGroup {
  final List<InsightChip> chips;
  final String aggregated;
  SignalGroup(this.chips, this.aggregated);
  bool get isNotEmpty => chips.isNotEmpty;
}

/// A car in the user's garage (parsed from the `assets` proof category).
class GarageCar {
  final String make;
  final String model;
  final String? year;
  final String? color;
  GarageCar({required this.make, required this.model, this.year, this.color});
  String get title => [make, model].where((s) => s.isNotEmpty).join(' ');
}

/// A spending category row (parsed from the `spending` proof breakdown).
class SpendItem {
  final String emoji;
  final String category;
  final String amountLabel;
  SpendItem(this.emoji, this.category, this.amountLabel);
}

/// An uploaded profile photo (url + slot label) — the editable photo list that
/// maps to master-profile `photos[]`.
class PhotoItem {
  final String url;
  final String label;
  PhotoItem(this.url, this.label);
}

class ProfileData {
  final String name;
  final int? age;
  final String? city;
  final String? heroPhotoUrl;
  final List<String> photos; // all displayable photo URLs (ai + uploaded)
  final List<PhotoItem> uploadedPhotos; // editable uploaded photos (url+label)
  final int trustScore;
  final int proofsCount;
  final String about;
  final bool profileComplete;
  final String? gender;
  final String archetype; // raw code, e.g. casual_generous_man
  final List<String> hardNos;
  final List<String> vibeWords;
  // Verified signals
  final SignalGroup? career; // linkedin
  final SignalGroup? lifestyle; // lifestyle
  final SignalGroup? health; // discipline
  final SignalGroup? social; // social_proof
  final SignalGroup? wealth; // wealth (Money Matters chips)
  // Money matters
  final String? annualIncome;
  final String? netWorth;
  final List<SpendItem> spending;
  // Garage + travel
  final List<GarageCar> garage;
  final List<String> countries;
  // AI portraits
  final String? personalityPortraitUrl;
  final String? garagePortraitUrl;
  // Raw generatedProfile map, kept so edits can merge without dropping fields.
  final Map<String, dynamic> rawGenerated;

  bool get isMan => gender == null || gender == 'man';

  ProfileData({
    required this.name,
    required this.age,
    required this.city,
    required this.heroPhotoUrl,
    required this.photos,
    required this.uploadedPhotos,
    required this.trustScore,
    required this.proofsCount,
    required this.about,
    required this.profileComplete,
    required this.gender,
    required this.archetype,
    required this.hardNos,
    required this.vibeWords,
    required this.career,
    required this.lifestyle,
    required this.health,
    required this.social,
    required this.wealth,
    required this.annualIncome,
    required this.netWorth,
    required this.spending,
    required this.garage,
    required this.countries,
    required this.personalityPortraitUrl,
    required this.garagePortraitUrl,
    required this.rawGenerated,
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
      .select('first_name, age, city, avatar_url, trust_score, gender, archetype, hard_nos')
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

  final photosRaw = (master['photos'] as List?) ?? const [];
  final aiPhotos = (master['aiPhotos'] as List?) ?? const [];
  final generated = master['generatedProfile'] as Map?;
  final draft = master['profileDraft'] as Map?;
  final proofs = (master['proofInsightsLocalStorage'] as List?) ?? const [];

  // All displayable photo URLs: AI photos first, then uploaded (http/data only).
  final photos = <String>[];
  final uploaded = <PhotoItem>[];
  for (final p in aiPhotos) {
    if (p is Map && p['url'] is String) photos.add(p['url'] as String);
  }
  for (final p in photosRaw) {
    if (p is Map && p['dataUrl'] is String) {
      final u = p['dataUrl'] as String;
      if (u.startsWith('http') || u.startsWith('data:')) {
        photos.add(u);
        uploaded.add(PhotoItem(u, (p['label'] ?? 'photo').toString()));
      }
    }
  }
  String? hero = photos.isNotEmpty ? photos.first : null;
  hero ??= row?['avatar_url'] as String?;

  final name = (row?['first_name'] ?? draft?['firstName'] ?? 'You').toString();
  final age = row?['age'] != null ? _asInt(row!['age']) : (draft?['age'] != null ? _asInt(draft!['age']) : null);
  final city = (row?['city'] ?? draft?['city'])?.toString();
  final about = (generated?['about'] ?? '').toString();
  final trust = row?['trust_score'] != null ? _asInt(row!['trust_score']) : 0;
  final gender = row?['gender']?.toString();
  final archetype = (row?['archetype'] ?? '').toString();
  final hardNos = <String>[];
  if (row?['hard_nos'] is List) {
    for (final h in (row!['hard_nos'] as List)) {
      final s = '$h'.trim();
      if (s.isNotEmpty) hardNos.add(s);
    }
  }

  // Vibe words from the AI-generated personality descriptors.
  final vibeWords = <String>[];
  final descs = generated?['personalityDescriptors'];
  if (descs is List) {
    for (final d in descs) {
      if (d != null && '$d'.trim().isNotEmpty) vibeWords.add('$d'.trim());
    }
  }

  // Group proof insights by category.
  Map<String, dynamic>? proofFor(String cat) {
    for (final p in proofs) {
      if (p is Map && p['category'] == cat) return Map<String, dynamic>.from(p);
    }
    return null;
  }

  SignalGroup? signal(String cat) {
    final p = proofFor(cat);
    if (p == null) return null;
    final chips = <InsightChip>[];
    final ins = p['insights'];
    if (ins is List) {
      for (final i in ins) {
        if (i is Map) {
          chips.add(InsightChip((i['emoji'] ?? '•').toString(), (i['label'] ?? '').toString()));
        }
      }
    }
    if (chips.isEmpty) return null;
    return SignalGroup(chips, (p['aggregated'] ?? '').toString());
  }

  // Garage cars from the `assets` proof.
  final garage = <GarageCar>[];
  final assetsProof = proofFor('assets');
  if (assetsProof != null && assetsProof['assets'] is List) {
    for (final a in (assetsProof['assets'] as List)) {
      if (a is Map && (a['type'] == 'car' || a['make'] != null)) {
        garage.add(GarageCar(
          make: (a['make'] ?? '').toString(),
          model: (a['model'] ?? '').toString(),
          year: a['year']?.toString(),
          color: a['color']?.toString(),
        ));
      }
    }
  }

  // Spending breakdown from the `spending` proof.
  final spending = <SpendItem>[];
  final spendProof = proofFor('spending');
  if (spendProof != null && spendProof['spendingBreakdown'] is List) {
    for (final s in (spendProof['spendingBreakdown'] as List)) {
      if (s is Map) {
        spending.add(SpendItem(
          (s['emoji'] ?? '💳').toString(),
          (s['category'] ?? '').toString(),
          (s['amountLabel'] ?? '').toString(),
        ));
      }
    }
  }

  // Travel: explicit list + any locations embedded in proofs (deduped).
  final countries = <String>[];
  void addCountry(dynamic c) {
    final s = '$c'.trim();
    if (s.isNotEmpty && !countries.contains(s)) countries.add(s);
  }
  if (master['countriesTraveled'] is List) {
    for (final c in (master['countriesTraveled'] as List)) {
      addCountry(c);
    }
  }
  for (final p in proofs) {
    if (p is Map && p['locations'] is List) {
      for (final l in (p['locations'] as List)) {
        addCountry(l);
      }
    }
  }

  final money = master['moneyMatters'] as Map?;
  String? nonEmpty(dynamic v) {
    final s = v?.toString().trim();
    return (s != null && s.isNotEmpty) ? s : null;
  }

  return ProfileData(
    name: name,
    age: (age != null && age > 0) ? age : null,
    city: (city != null && city.isNotEmpty) ? city : null,
    heroPhotoUrl: hero,
    photos: photos,
    uploadedPhotos: uploaded,
    trustScore: trust,
    proofsCount: proofs.length,
    about: about,
    profileComplete: draft != null || generated != null,
    gender: gender,
    archetype: archetype,
    hardNos: hardNos,
    vibeWords: vibeWords,
    career: signal('linkedin'),
    lifestyle: signal('lifestyle'),
    health: signal('discipline'),
    social: signal('social_proof'),
    wealth: signal('wealth'),
    annualIncome: nonEmpty(money?['annualIncome']),
    netWorth: nonEmpty(money?['netWorth']),
    spending: spending,
    garage: garage,
    countries: countries,
    personalityPortraitUrl: nonEmpty(master['personalityPortraitUrl']),
    garagePortraitUrl: nonEmpty(master['garagePortraitUrl']),
    rawGenerated: generated != null ? Map<String, dynamic>.from(generated) : <String, dynamic>{},
  );
}

/// Save name / age / city to verified_vibe_users (the authoritative identity
/// row that discovery, matching, and chat all read). Mirrors the web hero edit.
Future<void> saveIdentity({required String firstName, int? age, String? city}) async {
  final supabase = Supabase.instance.client;
  final user = supabase.auth.currentUser;
  if (user == null) throw StateError('Not authenticated');
  final patch = <String, dynamic>{'first_name': firstName.trim()};
  if (age != null && age > 0) patch['age'] = age;
  if (city != null) patch['city'] = city.trim();
  await supabase.from('verified_vibe_users').update(patch).eq('id', user.id);
}

/// Save the About text. POST master-profile replaces generatedProfile wholesale,
/// so we merge `about` into the existing map to avoid dropping other fields.
Future<void> saveAbout(String about, Map<String, dynamic> existingGenerated) async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) throw StateError('Not authenticated');
  final merged = Map<String, dynamic>.from(existingGenerated)..['about'] = about.trim();
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/master-profile',
    data: {'generatedProfile': merged},
    options: Options(headers: {
      'Authorization': 'Bearer ${session.accessToken}',
      'Content-Type': 'application/json',
    }),
  );
}

String _bearerToken() {
  final s = Supabase.instance.client.auth.currentSession;
  if (s == null) throw StateError('Not authenticated');
  return 'Bearer ${s.accessToken}';
}

/// Upload a profile photo (base64 data URL) → returns the hosted URL. When
/// label == 'lead' the backend also sets verified_vibe_users.avatar_url.
Future<String> uploadPhoto(String dataUrl, String label) async {
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/upload-photo',
    data: {'dataUrl': dataUrl, 'label': label},
    options: Options(headers: {'Authorization': _bearerToken(), 'Content-Type': 'application/json'}),
  );
  final url = (resp.data is Map) ? resp.data['url'] : null;
  if (url is! String || url.isEmpty) throw 'Upload failed';
  return url;
}

/// Persist the full uploaded-photos list to master-profile (replaces photos[]),
/// and sync the lead (first) photo to verified_vibe_users.avatar_url so it shows
/// everywhere discovery/chat read the identity row.
Future<void> savePhotos(List<PhotoItem> photos) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/master-profile',
    data: {'photos': [for (final p in photos) {'dataUrl': p.url, 'label': p.label}]},
    options: Options(headers: {'Authorization': _bearerToken(), 'Content-Type': 'application/json'}),
  );
  final supabase = Supabase.instance.client;
  final user = supabase.auth.currentUser;
  if (user != null && photos.isNotEmpty) {
    await supabase.from('verified_vibe_users').update({'avatar_url': photos.first.url}).eq('id', user.id);
  }
}

/// Change the user's archetype (direct Supabase update — RLS allows self).
Future<void> saveArchetype(String archetype) async {
  final supabase = Supabase.instance.client;
  final user = supabase.auth.currentUser;
  if (user == null) throw StateError('Not authenticated');
  await supabase.from('verified_vibe_users').update({'archetype': archetype}).eq('id', user.id);
}

/// Persist hard-nos (dealbreakers) to verified_vibe_users.hard_nos.
Future<void> saveHardNos(List<String> hardNos) async {
  final supabase = Supabase.instance.client;
  final user = supabase.auth.currentUser;
  if (user == null) throw StateError('Not authenticated');
  await supabase.from('verified_vibe_users').update({'hard_nos': hardNos}).eq('id', user.id);
}

/// Ask the AI to suggest more insight chips for a proof category. Returns the
/// generated chips (may be empty if the AI asks to clarify / redirect).
Future<List<InsightChip>> suggestInsights(
    String category, List<String> existingLabels, String aggregated) async {
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/wingman',
    data: {
      'message':
          'Suggest 3 more insight chips from my $category documents. Existing labels to avoid: ${existingLabels.join(', ')}. Aggregated data: $aggregated',
      'profileSnapshot': {
        'proofInsights': [
          {'category': category, 'labels': existingLabels, 'aggregated': aggregated},
        ],
      },
    },
    options: Options(headers: {'Authorization': _bearerToken(), 'Content-Type': 'application/json'}),
  );
  final out = <InsightChip>[];
  if (resp.data is Map && resp.data['new_insights'] is List) {
    for (final i in (resp.data['new_insights'] as List)) {
      if (i is Map && i['label'] != null) {
        out.add(InsightChip((i['emoji'] ?? '•').toString(), i['label'].toString()));
      }
    }
  }
  return out;
}

/// Add an insight chip to a proof category (persists to verifiedProofs).
Future<void> addInsightChip(String category, String label, String emoji) =>
    _insightChip('add', category, label, emoji);

/// Remove an insight chip from a proof category.
Future<void> removeInsightChip(String category, String label) =>
    _insightChip('remove', category, label, null);

Future<void> _insightChip(String action, String category, String label, String? emoji) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/insight-chip',
    data: {'action': action, 'category': category, 'label': label, if (emoji != null) 'emoji': emoji},
    options: Options(headers: {'Authorization': _bearerToken(), 'Content-Type': 'application/json'}),
  );
}

/// Normalize a free-typed dealbreaker into a concise phrase (Claude haiku).
/// Falls back to the trimmed input on any error.
Future<String> cleanupText(String text) async {
  try {
    final resp = await _dio.post(
      '${Config.apiBase}/api/verified-vibe/cleanup-text',
      data: {'text': text},
      options: Options(headers: {'Authorization': _bearerToken(), 'Content-Type': 'application/json'}),
    );
    final c = (resp.data is Map) ? resp.data['cleaned'] : null;
    return (c is String && c.trim().isNotEmpty) ? c.trim() : text.trim();
  } catch (_) {
    return text.trim();
  }
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

// ── Push ──────────────────────────────────────────────────────────────────

/// Register an FCM device token for the signed-in user (backend sends via FCM).
Future<void> registerPushToken(String token) async {
  await _dio.post(
    '${Config.apiBase}/api/push/register',
    data: {'token': token, 'platform': Platform.isIOS ? 'ios' : 'android'},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
}

// ── Trust / Boost ───────────────────────────────────────────────────────────

class ProofItem {
  final String category;
  final String aggregated;
  final int points;
  ProofItem({required this.category, required this.aggregated, required this.points});
}

class TrustData {
  final int trustScore;
  final bool identityVerified;
  final List<ProofItem> proofs;
  TrustData({required this.trustScore, required this.identityVerified, required this.proofs});
  int get proofPoints => proofs.fold(0, (s, p) => s + p.points);
}

Future<TrustData> fetchTrust() async {
  final uid = Supabase.instance.client.auth.currentUser!.id;
  final session = Supabase.instance.client.auth.currentSession!;
  final row = await Supabase.instance.client
      .from('verified_vibe_users')
      .select('trust_score, identity_verified')
      .eq('id', uid)
      .maybeSingle();

  List<ProofItem> proofs = [];
  try {
    final resp = await _dio.get(
      '${Config.apiBase}/api/verified-vibe/master-profile',
      options: Options(headers: {'Authorization': 'Bearer ${session.accessToken}'}),
    );
    final body = resp.data is Map ? resp.data as Map : const {};
    final list = (body['proofInsightsLocalStorage'] as List?) ?? const [];
    proofs = list.whereType<Map>().map((p) {
      return ProofItem(
        category: (p['category'] ?? '').toString(),
        aggregated: (p['aggregated'] ?? p['insight_label'] ?? '').toString(),
        points: p['pts_awarded'] is num ? (p['pts_awarded'] as num).toInt() : 0,
      );
    }).toList();
  } catch (_) {}

  return TrustData(
    trustScore: row?['trust_score'] is num ? (row!['trust_score'] as num).toInt() : 0,
    identityVerified: row?['identity_verified'] == true,
    proofs: proofs,
  );
}

/// Upload a proof artifact (multipart) for a category → returns the API result
/// ({verified, insights, pts_awarded, aggregated, ...}).
Future<Map> uploadProof(String category, List<String> filePaths) async {
  final form = FormData();
  form.fields.add(MapEntry('category', category));
  for (final path in filePaths) {
    form.files.add(MapEntry('files', await MultipartFile.fromFile(path)));
  }
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/proof-upload',
    data: form,
    options: Options(headers: {'Authorization': _bearer()}, receiveTimeout: const Duration(seconds: 120)),
  );
  return resp.data is Map ? resp.data as Map : const {};
}

/// Verify a social proof by profile URL (linkedin / instagram / twitter) — the
/// backend auto-verifies a URL-only submission (no screenshot required).
Future<Map> uploadProofUrl(String category, String profileUrl) async {
  final form = FormData();
  form.fields.add(MapEntry('category', category));
  form.fields.add(MapEntry('profile_url', profileUrl));
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/proof-upload',
    data: form,
    options: Options(headers: {'Authorization': _bearer()}, receiveTimeout: const Duration(seconds: 120)),
  );
  return resp.data is Map ? resp.data as Map : const {};
}

/// Human-readable trust tier (mirrors getTrustScoreLabel in trustScore.ts).
String trustLabel(int score) {
  if (score <= 0) return 'Not Verified';
  if (score < 25) return 'Minimal Trust';
  if (score < 50) return 'Low Trust';
  if (score < 75) return 'Medium Trust';
  if (score < 100) return 'High Trust';
  return 'Fully Verified';
}

// ── Tip / Attention ─────────────────────────────────────────────────────────

Future<void> submitTip(String targetUserId, String submitterGender, List<String> tags, String? text) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/tips',
    data: {
      'targetUserId': targetUserId,
      'submitterGender': submitterGender,
      'tags': tags,
      if (text != null && text.isNotEmpty) 'text': text,
    },
    options: Options(headers: {'Content-Type': 'application/json'}),
  );
}

/// Send a secret-admirer / craving-attention note. messageType derived from the
/// sender's gender (man → craving_attention, woman → secret_admirer).
/// Throws 'already' if a note was already sent to this person (409).
Future<void> sendAttention(String recipientId, String senderGender, String content) async {
  final uid = Supabase.instance.client.auth.currentUser!.id;
  final messageType = senderGender == 'woman' ? 'secret_admirer' : 'craving_attention';
  try {
    await _dio.post(
      '${Config.apiBase}/api/verified-vibe/attention',
      data: {'senderId': uid, 'recipientId': recipientId, 'messageType': messageType, 'content': content},
      options: Options(headers: {'Content-Type': 'application/json'}),
    );
  } on DioException catch (e) {
    if (e.response?.statusCode == 409) throw 'already';
    rethrow;
  }
}

// ── Onboarding ──────────────────────────────────────────────────────────────

/// A signed-in user still needs onboarding if their verified_vibe_users row has
/// no archetype yet (brand-new sign-up). Defaults to false on error so we don't
/// trap existing users in onboarding.
Future<bool> needsOnboarding() async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) return false;
  try {
    final row = await Supabase.instance.client
        .from('verified_vibe_users')
        .select('archetype')
        .eq('id', uid)
        .maybeSingle();
    final a = row?['archetype'] as String?;
    return a == null || a.isEmpty;
  } catch (_) {
    return false;
  }
}

Future<void> saveGenderArchetype(String gender, String archetype) async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) throw StateError('Not authenticated');
  final supabase = Supabase.instance.client;
  // verified_vibe_users has NOT NULL first_name/age, so seed placeholders for a
  // brand-new row (verification's ID/photos steps overwrite name/age/city).
  // Preserve existing identity fields if the row already exists.
  final existing = await supabase
      .from('verified_vibe_users')
      .select('first_name, age, city')
      .eq('id', uid)
      .maybeSingle();
  await supabase.from('verified_vibe_users').upsert({
    'id': uid,
    'gender': gender,
    'archetype': archetype,
    'first_name': existing?['first_name'] ?? 'New member',
    'age': existing?['age'] ?? 18,
    'city': existing?['city'] ?? '',
  }, onConflict: 'id');
}

/// Submit a verification step (id | liveness | photos | spending_or_qa).
/// Images go as base64 inside `data` (matches the web verify-step endpoint).
Future<Map> verifyStep(String step, Map<String, dynamic> data) async {
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/verify-step',
    data: {'step': step, 'data': data},
    options: Options(
      headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'},
      receiveTimeout: const Duration(seconds: 90),
    ),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  return (body['data'] as Map?) ?? body;
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
  final String archetype; // raw code
  final String? gender;
  final int trustScore;

  Conversation({
    required this.id,
    required this.name,
    required this.age,
    required this.avatar,
    required this.lastMessage,
    required this.lastMessageTime,
    required this.unreadCount,
    required this.hasMessages,
    required this.archetype,
    required this.gender,
    required this.trustScore,
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
      archetype: (u['archetype'] ?? '').toString(),
      gender: u['gender'] as String?,
      trustScore: u['trustScore'] is num ? (u['trustScore'] as num).toInt() : 0,
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
  final String? otherId;
  final String otherName;
  final String? otherAvatar;
  final List<ChatMessage> messages;
  ConversationThread({required this.otherId, required this.otherName, required this.otherAvatar, required this.messages});
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
    otherId: u['id'] as String?,
    otherName: (u['firstName'] ?? 'Chat').toString(),
    otherAvatar: u['avatar'] as String?,
    messages: msgs.whereType<Map>().map(ChatMessage.fromApi).toList(),
  );
}

/// Block + unmatch a user (records a pass + removes the match). matchId optional.
Future<void> blockUser(String blockedUserId, {String? matchId}) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/block-user',
    data: {'blockedUserId': blockedUserId, if (matchId != null) 'matchId': matchId},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
}

/// A received secret-admirer / craving-attention message (inbox).
class Admirer {
  final String id;
  final String senderId;
  final String name;
  final int? age;
  final String? avatar;
  final String archetype;
  final String messageType; // secret_admirer | craving_attention
  final String content;
  final String? replyContent;
  final bool isRead;
  Admirer({
    required this.id,
    required this.senderId,
    required this.name,
    required this.age,
    required this.avatar,
    required this.archetype,
    required this.messageType,
    required this.content,
    required this.replyContent,
    required this.isRead,
  });
  bool get replied => replyContent != null && replyContent!.isNotEmpty;
}

/// Fetch received admirer messages for the signed-in user (marks them read).
Future<List<Admirer>> fetchAdmirers() async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) return [];
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/attention',
    queryParameters: {'recipientId': uid},
    options: Options(headers: {'Authorization': _bearer()}),
  );
  final msgs = (resp.data is Map ? resp.data['messages'] : null) as List? ?? const [];
  return msgs.whereType<Map>().map((m) => Admirer(
        id: (m['id'] ?? '').toString(),
        senderId: (m['senderId'] ?? '').toString(),
        name: (m['senderName'] ?? '—').toString(),
        age: m['senderAge'] is num ? (m['senderAge'] as num).toInt() : null,
        avatar: m['senderAvatar'] as String?,
        archetype: (m['senderArchetype'] ?? '').toString(),
        messageType: (m['messageType'] ?? 'secret_admirer').toString(),
        content: (m['content'] ?? '').toString(),
        replyContent: m['replyContent'] as String?,
        isRead: m['isRead'] == true,
      )).toList();
}

/// Reply to an admirer message — creates a mutual match + seeds the chat.
/// Returns the matchId of the (new or existing) conversation.
Future<String?> replyToAdmirer(String messageId, String replyContent) async {
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/attention/reply',
    data: {'messageId': messageId, 'replyContent': replyContent},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
  return (resp.data is Map ? resp.data['matchId'] : null) as String?;
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

/// A named, tabbable verified-signal group (Career/Lifestyle/Health/Social).
class NamedSignal {
  final String emoji;
  final String label;
  final SignalGroup group;
  NamedSignal(this.emoji, this.label, this.group);
}

/// A labelled group of archetype answer chips (e.g. "Energy in a relationship").
class ChipGroup {
  final String label;
  final List<String> chips;
  ChipGroup(this.label, this.chips);
}

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
  // Rich Public-Read sections
  final List<ChipGroup> archetypeChips;
  final List<NamedSignal> verifiedSignals;
  final List<GarageCar> garage;
  final String? annualIncome;
  final List<InsightChip> careerLines;
  final List<InsightChip> wealthInsights;
  final String? personalityPortraitUrl;
  final String? garagePortraitUrl;

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
    required this.archetypeChips,
    required this.verifiedSignals,
    required this.garage,
    required this.annualIncome,
    required this.careerLines,
    required this.wealthInsights,
    required this.personalityPortraitUrl,
    required this.garagePortraitUrl,
  });
}

List<InsightChip> _parseChips(dynamic list) {
  final out = <InsightChip>[];
  if (list is List) {
    for (final i in list) {
      if (i is Map && i['label'] != null) {
        out.add(InsightChip((i['emoji'] ?? '•').toString(), i['label'].toString()));
      }
    }
  }
  return out;
}

Future<MatchDetail> fetchMatchDetail(String profileId) async {
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/public-profile/$profileId',
    options: Options(headers: {'Authorization': _bearer()}),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final d = (body['data'] is Map ? body['data'] as Map : const {});
  final brings = (d['whatBrings'] as List?) ?? const [];

  // Archetype chip groups
  final archetypeChips = <ChipGroup>[];
  if (d['archetypeChips'] is List) {
    for (final g in (d['archetypeChips'] as List)) {
      if (g is Map && g['chips'] is List) {
        archetypeChips.add(ChipGroup(
          (g['label'] ?? '').toString(),
          (g['chips'] as List).map((c) => c.toString()).toList(),
        ));
      }
    }
  }

  // Verified signals (ready-made groups with label/icon/insights/aggregated)
  final signals = <NamedSignal>[];
  if (d['verifiedSignals'] is List) {
    for (final s in (d['verifiedSignals'] as List)) {
      if (s is Map) {
        final chips = _parseChips(s['insights']);
        if (chips.isNotEmpty) {
          signals.add(NamedSignal(
            (s['icon'] ?? '•').toString(),
            (s['label'] ?? '').toString(),
            SignalGroup(chips, (s['aggregated'] ?? '').toString()),
          ));
        }
      }
    }
  }

  // Garage cars
  final garage = <GarageCar>[];
  if (d['garageCars'] is List) {
    for (final a in (d['garageCars'] as List)) {
      if (a is Map && a['make'] != null) {
        garage.add(GarageCar(
          make: (a['make'] ?? '').toString(),
          model: (a['model'] ?? '').toString(),
          year: a['year']?.toString(),
          color: a['color']?.toString(),
        ));
      }
    }
  }

  final money = d['moneyMatters'] as Map?;
  String? incomeNonEmpty(dynamic v) {
    final s = v?.toString().trim();
    return (s != null && s.isNotEmpty) ? s : null;
  }

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
    archetypeChips: archetypeChips,
    verifiedSignals: signals,
    garage: garage,
    annualIncome: incomeNonEmpty(money?['annualIncome']),
    careerLines: _parseChips(money?['careerLines']),
    wealthInsights: _parseChips(money?['wealthInsights']),
    personalityPortraitUrl: incomeNonEmpty(d['personalityPortraitUrl']),
    garagePortraitUrl: incomeNonEmpty(d['garagePortraitUrl']),
  );
}

/// AI advisor turn (Wingman for men, Bestie for women). userId in body; no
/// Bearer required by the endpoint. Returns the assistant's reply text.
/// A Bestie-prepared draft message the user can send to a match.
class AdvisorDraft {
  final String matchName;
  final String matchId;
  final String content;
  AdvisorDraft(this.matchName, this.matchId, this.content);
}

class AdvisorReply {
  final String reply;
  final List<AdvisorDraft> drafts;
  AdvisorReply(this.reply, this.drafts);
}

/// One turn with the advisor. `intent` is 'chat' | 'summary' | 'insights'
/// (summary/insights send an empty message and let the server build the prompt).
Future<AdvisorReply> askAdvisor({
  required bool wingman,
  required String message,
  required List<Map<String, String>> history,
  String intent = 'chat',
}) async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) throw StateError('Not authenticated');
  final path = wingman ? 'ai-wingman' : 'ai-bestie';
  final resp = await _dio.post(
    '${Config.apiBase}/api/verified-vibe/$path/chat',
    data: {'userId': uid, 'message': message, 'intent': intent, 'history': history},
    options: Options(
      headers: {'Content-Type': 'application/json'},
      receiveTimeout: const Duration(seconds: 60),
    ),
  );
  final body = resp.data is Map ? resp.data as Map : const {};
  final drafts = <AdvisorDraft>[];
  if (body['drafts'] is List) {
    for (final d in (body['drafts'] as List)) {
      if (d is Map && d['content'] != null) {
        drafts.add(AdvisorDraft(
          (d['matchName'] ?? 'your match').toString(),
          (d['matchId'] ?? '').toString(),
          d['content'].toString(),
        ));
      }
    }
  }
  return AdvisorReply((body['reply'] ?? body['error'] ?? '…').toString(), drafts);
}

/// A "what-if" lever in the match-intelligence panel (trust/standing deltas).
class IntelLever {
  final String label;
  final num trustBefore;
  final num trustAfter;
  IntelLever(this.label, this.trustBefore, this.trustAfter);
}

/// One match's standing in the "Where you stand" panel.
class MatchIntel {
  final String partnerName;
  final num? appeal;
  final int? standingRank;
  final int? standingPool;
  final List<String> checklist;
  final List<IntelLever> simulation;
  MatchIntel({
    required this.partnerName,
    required this.appeal,
    required this.standingRank,
    required this.standingPool,
    required this.checklist,
    required this.simulation,
  });
}

/// Fetch the advisor "Where you stand" intelligence (userId-in-query, no bearer).
Future<List<MatchIntel>> fetchMatchIntelligence() async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) return [];
  final resp = await _dio.get(
    '${Config.apiBase}/api/verified-vibe/match-intelligence',
    queryParameters: {'userId': uid},
    options: Options(receiveTimeout: const Duration(seconds: 30)),
  );
  final matches = (resp.data is Map ? resp.data['matches'] : null) as List? ?? const [];
  return matches.whereType<Map>().map((m) {
    final sim = <IntelLever>[];
    if (m['simulation'] is List) {
      for (final s in (m['simulation'] as List)) {
        if (s is Map) {
          sim.add(IntelLever(
            (s['label'] ?? s['action'] ?? '').toString(),
            s['trustBefore'] is num ? s['trustBefore'] as num : 0,
            s['trustAfter'] is num ? s['trustAfter'] as num : 0,
          ));
        }
      }
    }
    return MatchIntel(
      partnerName: (m['partnerName'] ?? 'your match').toString(),
      appeal: m['appeal'] is num ? m['appeal'] as num : null,
      standingRank: m['standingRank'] is num ? (m['standingRank'] as num).toInt() : null,
      standingPool: m['standingPool'] is num ? (m['standingPool'] as num).toInt() : null,
      checklist: ((m['checklist'] as List?) ?? const []).map((e) => e.toString()).toList(),
      simulation: sim,
    );
  }).toList();
}

/// Proactive advisor greeting. Returns (id, content) or null if nothing new.
Future<({String id, String content})?> fetchGreeting() async {
  try {
    final resp = await _dio.post(
      '${Config.apiBase}/api/verified-vibe/ai-greeting',
      data: const {},
      options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'},
          receiveTimeout: const Duration(seconds: 60)),
    );
    final b = resp.data is Map ? resp.data as Map : const {};
    final content = (b['content'] ?? '').toString();
    final id = (b['greetingId'] ?? '').toString();
    if (content.isEmpty) return null;
    return (id: id, content: content);
  } catch (_) {
    return null; // non-fatal — advisor still works without a greeting
  }
}

/// Thumbs feedback on a greeting. rating: 1 (helpful) or -1 (not helpful).
Future<void> submitGreetingFeedback(String greetingId, int rating, {String? reasonChip}) async {
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/ai-feedback',
    data: {'greetingId': greetingId, 'rating': rating, if (reasonChip != null) 'reasonChip': reasonChip},
    options: Options(headers: {'Authorization': _bearer(), 'Content-Type': 'application/json'}),
  );
}

/// Thumbs feedback on an advisor message (userId-in-body, no bearer).
Future<void> submitMessageFeedback({
  required bool wingman,
  required String messageContent,
  required bool positive,
  String? reasonChip,
}) async {
  final uid = Supabase.instance.client.auth.currentUser?.id;
  if (uid == null) return;
  await _dio.post(
    '${Config.apiBase}/api/verified-vibe/ai-bestie/feedback',
    data: {
      'userId': uid,
      'assistantType': wingman ? 'wingman' : 'bestie',
      'feedbackType': positive ? 'positive' : 'negative',
      'messageContent': messageContent,
      if (reasonChip != null) 'reasonChip': reasonChip,
    },
    options: Options(headers: {'Content-Type': 'application/json'}),
  );
}

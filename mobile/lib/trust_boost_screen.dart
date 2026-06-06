import 'package:flutter/material.dart';
import 'api.dart';
import 'config.dart';
import 'proof_upload_screen.dart';

class TrustBoostScreen extends StatefulWidget {
  const TrustBoostScreen({super.key});

  @override
  State<TrustBoostScreen> createState() => _TrustBoostScreenState();
}

class _TrustBoostScreenState extends State<TrustBoostScreen> {
  late Future<TrustData> _future;

  @override
  void initState() {
    super.initState();
    _future = fetchTrust();
  }

  Future<void> _refresh() async {
    setState(() => _future = fetchTrust());
    await _future;
  }

  Future<void> _addProof() async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ProofUploadScreen()));
    _refresh(); // proofs/score may have changed
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(Config.bg1),
        elevation: 0,
        title: const Text('Trust & Boost', style: TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w700)),
      ),
      body: FutureBuilder<TrustData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: Color(Config.accent)));
          }
          if (snap.hasError || !snap.hasData) {
            return Center(child: Text('Could not load trust.\n${snap.error ?? ''}',
                textAlign: TextAlign.center, style: const TextStyle(color: Color(Config.text2))));
          }
          final d = snap.data!;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                _scoreCard(d),
                const SizedBox(height: 20),
                Row(children: [
                  const Text('YOUR PROOFS', style: TextStyle(color: Color(Config.text2), fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
                  const Spacer(),
                  Text('+${d.proofPoints} pts', style: const TextStyle(color: Color(Config.accent), fontSize: 12, fontWeight: FontWeight.w700)),
                ]),
                const SizedBox(height: 10),
                if (d.proofs.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Text('No proofs yet — add one below to boost your score.', style: TextStyle(color: Color(Config.text2))),
                  )
                else
                  ...d.proofs.map((p) => Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: const Color(Config.bg2), borderRadius: BorderRadius.circular(12)),
                        child: Row(children: [
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(_pretty(p.category), style: const TextStyle(color: Color(Config.text1), fontWeight: FontWeight.w600)),
                              if (p.aggregated.isNotEmpty)
                                Padding(padding: const EdgeInsets.only(top: 2), child: Text(p.aggregated, style: const TextStyle(color: Color(Config.text2), fontSize: 13))),
                            ]),
                          ),
                          Text('+${p.points}', style: const TextStyle(color: Color(Config.accent), fontWeight: FontWeight.w700)),
                        ]),
                      )),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity, height: 52,
                  child: FilledButton.icon(
                    onPressed: _addProof,
                    icon: const Icon(Icons.add),
                    label: const Text('Add a proof to boost', style: TextStyle(fontWeight: FontWeight.w700)),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(Config.accent),
                      foregroundColor: const Color(0xFF052819),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _scoreCard(TrustData d) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(Config.bg2), Color(Config.bg3)]),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x3334D399)),
      ),
      child: Column(children: [
        const Text('TRUST SCORE', style: TextStyle(color: Color(Config.text2), fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 1)),
        const SizedBox(height: 6),
        Text('${d.trustScore}', style: const TextStyle(color: Color(Config.accent), fontSize: 56, fontWeight: FontWeight.w800, height: 1)),
        const Text('out of 100', style: TextStyle(color: Color(Config.text3), fontSize: 13)),
        const SizedBox(height: 14),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(d.identityVerified ? Icons.verified : Icons.gpp_maybe,
              size: 18, color: d.identityVerified ? const Color(Config.accent) : const Color(Config.text3)),
          const SizedBox(width: 6),
          Text(d.identityVerified ? 'Identity verified' : 'Identity not verified',
              style: TextStyle(color: d.identityVerified ? const Color(Config.accent) : const Color(Config.text2), fontWeight: FontWeight.w600)),
        ]),
      ]),
    );
  }

  String _pretty(String c) => c.isEmpty ? 'Proof' : c[0].toUpperCase() + c.substring(1).replaceAll('_', ' ');
}

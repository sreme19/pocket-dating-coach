// Runs ONLY the trust-normalization pass against production
// (task: 'trust-normalize' — no matchmaking, no match creation).
const secret = process.env.MATCHMAKER_RUN_SECRET!;
const base = process.argv[2] || 'https://riteangle.dating';
(async () => {
  const res = await fetch(`${base}/api/verified-vibe/matchmaker/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, task: 'trust-normalize', maxUsers: Number(process.argv[3] || 40) }),
  });
  const text = await res.text();
  if (!res.ok) { console.log('HTTP', res.status, text.slice(0, 400)); process.exit(1); }
  const body = JSON.parse(text);
  const rep = body.report ?? [];
  console.log(`task=${body.task} count=${body.count}`);
  const moved = rep.filter((r: any) => r.after !== r.before);
  const up = rep.filter((r: any) => r.after > r.before).length;
  const down = rep.filter((r: any) => r.after < r.before).length;
  console.log(`changed ${moved.length}/${rep.length}  (up ${up}, down ${down})`);
  for (const g of ['man', 'woman']) {
    const rows = rep.filter((r: any) => r.gender === g).map((r: any) => r.after).sort((a: number, b: number) => a - b);
    if (!rows.length) continue;
    console.log(`  ${g}: n=${rows.length} median ${rows[Math.floor(rows.length / 2)]} min ${rows[0]} max ${rows[rows.length - 1]}`);
  }
  console.log('biggest moves:', rep.map((r: any) => ({ ...r, d: r.after - r.before }))
    .sort((a: any, b: any) => b.d - a.d).slice(0, 5)
    .map((r: any) => `${r.firstName} ${r.before}→${r.after}`).join(', '));
})();

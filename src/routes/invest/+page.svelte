<script lang="ts">
	/**
	 * /invest — the investor one-pager for the ₹1 Crore seed round.
	 *
	 * This is NOT consumer marketing. It sits on the same domain and wears the same
	 * brand (cream paper, pink accent, Gabarito) as /get, but the audience is an
	 * angel/seed investor reading on a laptop, so the layout widens to a real
	 * document column and the copy is dense and claim-first rather than six-word
	 * ad captions.
	 *
	 * Content is drawn from the four master docs (Vision & Mission, Matching Algo
	 * v0.4, Product Requirement, Marketing Requirement) and the investment pitch
	 * deck, plus the founder's own experience brief. Every product number quoted is
	 * first-party from the live platform and stated as a rate or median — never a
	 * cumulative total — so it stays true at any size (same discipline as /get).
	 *
	 * This route is deliberately OUTSIDE the check-banned-strings.sh user-facing
	 * scan set (verified-vibe / beta / get / +page.svelte / components): the GTM and
	 * monetization sections describe the business to an investor, which is a
	 * different surface from copy shown to a dater. It is still written tastefully —
	 * no compensated-dating framing — because that framing is a real App Store risk
	 * and not the story anyway.
	 *
	 * No JavaScript behind the content and no external assets: same reasoning as
	 * /get. The entrance animation is CSS-only via `animation-timeline: view()`, so
	 * a browser without it simply shows the page.
	 */
	import RiteLogo from '$lib/verified-vibe/components/RiteLogo.svelte';
	import { STORE_LINKS } from '$lib/store-links';

	/* Both stores are open — Play is a public listing, iOS is a public TestFlight
	   join link — so the investor picks their own device rather than us guessing. */
	const STORES = [
		{ label: 'Android', sub: 'Google Play', url: STORE_LINKS.android },
		{ label: 'iPhone', sub: 'TestFlight beta', url: STORE_LINKS.ios }
	];

	/* Both inboxes receive the enquiry — the personal Gmail and the brand address —
	   so a "Let's talk" click never lands in only one place. RFC-6068 comma-joins
	   multiple recipients in the mailto `to` field. */
	const CONTACT_EMAILS = ['sreekanth.rnsm@gmail.com', 'chris@wardrobeofamonk.com'];
	const mailto = `mailto:${CONTACT_EMAILS.join(',')}?subject=${encodeURIComponent('riteangle · Seed round (₹1 Cr)')}`;
	const LINKEDIN = 'https://www.linkedin.com/in/sreekanthdayanidhi/';

	/* First-party, from the live platform. Rates and medians only. */
	const TRACTION = [
		{ figure: '12 min', label: 'Median time to a man’s first match' },
		{ figure: '54%', label: 'Of all messages sent by an AI, on someone’s behalf' },
		{ figure: '2:1', label: 'Our member ratio. Rival apps run 70–93% men' },
		{ figure: '14', label: 'Suitors the median woman has — ranked, not a pile' }
	];

	const PROBLEM = [
		{
			h: 'Women are flooded',
			p: 'Hundreds of low-quality matches and no time to vet intent or safety. They don’t want more matches — they want vetted ones, without the work.'
		},
		{
			h: 'Men waste months',
			p: 'Endless swiping and ghosting. Genuinely high-quality men get filtered out on one bad photo before they ever get to speak.'
		},
		{
			h: 'Trust is performative',
			p: 'Lifestyle, intent and identity are taken on faith. Nothing is verified, so nobody can be sure who they are actually talking to.'
		}
	];

	/* The five principles from the Vision & Mission doc. */
	const PRINCIPLES = [
		{ h: 'Verified, not performative', p: 'Matches are built on claims people can prove — and the proof itself stays private, never shared.' },
		{ h: 'Value, not popularity', p: 'You’re matched on what you genuinely bring and genuinely want, not on who happened to like you.' },
		{ h: 'No swiping, ever', p: 'The AI does the searching; you do the meeting. No wasted time.' },
		{ h: 'Two-sided by design', p: 'A real match means both people chose in. We protect the balance and the scarcer side.' },
		{ h: 'Earned, not gamed', p: 'Standing rises by becoming a more proven version of yourself, and the AI shows you exactly how.' }
	];

	/* "Under the hood" — the four systems that make the guarantee deliverable. */
	const ENGINE = [
		{
			tag: 'Proof pipeline',
			h: 'Upload → AI extract → discard raw → keep the insight',
			p: 'Documents and photos are read once by AI, the signal is extracted, and the raw file is discarded. Face-match and anti-forgery gate the claim; the proof never becomes something anyone can browse.'
		},
		{
			tag: 'Trust architecture',
			h: 'ID-gated claims, matched fuzzily, verified against a face',
			p: 'High-value claims are gated behind identity. Names are matched fuzzily against documents; anything involving another person’s asset needs that person present. Trust is a score you earn, not a badge you buy.'
		},
		{
			tag: 'Agentic matching',
			h: 'Two AI agents, deliberately asymmetric',
			p: 'Bestie is the woman’s front-person — she vets suitors and only hands one off when he’s ready. Wingman is the man’s private coach — he builds the man’s standing but never speaks for him. Gender-aware by design.'
		},
		{
			tag: 'Two-sided value',
			h: 'A = Σ w · v · c, then matched under real constraints',
			p: 'Each side is a vector of what they bring (v), how proven it is (c) and what they want (w). Appeal is their weighted product — computed both ways — so a match is only made when the value is mutual, then handed off with a 48-hour clock and a free replacement if it goes quiet.'
		}
	];

	const MOAT = [
		{ n: '01', h: 'Proof-first identity', p: 'Forcing accurate data on who someone truly is. The verification UX is genuinely hard to get right, and it compounds.' },
		{ n: '02', h: 'Asymmetric AI agents', p: 'Bestie speaks for women; Wingman never does. That asymmetry is a deliberate, defensible design choice — not a prompt tweak.' },
		{ n: '03', h: 'Founder-encoded psychology', p: 'Lived experience across casual dating, matrimony and behavioral economics, encoded directly into the agents and the scoring.' },
		{ n: '04', h: 'Trust flywheel', p: 'More proof → higher standing → better matches → more reason to prove. Each verified user makes the pool worth more to the next.' }
	];

	const MODEL = [
		{ h: 'Notice Me credits', p: 'The premium interest signal that replaces the Like button. High intent, high willingness to pay.' },
		{ h: 'Premium features', p: 'Boosts, advanced filters, priority hand-offs and unlimited coaching.' },
		{ h: 'Refer & Earn', p: 'Rewards for verified referrals of the scarcer side, and auto-match upside for men.' },
		{ h: 'Date Fund (future)', p: 'An escrow commitment bond that raises standing; a service fee is charged on a no-show.' }
	];

	/* The founder's strongest, verifiable metrics. */
	const FOUNDER_STATS = [
		{ figure: '₹100 Cr+', label: 'ARR environment scaled to, as the #3 hire — joined pre-revenue' },
		{ figure: '50M+', label: 'Leads processed on the platform he built the data function for' },
		{ figure: '15+', label: 'Global data team (Analysts, ML, Data Engineers) built from zero' },
		{ figure: '₹1.5 Cr', label: 'Angel capital raised for a prior venture he founded and led' }
	];

	const FOUNDER_TIMELINE = [
		{ yr: '2021–now', h: 'DemandLane — Director, Data & Analytics → Additional Director (India)', p: 'Joined an ML-powered case-acquisition platform pre-revenue as the #3 person. Built the entire data function into a 15+ person global team; shipped production ML for lead scoring, ad-spend and funnel optimization; built early GenAI speech analytics and VoiceAI — all inside a heavily regulated (TCPA/FTC) environment scaling toward ₹100 Cr+ ARR.' },
		{ yr: '2018–2021', h: 'Converzate — GM & Chief of Staff (Data, Product, Growth)', p: 'Ran analytics, product and a 70+ seat call centre built from scratch across India and the Philippines; owned paid-ads budget and 15+ API integrations for a product serving 100K+ monthly users; incorporated and directed the Indian subsidiary.' },
		{ yr: '2015–2018', h: 'Tripeasel — Founder & CEO', p: 'Built a personalized-travel platform to ₹1 Cr+ GMV across three business lines, raised ₹1.5 Cr angel capital, and led a 15+ person team shipping web and mobile products.' }
	];

	const FOUNDER_EDU = [
		'IIM Bangalore — MBA, Decision Science (merit scholarship)',
		'Santa Clara University — MS, Robotics & Mechatronic Systems (published thesis + 2 papers)',
		'NIT Karnataka — B.Tech, Mechanical Engineering'
	];

	/* The ask. ₹1 Cr, split per the deck's use-of-funds. */
	const USE_OF_FUNDS = [
		{ pct: 50, amt: '₹50 L', h: 'Growth', p: 'Paid acquisition and ambassadors, concentrated in 1–2 launch cities.' },
		{ pct: 20, amt: '₹20 L', h: 'Product & engineering', p: 'Matchmaking engine, photo engine, Bestie/Wingman, and the iOS build.' },
		{ pct: 20, amt: '₹20 L', h: 'Team', p: 'Core product, growth and community hires.' },
		{ pct: 10, amt: '₹10 L', h: 'Ops & buffer', p: 'Operations, compliance and runway.' }
	];
</script>

<svelte:head>
	<title>riteangle · Invest — Seed round</title>
	<meta
		name="description"
		content="riteangle is raising a ₹1 Crore seed round to scale an identity-verified dating app where AI matchmakers do the searching, asking and vetting — and hand over a real, mutual match in minutes."
	/>
	<meta name="theme-color" content="#FFF3F0" />
	<meta name="robots" content="noindex" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="riteangle" />
	<meta property="og:title" content="riteangle · Seed round" />
	<meta
		property="og:description"
		content="Raising ₹1 Crore to scale a verified, AI-matchmaker dating app that guarantees a real, mutual match."
	/>
	<meta property="og:image" content="/og/riteangle-logo.png" />
</svelte:head>

<div class="pg">
	<!-- ── Hero ─────────────────────────────────────────────────────────────── -->
	<header class="hero">
		<div class="wrap">
			<div class="brandrow">
				<RiteLogo mark={true} word={true} markSize={30} />
				<span class="pill"><span class="dot" aria-hidden="true"></span>Seed round · Open</span>
			</div>

			<p class="eyebrow">The investment case</p>
			<h1 class="h1">A real match,<br /><em>guaranteed.</em></h1>
			<p class="lede">
				riteangle is an identity-verified dating app where AI matchmakers do the searching, the
				asking and the vetting — and hand each person a short, ranked shortlist of people who
				actually fit. We’re raising <strong>₹1 Crore</strong> to scale what is already live.
			</p>

			<div class="cta-row">
				<a class="cta" href={mailto}>Let’s talk</a>
				{#each STORES as s (s.label)}
					<a class="cta store" href={s.url} target="_blank" rel="noopener">
						<span class="store-label">See the product · {s.label}</span>
						<span class="store-sub">{s.sub}</span>
					</a>
				{/each}
			</div>
			<p class="cta-note">Live on Google Play · iPhone via TestFlight · post-v2.7.0</p>
		</div>
	</header>

	<!-- ── Traction strip ───────────────────────────────────────────────────── -->
	<section class="sec tinted">
		<div class="wrap">
			<h2 class="h2">Not a promise. A measurement.</h2>
			<div class="stats">
				{#each TRACTION as t (t.figure)}
					<div class="stat">
						<div class="fig">{t.figure}</div>
						<div class="slabel">{t.label}</div>
					</div>
				{/each}
			</div>
			<p class="foot">Every figure is first-party, from our own live platform — a rate or a median, never a cumulative total.</p>
		</div>
	</section>

	<!-- ── Problem ──────────────────────────────────────────────────────────── -->
	<section class="sec">
		<div class="wrap">
			<span class="kicker">The problem</span>
			<h2 class="h2">Dating apps are broken on both sides</h2>
			<div class="cols3">
				{#each PROBLEM as p (p.h)}
					<div class="card">
						<h3 class="h3">{p.h}</h3>
						<p class="p">{p.p}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ── Brand promise ────────────────────────────────────────────────────── -->
	<section class="sec promise">
		<div class="wrap narrow">
			<span class="kicker c">The brand promise</span>
			<h2 class="h2 c">Meet who you actually want —<br /><em>in minutes, not months.</em></h2>
			<p class="promise-body">
				If a match goes quiet, we replace it. If we set up a call, it’s one both sides accepted.
				You bring honest proof of who you are — we bring the person you’ve been looking for. That is
				the guarantee, and every system below exists to make it deliverable.
			</p>
		</div>
	</section>

	<!-- ── Principles ───────────────────────────────────────────────────────── -->
	<section class="sec">
		<div class="wrap">
			<span class="kicker">What we stand on</span>
			<h2 class="h2">Five principles, no exceptions</h2>
			<div class="principles">
				{#each PRINCIPLES as pr, i (pr.h)}
					<div class="prin">
						<span class="prin-n">{i + 1}</span>
						<div>
							<h3 class="h3">{pr.h}</h3>
							<p class="p">{pr.p}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ── Under the hood ───────────────────────────────────────────────────── -->
	<section class="sec tinted">
		<div class="wrap">
			<span class="kicker">Under the hood</span>
			<h2 class="h2">What makes the promise deliverable</h2>
			<div class="cols2">
				{#each ENGINE as e (e.tag)}
					<div class="engine">
						<span class="engine-tag">{e.tag}</span>
						<h3 class="h3">{e.h}</h3>
						<p class="p">{e.p}</p>
					</div>
				{/each}
			</div>

			<!-- The scoring formula, called out. It's the one piece of real math on the
			     page and it earns its space: it's the answer to "how is a match decided?" -->
			<div class="formula">
				<div class="formula-eq">Appeal = <span class="hl">Σ</span> w<sub>i</sub> · v<sub>i</sub> · c<sub>i</sub></div>
				<div class="formula-key">
					<span><b class="v">v</b> what you bring</span>
					<span><b class="v">c</b> how proven it is</span>
					<span><b class="v">w</b> what the other side wants</span>
				</div>
				<p class="formula-note">
					Computed in both directions. A match is only created when the value is mutual — then
					handed off on a 48-hour clock, replaced free if it stalls.
				</p>
			</div>
		</div>
	</section>

	<!-- ── Product surfaces ─────────────────────────────────────────────────── -->
	<section class="sec">
		<div class="wrap">
			<span class="kicker">The product, live today</span>
			<h2 class="h2">Built, shipped, iterating</h2>
			<ul class="pills">
				<li>Onboarding · 16 archetypes</li>
				<li>Public Read</li>
				<li>Trust &amp; Boost</li>
				<li>Discover</li>
				<li>Chat</li>
				<li>AI Bestie</li>
				<li>AI Wingman</li>
				<li>Notice Me</li>
			</ul>
			<div class="stack">
				<span>SvelteKit</span>
				<span>Supabase + pgvector</span>
				<span>Claude AI</span>
				<span>fal.ai photos</span>
				<span>Flutter (native iOS + Android)</span>
				<span>Vercel</span>
			</div>
			<p class="foot">Android is live. Matchmaking engine and competitive intelligence are actively hardening; iOS is in build.</p>
		</div>
	</section>

	<!-- ── Moat ─────────────────────────────────────────────────────────────── -->
	<section class="sec tinted">
		<div class="wrap">
			<span class="kicker">The moat</span>
			<h2 class="h2">Why this is hard to copy</h2>
			<div class="cols2">
				{#each MOAT as m (m.n)}
					<div class="card">
						<span class="moat-n">{m.n}</span>
						<h3 class="h3">{m.h}</h3>
						<p class="p">{m.p}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ── Business model + GTM ─────────────────────────────────────────────── -->
	<section class="sec">
		<div class="wrap">
			<span class="kicker">How it makes money</span>
			<h2 class="h2">Multiple revenue layers</h2>
			<div class="cols2">
				{#each MODEL as m (m.h)}
					<div class="card">
						<h3 class="h3">{m.h}</h3>
						<p class="p">{m.p}</p>
					</div>
				{/each}
			</div>
			<div class="gtm">
				<h3 class="h3">Go-to-market</h3>
				<p class="p">
					Land the casual segment first and win density city by city. Women are acquired on the
					promise of vetted matches without the work — the AI Bestie does the heavy lifting. Men are
					reached through Instagram, Snap, Telegram, LinkedIn, club networks and referrals, on a
					single promise: a real match within minutes of signing up.
				</p>
			</div>
		</div>
	</section>

	<!-- ── Founder ──────────────────────────────────────────────────────────── -->
	<section class="sec tinted">
		<div class="wrap">
			<span class="kicker">The founder</span>
			<h2 class="h2">Sreekanth (Sree) Dayanidhi</h2>
			<p class="lede sm">
				A business-embedded data &amp; AI operator who has built teams and systems from near-zero
				multiple times, and connected them directly to revenue, risk and compliance outcomes. The
				core belief behind riteangle: the barriers to great matching aren’t the models — they’re
				<em>accurate data on who someone truly is</em>, and matching under real-world constraints.
			</p>

			<div class="stats founder">
				{#each FOUNDER_STATS as s (s.figure)}
					<div class="stat">
						<div class="fig">{s.figure}</div>
						<div class="slabel">{s.label}</div>
					</div>
				{/each}
			</div>

			<!-- Founder–market fit. He literally wrote a dating book for Indian men in
			     2019 — years before riteangle — which is the hardest-to-fake evidence of
			     the "founder-encoded psychology" moat point. Links out to the live
			     Amazon listing so a reader can verify it in one click. -->
			<a class="book" href="https://www.amazon.in/Art-Dating-Indian-Men-Relationships-ebook/dp/B07MZZ23FB" target="_blank" rel="noopener">
				<img
					class="book-cover"
					src="/invest/art-of-dating-cover.jpg"
					width="1000"
					height="1500"
					alt="Book cover — Art of Dating for Indian Men by Chris (Sree) Daniels"
					loading="lazy"
				/>
				<div class="book-body">
					<span class="book-tag">Founder–market fit · he wrote the book</span>
					<h3 class="h3">“Art of Dating for Indian Men”</h3>
					<p class="p">
						Published in 2019 — a full playbook on Tinder/Bumble, relationships and finding a
						partner, for exactly the audience riteangle now serves. The lived expertise behind the
						AI agents isn’t a pitch line; it’s been in market, reviewed and read, for years.
					</p>
					<span class="book-meta">Amazon Kindle · 2019 · 4.0★ (10 ratings) · by Chris (Sree) Daniels</span>
				</div>
			</a>

			<div class="timeline">
				{#each FOUNDER_TIMELINE as t (t.h)}
					<div class="tl">
						<span class="tl-yr">{t.yr}</span>
						<div>
							<h3 class="h3">{t.h}</h3>
							<p class="p">{t.p}</p>
						</div>
					</div>
				{/each}
			</div>

			<div class="edu">
				<span class="edu-tag">Education</span>
				<ul>
					{#each FOUNDER_EDU as e (e)}<li>{e}</li>{/each}
				</ul>
			</div>
		</div>
	</section>

	<!-- ── The ask ──────────────────────────────────────────────────────────── -->
	<section class="sec ask">
		<div class="wrap">
			<span class="kicker c">The ask</span>
			<h2 class="h2 c">Raising <em>₹1 Crore</em> · Seed</h2>
			<p class="ask-sub">Seed capital to scale what is already working. Use of funds:</p>
			<div class="funds">
				{#each USE_OF_FUNDS as f (f.h)}
					<div class="fund">
						<div class="fund-head">
							<span class="fund-pct">{f.pct}%</span>
							<span class="fund-amt">{f.amt}</span>
						</div>
						<div class="fund-bar"><span class="fund-fill" style="width:{f.pct}%"></span></div>
						<h3 class="h3">{f.h}</h3>
						<p class="p">{f.p}</p>
					</div>
				{/each}
			</div>

			<!-- Founder skin-in-the-game. Placed under the use-of-funds so the eye lands on
			     it right after seeing where the money goes: none of it is the founder's pay.
			     Styled as the loudest single element in the section on purpose. -->
			<div class="skin">
				<span class="skin-tag">Founder commitment</span>
				<p class="skin-line">
					<strong>Every rupee goes into the business.</strong> The founder draws
					<em>zero salary</em> from this round — all ₹1 Cr funds product, growth and team.
				</p>
			</div>
		</div>
	</section>

	<!-- ── Close / contact ──────────────────────────────────────────────────── -->
	<section class="sec close">
		<div class="wrap narrow">
			<h2 class="h2 c">You bring proof.<br />We bring the person.</h2>
			<a class="cta" href={mailto}>Let’s talk</a>
			<div class="contact">
				{#each CONTACT_EMAILS as email (email)}
					<a href="mailto:{email}?subject={encodeURIComponent('riteangle · Seed round (₹1 Cr)')}">{email}</a>
					<span aria-hidden="true">·</span>
				{/each}
				<a href="tel:+919742007227">+91 97420 07227</a>
				<span aria-hidden="true">·</span>
				<a href={LINKEDIN} target="_blank" rel="noopener">LinkedIn</a>
			</div>
		</div>
	</section>

	<footer class="ft">
		<div class="wrap">
			<RiteLogo mark={true} word={true} markSize={22} />
			<p class="ftnote">
				Confidential. Prepared for prospective investors. Product metrics are first-party from the
				live platform. Strictly an 18+ product; identity is verified and verification documents are
				read once and discarded.
			</p>
		</div>
	</footer>
</div>

<style>
	/* Cream, light and warm — the product's own palette, so the raise looks like the
	   brand it's for. Tokens come from src/app.css (loaded by the root layout). */
	.pg {
		background: var(--bg-1);
		color: var(--text-1);
		font-family: var(--font-serif);
		min-height: 100vh;
		overflow-x: hidden;
	}

	.wrap {
		width: 100%;
		max-width: 940px;
		margin: 0 auto;
		padding: 0 22px;
		box-sizing: border-box;
	}

	.wrap.narrow {
		max-width: 620px;
	}

	/* ── Hero ─────────────────────────────────────────────────────────────── */
	.hero {
		padding: 26px 0 40px;
		background:
			radial-gradient(120% 70% at 50% -10%, var(--accent-tint) 0%, transparent 58%),
			radial-gradient(90% 60% at 100% 0%, rgba(255, 122, 77, 0.14) 0%, transparent 60%);
	}

	.brandrow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 10px 12px;
		margin-bottom: 30px;
	}

	/* Status light, not decoration — the one green thing on a pink page, matching
	   /get. Green isn't in the design system, so the values are literal. */
	.pill {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #047857;
		background: rgba(16, 185, 129, 0.14);
		border: 1px solid rgba(16, 185, 129, 0.45);
		border-radius: 999px;
		padding: 5px 11px 5px 9px;
	}

	.pill .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #10b981;
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.22);
	}

	.eyebrow,
	.kicker {
		display: block;
		font-size: 11.5px;
		font-weight: 800;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--accent-bright);
		margin-bottom: 12px;
	}

	.kicker.c {
		text-align: center;
	}

	.h1 {
		font-size: clamp(42px, 9vw, 72px);
		line-height: 0.98;
		letter-spacing: -0.045em;
		font-weight: 900;
		margin: 0 0 18px;
		text-wrap: balance;
	}

	.h1 em {
		font-style: normal;
		color: var(--accent);
	}

	.lede {
		font-size: clamp(17px, 2.4vw, 20px);
		line-height: 1.5;
		font-weight: 500;
		color: var(--text-2);
		margin: 0 0 26px;
		max-width: 680px;
	}

	.lede.sm {
		font-size: 16.5px;
		margin-bottom: 22px;
	}

	.lede strong {
		color: var(--accent-bright);
		font-weight: 800;
	}

	.lede em {
		font-style: italic;
		color: var(--text-1);
	}

	/* ── CTA ──────────────────────────────────────────────────────────────── */
	.cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	.cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 54px;
		padding: 15px 30px;
		border-radius: 14px;
		background: linear-gradient(135deg, var(--accent) 0%, var(--accent-bright) 100%);
		color: #fff;
		font-size: 17px;
		font-weight: 800;
		letter-spacing: -0.01em;
		text-decoration: none;
		box-shadow: 0 14px 30px -14px rgba(225, 29, 84, 0.62);
		transition:
			transform 150ms ease,
			box-shadow 150ms ease;
	}

	.cta:hover {
		transform: translateY(-1px);
		box-shadow: 0 18px 34px -14px rgba(225, 29, 84, 0.7);
	}

	.cta:active {
		transform: translateY(0);
	}

	.cta.ghost {
		background: transparent;
		color: var(--accent-bright);
		border: 1.5px solid var(--border-3);
		box-shadow: none;
	}

	.cta.ghost:hover {
		background: var(--accent-tint);
	}

	/* Store buttons: outline (secondary to "Let's talk"), stacked label + platform
	   sub-line so the investor picks the device they actually hold. */
	.cta.store {
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: 1px;
		padding: 11px 22px;
		background: transparent;
		color: var(--accent-bright);
		border: 1.5px solid var(--border-3);
		box-shadow: none;
	}

	.cta.store:hover {
		background: var(--accent-tint);
		box-shadow: none;
	}

	.store-label {
		font-size: 15.5px;
		font-weight: 800;
		letter-spacing: -0.01em;
	}

	.store-sub {
		font-size: 11.5px;
		font-weight: 700;
		color: var(--text-4);
	}

	.cta-note {
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--text-4);
		margin: 14px 0 0;
	}

	/* ── Sections ─────────────────────────────────────────────────────────── */
	.sec {
		padding: 46px 0;
	}

	.sec.tinted {
		background: var(--bg-3);
	}

	.h2 {
		font-size: clamp(26px, 4.4vw, 38px);
		line-height: 1.08;
		letter-spacing: -0.035em;
		font-weight: 900;
		margin: 0 0 26px;
		text-wrap: balance;
	}

	.h2 em {
		font-style: normal;
		color: var(--accent);
	}

	.h2.c {
		text-align: center;
	}

	.h3 {
		font-size: 16.5px;
		line-height: 1.25;
		font-weight: 800;
		letter-spacing: -0.02em;
		margin: 0 0 6px;
		color: var(--text-1);
	}

	.p {
		font-size: 14.5px;
		line-height: 1.55;
		color: var(--text-3);
		margin: 0;
	}

	.foot {
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--text-4);
		margin: 20px 0 0;
	}

	/* ── Stats ────────────────────────────────────────────────────────────── */
	.stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.stat {
		background: var(--bg-2);
		border: 1px solid var(--border-1);
		border-radius: 16px;
		padding: 18px 18px 20px;
	}

	.fig {
		font-size: clamp(30px, 6vw, 42px);
		line-height: 1;
		font-weight: 900;
		letter-spacing: -0.04em;
		color: var(--accent-bright);
		margin-bottom: 8px;
	}

	.slabel {
		font-size: 13.5px;
		line-height: 1.4;
		font-weight: 600;
		color: var(--text-2);
	}

	/* ── Cards / grids ────────────────────────────────────────────────────── */
	.cols2,
	.cols3 {
		display: grid;
		gap: 14px;
	}

	.cols2 {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.cols3 {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.card {
		background: var(--bg-2);
		border: 1px solid var(--border-1);
		border-radius: 16px;
		padding: 20px;
	}

	.sec.tinted .card {
		box-shadow: 0 16px 40px -32px rgba(122, 17, 51, 0.5);
	}

	.moat-n {
		display: block;
		font-size: 13px;
		font-weight: 900;
		color: var(--accent);
		margin-bottom: 8px;
	}

	/* ── Promise ──────────────────────────────────────────────────────────── */
	.sec.promise {
		background:
			radial-gradient(100% 90% at 50% 0%, var(--accent-tint) 0%, transparent 60%), var(--bg-1);
		text-align: center;
	}

	.sec.promise .h2 em {
		color: var(--accent-bright);
		font-style: italic;
	}

	.promise-body {
		font-size: 16px;
		line-height: 1.6;
		color: var(--text-2);
		font-weight: 500;
		margin: 0 auto;
		max-width: 560px;
	}

	/* ── Principles ───────────────────────────────────────────────────────── */
	.principles {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px 22px;
	}

	.prin {
		display: flex;
		gap: 13px;
		align-items: flex-start;
	}

	.prin-n {
		flex: none;
		width: 30px;
		height: 30px;
		border-radius: 9px;
		display: grid;
		place-items: center;
		font-size: 14px;
		font-weight: 900;
		color: var(--accent-bright);
		background: var(--accent-tint);
		border: 1px solid var(--border-3);
	}

	/* ── Engine ───────────────────────────────────────────────────────────── */
	.engine {
		background: var(--bg-2);
		border: 1px solid var(--border-1);
		border-radius: 16px;
		padding: 20px;
	}

	.engine-tag {
		display: inline-block;
		font-size: 10.5px;
		font-weight: 800;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--accent-bright);
		background: var(--accent-tint);
		border-radius: 999px;
		padding: 4px 11px;
		margin-bottom: 12px;
	}

	.formula {
		margin-top: 16px;
		background: linear-gradient(160deg, #fff 0%, #fff4f1 100%);
		border: 1px solid var(--border-3);
		border-radius: 18px;
		padding: 26px 22px;
		text-align: center;
		box-shadow: 0 20px 46px -32px rgba(122, 17, 51, 0.5);
	}

	.formula-eq {
		font-size: clamp(24px, 5vw, 32px);
		font-weight: 900;
		letter-spacing: -0.02em;
		color: var(--text-1);
	}

	.formula-eq .hl {
		color: var(--accent);
	}

	.formula-eq sub {
		font-size: 0.5em;
		font-weight: 700;
		color: var(--text-3);
	}

	.formula-key {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px 22px;
		margin: 16px 0 12px;
		font-size: 13.5px;
		color: var(--text-2);
		font-weight: 600;
	}

	.formula-key .v {
		color: var(--accent-bright);
		font-weight: 900;
		margin-right: 5px;
	}

	.formula-note {
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-3);
		margin: 0 auto;
		max-width: 460px;
	}

	/* ── Product surfaces ─────────────────────────────────────────────────── */
	.pills {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0 0 18px;
		padding: 0;
	}

	.pills li {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-2);
		background: var(--bg-2);
		border: 1px solid var(--border-1);
		border-radius: 999px;
		padding: 7px 13px;
	}

	.stack {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.stack span {
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.01em;
		color: var(--accent-bright);
		background: var(--accent-tint);
		border-radius: 8px;
		padding: 6px 11px;
	}

	/* ── GTM ──────────────────────────────────────────────────────────────── */
	.gtm {
		margin-top: 16px;
		background: var(--bg-2);
		border: 1px solid var(--border-1);
		border-left: 4px solid var(--accent);
		border-radius: 14px;
		padding: 20px 22px;
	}

	/* ── Founder ──────────────────────────────────────────────────────────── */
	.stats.founder {
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin-bottom: 28px;
	}

	/* ── Founder book (founder–market fit) ────────────────────────────────── */
	.book {
		display: flex;
		gap: 18px;
		align-items: stretch;
		text-decoration: none;
		color: inherit;
		background: linear-gradient(160deg, #fff 0%, #fff4f1 100%);
		border: 1px solid var(--border-3);
		border-radius: 18px;
		padding: 18px;
		margin: 0 0 28px;
		box-shadow: 0 18px 44px -30px rgba(122, 17, 51, 0.5);
		transition:
			transform 150ms ease,
			box-shadow 150ms ease;
	}

	.book:hover {
		transform: translateY(-2px);
		box-shadow: 0 22px 50px -28px rgba(122, 17, 51, 0.55);
	}

	/* The real published cover, served from static/invest. Fixed aspect box so the
	   card height is stable while the image lazy-loads. */
	.book-cover {
		flex: none;
		width: 96px;
		height: 144px;
		object-fit: cover;
		border-radius: 8px;
		background: var(--bg-3);
		box-shadow: 0 12px 24px -12px rgba(27, 16, 32, 0.45);
	}

	.book-body {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.book-tag {
		display: inline-block;
		align-self: flex-start;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--accent-bright);
		background: var(--accent-tint);
		border-radius: 999px;
		padding: 4px 10px;
		margin-bottom: 9px;
	}

	.book-meta {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-4);
		margin-top: 9px;
	}

	.timeline {
		display: grid;
		gap: 18px;
	}

	.tl {
		display: grid;
		grid-template-columns: 108px 1fr;
		gap: 18px;
		align-items: start;
		padding-bottom: 18px;
		border-bottom: 1px solid var(--border-2);
	}

	.tl:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.tl-yr {
		font-size: 12.5px;
		font-weight: 900;
		letter-spacing: -0.01em;
		color: var(--accent-bright);
		padding-top: 2px;
	}

	.edu {
		margin-top: 24px;
		background: var(--bg-2);
		border: 1px solid var(--border-1);
		border-radius: 14px;
		padding: 18px 20px;
	}

	.edu-tag {
		display: block;
		font-size: 10.5px;
		font-weight: 800;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--text-4);
		margin-bottom: 10px;
	}

	.edu ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 8px;
	}

	.edu li {
		font-size: 14px;
		font-weight: 600;
		line-height: 1.4;
		color: var(--text-2);
		padding-left: 18px;
		position: relative;
	}

	.edu li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 8px;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent);
	}

	/* ── The ask ──────────────────────────────────────────────────────────── */
	.sec.ask {
		background:
			radial-gradient(110% 90% at 50% 0%, var(--accent-tint) 0%, transparent 62%), var(--bg-1);
	}

	.sec.ask .h2 em {
		color: var(--accent-bright);
	}

	.ask-sub {
		text-align: center;
		font-size: 15px;
		color: var(--text-3);
		font-weight: 600;
		margin: -12px 0 28px;
	}

	.funds {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
	}

	.fund {
		background: var(--bg-2);
		border: 1px solid var(--border-1);
		border-radius: 16px;
		padding: 18px 20px;
	}

	.fund-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.fund-pct {
		font-size: 30px;
		font-weight: 900;
		letter-spacing: -0.04em;
		color: var(--accent-bright);
	}

	.fund-amt {
		font-size: 14px;
		font-weight: 800;
		color: var(--text-3);
	}

	.fund-bar {
		height: 7px;
		border-radius: 999px;
		background: var(--bg-3);
		overflow: hidden;
		margin-bottom: 14px;
	}

	.fund-fill {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--accent) 0%, var(--accent-bright) 100%);
	}

	/* ── Founder commitment callout ───────────────────────────────────────── */
	.skin {
		margin-top: 22px;
		text-align: center;
		background: linear-gradient(135deg, var(--accent) 0%, var(--accent-bright) 100%);
		border-radius: 18px;
		padding: 24px 26px;
		box-shadow: 0 22px 46px -24px rgba(225, 29, 84, 0.6);
	}

	.skin-tag {
		display: inline-block;
		font-size: 10.5px;
		font-weight: 800;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: #fff;
		background: rgba(255, 255, 255, 0.22);
		border-radius: 999px;
		padding: 5px 13px;
		margin-bottom: 12px;
	}

	.skin-line {
		font-size: clamp(17px, 2.6vw, 21px);
		line-height: 1.45;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.92);
		margin: 0 auto;
		max-width: 620px;
	}

	.skin-line strong {
		color: #fff;
		font-weight: 900;
	}

	.skin-line em {
		font-style: normal;
		color: #fff;
		font-weight: 900;
		border-bottom: 2px solid rgba(255, 255, 255, 0.55);
		padding-bottom: 1px;
	}

	/* ── Close ────────────────────────────────────────────────────────────── */
	.sec.close {
		text-align: center;
		padding-bottom: 54px;
	}

	.sec.close .cta {
		margin: 6px 0 22px;
	}

	.contact {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 10px 14px;
		font-size: 14px;
		font-weight: 700;
	}

	.contact a {
		color: var(--text-2);
		text-decoration: none;
		border-bottom: 1px solid var(--border-2);
	}

	.contact a:hover {
		color: var(--accent-bright);
	}

	.contact span {
		color: var(--text-4);
	}

	/* ── Footer ───────────────────────────────────────────────────────────── */
	.ft {
		padding: 26px 0 40px;
		background: var(--bg-3);
		border-top: 1px solid var(--border-1);
		text-align: center;
	}

	.ft .wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.ftnote {
		font-size: 11.5px;
		line-height: 1.55;
		color: var(--text-4);
		margin: 0;
		max-width: 560px;
	}

	/* ── Entrance animation (CSS-only, safe by default) ───────────────────── */
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(14px);
		}

		to {
			opacity: 1;
			transform: none;
		}
	}

	@supports (animation-timeline: view()) {
		@media (prefers-reduced-motion: no-preference) {
			.sec .h2,
			.stat,
			.card,
			.prin,
			.engine,
			.formula,
			.gtm,
			.tl,
			.fund {
				animation: rise linear both;
				animation-timeline: view();
				animation-range: entry 0% entry 45%;
			}
		}
	}

	/* ── Mobile ───────────────────────────────────────────────────────────── */
	@media (max-width: 720px) {
		.cols2,
		.cols3,
		.principles,
		.funds {
			grid-template-columns: 1fr;
		}

		.stats,
		.stats.founder {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.sec {
			padding: 38px 0;
		}

		.tl {
			grid-template-columns: 1fr;
			gap: 6px;
		}

		.book {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>

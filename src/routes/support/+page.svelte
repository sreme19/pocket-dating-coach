<script module>
	export const prerender = import.meta.env.VITE_MOBILE !== 'true';
</script>

<script>
	const supportEmail = 'support@riteangle.dating';
	const privacyEmail = 'privacy@riteangle.dating';

	const faqs = [
		{
			q: 'How do I get verified on riteangle?',
			a: 'Open the Trust & Boost tab on your profile. You can upload lifestyle photos, discipline proof, and social proof without any ID. For Money Matters and Garage sections, you\'ll first verify your government-issued ID, then upload the relevant financial or ownership documents.'
		},
		{
			q: 'Why does my verification keep failing?',
			a: 'Common reasons: (1) Your face must be clearly visible in the uploaded photo — obscured or missing faces are rejected. (2) AI-generated or edited images are automatically rejected. (3) For financial documents, your name on the document must reasonably match your government ID. Contact us if issues persist.'
		},
		{
			q: 'What happens to my uploaded documents?',
			a: 'All uploaded photos and documents are processed by AI for verification and then immediately deleted. We do not store copies of your ID, financial documents, or raw photos. Only the verified results (badges and summaries) are kept on your profile.'
		},
		{
			q: 'Can I change my lane/archetype?',
			a: 'Yes. Go to your profile and tap "What I\'m About" to change your lane. Lane changes are limited to 3 per month. Changing your lane updates your profile content, matching pool, and AI assistants — you\'ll be asked to complete the new lane\'s onboarding questions.'
		},
		{
			q: 'How does AI Bestie work?',
			a: 'AI Bestie is automatically on for every male match and converses with them on your behalf. She introduces herself as your AI Bestie (never impersonates you), asks questions to vet the match against your preferences, and briefs you when she\'s done. You can turn her off for any specific match at any time.'
		},
		{
			q: 'How does AI Wingman work?',
			a: 'AI Wingman is your private coach — he never speaks to your matches on your behalf. He helps you build your profile, recommends proofs to upload, and coaches you on how to handle conversations. Any reply he drafts is yours to review and send yourself.'
		},
		{
			q: 'How do I delete my account?',
			a: 'Go to Profile → Settings → Delete Account. Your personal data will be removed within 30 days. You can also email us at ' + privacyEmail + ' to request deletion.'
		},
		{
			q: 'My real photo — is it ever shown to other users?',
			a: 'For men: no. Your raw, unedited photo is never shown to anyone on the platform at any stage — not before a match, not after. Only your AI-enhanced portrait is displayed. For women: your real photos are shown exactly as you upload them.'
		},
		{
			q: 'What currency is used for income and wealth?',
			a: 'riteangle currently uses Indian Rupees (₹) for all income and wealth figures.'
		},
		{
			q: 'I\'m an App Store reviewer — how do I log in?',
			a: 'Use the demo account on the login screen:\n• Email: review@riteangle.com\n• OTP Code: 123456\nThis gives you access to a pre-configured demo profile without needing a real OTP.'
		}
	];
</script>

<svelte:head>
	<title>Support – riteangle</title>
	<meta name="description" content="Get help with riteangle – verified dating app" />
</svelte:head>

<main class="max-w-2xl mx-auto px-6 py-12 text-gray-800 font-sans">
	<div class="mb-10">
		<span class="text-2xl font-bold tracking-tight" style="color:#FF3B6B">riteangle</span>
		<h1 class="text-2xl font-bold mt-1">Support</h1>
		<p class="text-sm text-gray-400 mt-1">We're here to help.</p>
	</div>

	<section class="mb-10 rounded-2xl p-6" style="background:#FFF0F3">
		<h2 class="text-base font-semibold mb-1">Contact Us</h2>
		<p class="text-sm text-gray-600 mb-3">
			Can't find what you're looking for? Email us and we'll get back to you within 1–2 business days.
		</p>
		<a
			href="mailto:{supportEmail}"
			class="inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
			style="background:#FF3B6B"
		>
			{supportEmail}
		</a>
	</section>

	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-5">Frequently Asked Questions</h2>
		<div class="space-y-6">
			{#each faqs as faq, i}
				<div class="border-b border-gray-100 pb-6">
					<h3 class="font-semibold mb-2 text-[#1B1020]">{i + 1}. {faq.q}</h3>
					<p class="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{faq.a}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="mb-10">
		<h2 class="text-lg font-semibold mb-3">Other Resources</h2>
		<ul class="space-y-2 text-sm">
			<li>
				<a href="/privacy-policy" class="underline" style="color:#FF3B6B">Privacy Policy</a>
			</li>
			<li>
				<a href="/child-safety" class="underline" style="color:#FF3B6B">Child Safety Standards</a>
			</li>
		</ul>
	</section>

	<section class="text-sm text-gray-400">
		<p>
			For privacy requests or data deletion, email
			<a href="mailto:{privacyEmail}" class="underline" style="color:#FF3B6B">{privacyEmail}</a>.
		</p>
	</section>
</main>

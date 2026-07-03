<script module>
	export const prerender = import.meta.env.VITE_MOBILE !== 'true';
</script>

<script>
	const lastUpdated = 'July 3, 2026';
	const contactEmail = 'privacy@riteangle.dating';
</script>

<svelte:head>
	<title>Privacy Policy – riteangle</title>
	<meta name="description" content="Privacy Policy for riteangle – verified dating app" />
</svelte:head>

<main class="max-w-2xl mx-auto px-6 py-12 text-gray-800 font-sans">
	<div class="mb-10">
		<span class="text-2xl font-bold tracking-tight" style="color:#FF3B6B">riteangle</span>
		<h1 class="text-2xl font-bold mt-1">Privacy Policy</h1>
		<p class="text-sm text-gray-400 mt-1">Last updated: {lastUpdated}</p>
	</div>

	<section class="mb-8">
		<p class="leading-relaxed">
			This Privacy Policy describes how riteangle ("we", "us", or "our") collects, uses, and
			protects information about you when you use our mobile application and website (the "Service").
			By using the Service, you agree to the practices described in this policy.
		</p>
	</section>

	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-3">1. Information We Collect</h2>
		<ul class="list-disc pl-6 space-y-3 leading-relaxed">
			<li>
				<strong>Account information:</strong> Your email address used to create and authenticate your
				account.
			</li>
			<li>
				<strong>Profile information:</strong> Display name, age, gender, city, dating preferences,
				archetype/lane, and the bio and profile content you create.
			</li>
			<li>
				<strong>Photos you upload:</strong> Profile pictures and proof photos (lifestyle, discipline,
				social). <em>Raw uploaded photos are processed by AI for verification and then immediately
				discarded — they are not stored in our database.</em> Only the AI-extracted results (insight
				badges, summaries) are retained.
			</li>
			<li>
				<strong>Identity documents:</strong> Government-issued ID uploaded for identity verification.
				Documents are scanned and then discarded — we do not store copies of your ID.
			</li>
			<li>
				<strong>Financial documents:</strong> Payslips, bank statements, tax returns, or investment
				statements uploaded to verify income and wealth. These are scanned for AI extraction and then
				discarded — we do not store copies of financial documents.
			</li>
			<li>
				<strong>Biometric data:</strong> A live selfie captured during liveness and face-match
				verification. This image is used solely to confirm your identity against uploaded documents
				and profile photos, then discarded.
			</li>
			<li>
				<strong>Vehicle ownership documents:</strong> Registration, insurance, or ownership papers
				uploaded to verify your Garage section. Scanned and discarded after extraction.
			</li>
			<li>
				<strong>Travel evidence:</strong> Travel photos, boarding passes, passport stamps, or hotel
				bookings uploaded to verify Travel Magnets. Scanned and discarded after location extraction.
			</li>
			<li>
				<strong>Messages and conversations:</strong> Chat messages exchanged through the Service,
				including conversations handled by AI Bestie or with AI Wingman coaching.
			</li>
			<li>
				<strong>Device information:</strong> Device token for push notification delivery.
			</li>
			<li>
				<strong>Usage data:</strong> App interactions, features accessed, and session activity used
				to improve the Service.
			</li>
		</ul>
	</section>

	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-3">2. How We Use Your Information</h2>
		<ul class="list-disc pl-6 space-y-2 leading-relaxed">
			<li>To create and operate your profile and matching experience.</li>
			<li>
				To verify your identity, income, assets, and lifestyle through our AI-powered Trust & Boost
				system.
			</li>
			<li>To calculate and display your trust score and verified signals to potential matches.</li>
			<li>
				To power AI Bestie and AI Wingman — personalised AI companions that advise you and, in the
				case of Bestie, converse with your matches on your behalf.
			</li>
			<li>To match you with compatible people using our matchmaking engine.</li>
			<li>To send push notifications relevant to your activity (only with your permission).</li>
			<li>To detect fraud, fake documents, and AI-generated or manipulated images.</li>
			<li>To respond to support requests and communicate about the Service.</li>
			<li>To comply with legal obligations.</li>
		</ul>
	</section>

	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-3">3. Biometric and Sensitive Data</h2>
		<p class="leading-relaxed mb-3">
			riteangle collects and processes biometric and sensitive data for identity verification
			purposes only:
		</p>
		<ul class="list-disc pl-6 space-y-2 leading-relaxed">
			<li>
				<strong>Face data</strong> (liveness selfie, face match against ID and profile photos) is
				used solely to confirm you are a real, live person and that your profile represents you. It
				is not used for advertising, sold, or shared with third parties.
			</li>
			<li>
				<strong>Government ID and financial documents</strong> are processed in the moment for AI
				extraction and immediately discarded. We do not store scans or copies of these documents.
			</li>
			<li>
				Extracted results (e.g. income tier, career signals, verified badges) are stored as part of
				your profile but contain no raw document data.
			</li>
		</ul>
	</section>

	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-3">4. Third-Party Services</h2>
		<p class="mb-3 leading-relaxed">We use the following third-party services to operate the app:</p>
		<ul class="list-disc pl-6 space-y-2 leading-relaxed">
			<li>
				<strong>Supabase</strong> — database and authentication. Your profile data and messages are
				stored securely on Supabase-managed infrastructure.
			</li>
			<li>
				<strong>Anthropic Claude</strong> — AI model used to power verification, AI Bestie, AI
				Wingman, and coaching features. Content you submit may be processed by Anthropic's API.
				Anthropic's privacy policy applies to data processed through their API.
			</li>
			<li>
				<strong>Firebase (Google)</strong> — push notification delivery. Your device token is
				registered with Firebase Cloud Messaging.
			</li>
		</ul>
		<p class="mt-3 leading-relaxed">
			We do not sell your personal information to any third party.
		</p>
	</section>

	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-3">5. Data Sharing</h2>
		<p class="leading-relaxed mb-3">
			Your private data (uploaded documents, financial figures, biometric data, and messages) is
			never shown to other users. What other users see is limited to:
		</p>
		<ul class="list-disc pl-6 space-y-2 leading-relaxed">
			<li>Your public profile (display name, AI-extracted badges, trust score, profile photos).</li>
			<li>
				For men: AI-enhanced portrait only — your original, unedited photo is never shown to anyone
				on the platform.
			</li>
			<li>Verified signals (e.g. career tier, lifestyle badges) — never the source documents.</li>
		</ul>
	</section>

	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-3">6. Data Retention</h2>
		<ul class="list-disc pl-6 space-y-2 leading-relaxed">
			<li>
				<strong>Raw photos and documents</strong> — deleted immediately after AI processing. Not
				stored.
			</li>
			<li>
				<strong>Biometric data (selfie)</strong> — used for the verification check and then
				discarded. Not stored.
			</li>
			<li>
				<strong>Profile and account data</strong> — retained while your account is active.
			</li>
			<li>
				<strong>Messages</strong> — retained for the duration of the match and for a reasonable
				period after, subject to applicable law.
			</li>
			<li>
				If you delete your account, your personal data is removed within 30 days, except where
				required by law.
			</li>
		</ul>
	</section>

	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-3">7. Your Rights</h2>
		<p class="mb-3 leading-relaxed">You have the right to:</p>
		<ul class="list-disc pl-6 space-y-2 leading-relaxed">
			<li>Access the personal data we hold about you.</li>
			<li>Request correction of inaccurate data.</li>
			<li>Request deletion of your account and associated data.</li>
			<li>Withdraw consent for push notifications at any time via your device settings.</li>
			<li>Object to or restrict certain processing of your data.</li>
		</ul>
		<p class="mt-3 leading-relaxed">
			To exercise any of these rights, contact us at
			<a href="mailto:{contactEmail}" class="underline" style="color:#FF3B6B">{contactEmail}</a>.
		</p>
	</section>

	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-3">8. Security</h2>
		<p class="leading-relaxed">
			We use industry-standard security measures including HTTPS encryption, access controls, and
			secure cloud infrastructure. Raw sensitive documents are never persisted. However, no method
			of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
		</p>
	</section>

	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-3">9. Children's Privacy</h2>
		<p class="leading-relaxed">
			riteangle is strictly for users aged 18 and over. We do not knowingly collect personal
			information from anyone under 18. If you believe a minor has provided us with personal data,
			please contact us and we will delete it immediately.
		</p>
	</section>

	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-3">10. Changes to This Policy</h2>
		<p class="leading-relaxed">
			We may update this Privacy Policy from time to time. We will notify you of significant changes
			by posting the updated policy on this page and updating the "Last updated" date. Continued use
			of the Service after changes constitutes acceptance of the updated policy.
		</p>
	</section>

	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-3">11. Contact Us</h2>
		<p class="leading-relaxed">
			For any questions or concerns about this Privacy Policy, please contact us at:<br />
			<a href="mailto:{contactEmail}" class="underline" style="color:#FF3B6B">{contactEmail}</a>
		</p>
	</section>
</main>

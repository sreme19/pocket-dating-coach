<script>
	const lastUpdated = 'May 22, 2025';
	const appName = 'Pocket Dating Coach';
	const contactEmail = 'privacy@pocketdatingcoach.com';
	const appUrl = 'https://verified-vibe.vercel.app';
</script>

<svelte:head>
	<title>Privacy Policy – Pocket Dating Coach</title>
	<meta name="description" content="Privacy Policy for Pocket Dating Coach" />
</svelte:head>

<main class="max-w-2xl mx-auto px-6 py-12 text-gray-800 font-sans">
	<h1 class="text-3xl font-bold mb-2">{appName}</h1>
	<h2 class="text-xl font-semibold text-gray-500 mb-1">Privacy Policy</h2>
	<p class="text-sm text-gray-400 mb-10">Last updated: {lastUpdated}</p>

	<section class="mb-8">
		<p>
			This Privacy Policy describes how {appName} ("we", "us", or "our") collects, uses, and shares
			information about you when you use our mobile application and website (collectively, the "Service").
			By using the Service, you agree to the collection and use of information in accordance with this policy.
		</p>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">1. Information We Collect</h3>
		<p class="mb-3">We collect the following types of information:</p>
		<ul class="list-disc pl-6 space-y-2">
			<li>
				<strong>Account information:</strong> Name, email address, and password when you register an account.
			</li>
			<li>
				<strong>Profile information:</strong> Photos, age, gender, preferences, and other details you provide to build your dating profile.
			</li>
			<li>
				<strong>Content you submit:</strong> Messages, chat history, and responses you enter while using AI coaching features.
			</li>
			<li>
				<strong>Device information:</strong> Device token for delivering push notifications.
			</li>
			<li>
				<strong>Usage data:</strong> App interactions, features accessed, and session activity.
			</li>
		</ul>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">2. How We Use Your Information</h3>
		<ul class="list-disc pl-6 space-y-2">
			<li>To provide and operate the Service, including AI-powered coaching and profile features.</li>
			<li>To send push notifications relevant to your activity (only with your permission).</li>
			<li>To improve and personalise your experience over time.</li>
			<li>To respond to support requests and communicate with you about the Service.</li>
			<li>To comply with legal obligations.</li>
		</ul>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">3. Third-Party Services</h3>
		<p class="mb-3">We use the following third-party services to operate the app:</p>
		<ul class="list-disc pl-6 space-y-2">
			<li>
				<strong>Supabase</strong> — database and authentication. Your data is stored securely on Supabase-managed infrastructure.
			</li>
			<li>
				<strong>Anthropic Claude</strong> — AI language model used to power coaching responses. Content you submit may be processed by Anthropic's API.
			</li>
			<li>
				<strong>Firebase (Google)</strong> — push notification delivery. Your device token is registered with Firebase Cloud Messaging.
			</li>
			<li>
				<strong>Vercel</strong> — hosting and serving the application.
			</li>
		</ul>
		<p class="mt-3">
			Each third party has its own privacy policy governing their use of data. We do not sell your personal information to third parties.
		</p>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">4. Data Retention</h3>
		<p>
			We retain your data for as long as your account is active. If you request account deletion,
			we will delete your personal data within 30 days, except where we are required to retain it
			by law.
		</p>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">5. Your Rights</h3>
		<p class="mb-3">You have the right to:</p>
		<ul class="list-disc pl-6 space-y-2">
			<li>Access the personal data we hold about you.</li>
			<li>Request correction of inaccurate data.</li>
			<li>Request deletion of your account and associated data.</li>
			<li>Withdraw consent for push notifications at any time via your device settings.</li>
		</ul>
		<p class="mt-3">
			To exercise any of these rights, contact us at
			<a href="mailto:{contactEmail}" class="text-pink-500 underline">{contactEmail}</a>.
		</p>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">6. Security</h3>
		<p>
			We use industry-standard security measures including encrypted connections (HTTPS) and
			access controls. However, no method of transmission over the internet is 100% secure.
		</p>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">7. Children's Privacy</h3>
		<p>
			The Service is intended for users aged 18 and over. We do not knowingly collect personal
			information from anyone under 18. If you believe a minor has provided us with personal data,
			please contact us and we will delete it promptly.
		</p>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">8. Changes to This Policy</h3>
		<p>
			We may update this Privacy Policy from time to time. We will notify you of any significant
			changes by posting the new policy on this page and updating the "Last updated" date.
			Continued use of the Service after changes constitutes acceptance of the updated policy.
		</p>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">9. Contact Us</h3>
		<p>
			If you have any questions about this Privacy Policy, please contact us at:<br />
			<a href="mailto:{contactEmail}" class="text-pink-500 underline">{contactEmail}</a>
		</p>
	</section>
</main>

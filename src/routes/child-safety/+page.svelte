<script module>
	// Prerendered on the web build; skipped on the mobile SPA build (ssr disabled,
	// so prerender must be off to avoid a prerender-without-ssr conflict).
	export const prerender = import.meta.env.VITE_MOBILE !== 'true';
</script>

<script>
	const lastUpdated = 'May 23, 2026';
	const appName = 'Pocket Dating Coach';
	const contactEmail = 'safety@pocketdatingcoach.com';
</script>

<svelte:head>
	<title>Child Safety Standards – Pocket Dating Coach</title>
	<meta name="description" content="Child Safety Standards for Pocket Dating Coach" />
</svelte:head>

<main class="max-w-2xl mx-auto px-6 py-12 text-gray-800 font-sans">
	<h1 class="text-3xl font-bold mb-2">{appName}</h1>
	<h2 class="text-xl font-semibold text-gray-500 mb-1">Child Safety Standards</h2>
	<p class="text-sm text-gray-400 mb-10">Last updated: {lastUpdated}</p>

	<section class="mb-8">
		<p>
			{appName} is committed to the safety of children and strictly prohibits any content or behaviour
			that sexually exploits or endangers minors. This page outlines our standards against
			Child Sexual Abuse and Exploitation (CSAE).
		</p>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">1. Age Requirement</h3>
		<p>
			{appName} is strictly intended for users aged 18 and over. We do not knowingly allow minors
			to create accounts or access any part of the Service. Users who are found to be under 18
			will have their accounts immediately terminated.
		</p>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">2. Zero Tolerance for CSAE</h3>
		<p class="mb-3">
			{appName} has a zero-tolerance policy for child sexual abuse and exploitation (CSAE).
			The following content and behaviour is strictly prohibited on our platform:
		</p>
		<ul class="list-disc pl-6 space-y-2">
			<li>Any content that sexually exploits, abuses, or endangers minors</li>
			<li>Child Sexual Abuse Material (CSAM) of any kind</li>
			<li>Grooming, solicitation, or any attempt to exploit minors</li>
			<li>Any communication that sexualises individuals under the age of 18</li>
			<li>Sharing, distributing, or linking to CSAE content</li>
		</ul>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">3. Enforcement</h3>
		<p class="mb-3">
			We take immediate action against any violation of these standards:
		</p>
		<ul class="list-disc pl-6 space-y-2">
			<li>Accounts involved in CSAE violations are permanently banned without appeal</li>
			<li>We report confirmed CSAE content to the National Center for Missing and Exploited Children (NCMEC) and relevant law enforcement authorities</li>
			<li>We cooperate fully with law enforcement investigations involving child safety</li>
			<li>We preserve and provide evidence when required by legal process</li>
		</ul>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">4. Reporting</h3>
		<p>
			If you encounter any content or behaviour on {appName} that you believe violates these
			child safety standards, please report it immediately to us at:
			<a href="mailto:{contactEmail}" class="text-pink-500 underline">{contactEmail}</a>
		</p>
		<p class="mt-3">
			Reports are reviewed promptly. Where CSAE content is confirmed, we will report it to
			NCMEC via the CyberTipline at <a href="https://www.missingkids.org/gethelpnow/cybertipline" class="text-pink-500 underline" target="_blank" rel="noopener noreferrer">missingkids.org</a>.
		</p>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">5. Content Moderation</h3>
		<p>
			All user-uploaded photos are subject to review. We use automated and manual moderation
			to detect and remove content that violates our child safety standards. Users found
			uploading prohibited content are immediately removed from the platform.
		</p>
	</section>

	<section class="mb-8">
		<h3 class="text-lg font-semibold mb-3">6. Contact</h3>
		<p>
			For any questions or concerns regarding our child safety standards, contact us at:<br />
			<a href="mailto:{contactEmail}" class="text-pink-500 underline">{contactEmail}</a>
		</p>
	</section>
</main>

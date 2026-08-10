import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { testMetaCapi } from '$lib/server/capi-diagnostics';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';

/**
 * GET /admin/analytics/capi-test?code=TEST12345
 *
 * Asks Meta whether the META_CAPI_TOKEN in this environment actually works, and
 * reports the verbatim answer.
 *
 * Exists because that token is a user token extended to ~60 days, so it gets
 * replaced several times a year, and every rotation can silently paste the wrong
 * string — Meta's debugger shows the short-lived token above the extended one and
 * they are visually identical. The alternative to this endpoint is waiting hours
 * for a real store tap and inferring the answer from `meta_forwarded`, which tests
 * the credential by spending ad budget.
 *
 * `code` is required: every event is sent with test_event_code so it lands in the
 * Test Events tab rather than the dataset that trains delivery. Defaulting it
 * would mean a diagnostic that quietly pollutes optimisation data — the same
 * mistake as the developer traffic this codebase already had to gate out.
 * Get the current code from Events Manager → Test Events.
 *
 * Lives under /admin because ADMIN_COOKIE is scoped to `path: '/admin'` and is
 * never sent anywhere else. An identical endpoint under /api answered 401 to a
 * logged-in admin for exactly that reason.
 */

const CODE_PATTERN = /^TEST[A-Za-z0-9]{1,32}$/;

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}

	const code = url.searchParams.get('code') ?? '';
	if (!CODE_PATTERN.test(code)) {
		return json(
			{
				error: 'missing_test_event_code',
				hint: 'Pass ?code=TEST##### from Events Manager → Test Events. Required so the probe cannot reach optimisation data.'
			},
			{ status: 400 }
		);
	}

	const result = await testMetaCapi(code);
	// 200 regardless of the verdict: the request succeeded, and the verdict is the
	// payload. A non-2xx here would be read as "the diagnostic is broken".
	return json(result);
};

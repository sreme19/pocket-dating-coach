/**
 * Notification payload construction and delivery utilities for FCM push notifications.
 * Builds payloads conforming to FCM format with platform constraints enforced,
 * and sends them to FCM with invalid token cleanup.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 5.6
 */

import { env } from '$env/dynamic/private';
import { getSupabase } from '$lib/server/supabase';

/** Maximum allowed characters for notification title */
export const MAX_TITLE_LENGTH = 65;

/** Maximum allowed characters for notification body */
export const MAX_BODY_LENGTH = 240;

/**
 * Valid notification type discriminators.
 *
 * This list is a gate, not documentation: buildNotificationPayload rejects
 * anything absent from it. Three of the app's most important events were calling
 * a console.log mock in $lib/verified-vibe/server/notifications and would have
 * been rejected here too — hence the additions below.
 */
export const NOTIFICATION_TYPES = [
	'conversation_reminder',
	'follow_up_prompt',
	'profile_tip',
	'secret_admirer',
	'craving_attention',
	/** A new mutual match. Previously sent to the mock and never delivered. */
	'new_match',
	/** Async advisor work the user asked for has finished. */
	'advisor_task_ready',
	/** Proactive coaching insight — the type the daily cap governs. */
	'advisor_insight',
	/** Final-hours warning on the 48h hand-off window. Spec asks for exactly one. */
	'handoff_nudge',
	/** A competitive-intelligence report finished generating. */
	'intelligence_report'
] as const;

/** Union type for notification categories */
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Input parameters for building a notification payload */
export interface BuildNotificationPayloadParams {
	token: string;
	title: string;
	body: string;
	type: NotificationType;
	deepLink?: string;
}

/** The constructed FCM notification payload */
export interface NotificationPayload {
	to: string;
	notification: {
		title: string;
		body: string;
	};
	data: {
		type: NotificationType;
		deepLink?: string;
	};
}

/**
 * Truncates a string to the specified maximum length.
 */
function truncate(value: string, maxLength: number): string {
	if (value.length > maxLength) {
		return value.slice(0, maxLength);
	}
	return value;
}

/**
 * Validates that a deep link is a relative path starting with `/`.
 * Returns the validated deep link or throws if invalid.
 */
function validateDeepLink(deepLink: string): string {
	if (!deepLink.startsWith('/')) {
		throw new Error(`deepLink must be a relative path starting with "/", received: "${deepLink}"`);
	}
	return deepLink;
}

/**
 * Builds a notification payload conforming to FCM format.
 *
 * - Title is truncated to 65 characters if exceeded
 * - Body is truncated to 240 characters if exceeded
 * - Type must be one of: conversation_reminder, follow_up_prompt, profile_tip
 * - deepLink must start with `/` when provided
 *
 * @param params - The notification content parameters
 * @returns A structured FCM notification payload with both `notification` and `data` objects
 * @throws Error if type is invalid or deepLink doesn't start with `/`
 */
export function buildNotificationPayload(params: BuildNotificationPayloadParams): NotificationPayload {
	const { token, title, body, type, deepLink } = params;

	// Validate token is provided
	if (!token) {
		throw new Error('FCM device token is required');
	}

	// Validate type discriminator
	if (!NOTIFICATION_TYPES.includes(type)) {
		throw new Error(
			`Invalid notification type "${type}". Must be one of: ${NOTIFICATION_TYPES.join(', ')}`
		);
	}

	// Validate deepLink format when provided
	if (deepLink !== undefined) {
		validateDeepLink(deepLink);
	}

	// Build payload with truncation applied
	const payload: NotificationPayload = {
		to: token,
		notification: {
			title: truncate(title, MAX_TITLE_LENGTH),
			body: truncate(body, MAX_BODY_LENGTH)
		},
		data: {
			type
		}
	};

	// Include deepLink in data object when applicable
	if (deepLink !== undefined) {
		payload.data.deepLink = deepLink;
	}

	return payload;
}


/** Result of a notification send attempt */
export interface SendNotificationResult {
	success: boolean;
	error?: string;
	tokenRemoved?: boolean;
}

// ─── FCM V1 API (OAuth2 + Service Account) ────────────────────────────────

/** Cached OAuth2 access token */
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

/**
 * Gets a Google OAuth2 access token for FCM V1 API using the service account.
 * Token is cached for 50 minutes (tokens last 60 min).
 */
async function getFcmAccessToken(): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	if (_cachedToken && now < _tokenExpiresAt) return _cachedToken;

	const raw = env.FCM_SERVICE_ACCOUNT;
	if (!raw) throw new Error('FCM_SERVICE_ACCOUNT env var not set');

	const sa = JSON.parse(raw) as { client_email: string; private_key: string };

	// Build JWT (RS256)
	const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
		.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
	const claimset = btoa(JSON.stringify({
		iss: sa.client_email,
		scope: 'https://www.googleapis.com/auth/firebase.messaging',
		aud: 'https://oauth2.googleapis.com/token',
		iat: now,
		exp: now + 3600,
	})).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

	const signingInput = `${header}.${claimset}`;

	// Sign with RSA-SHA256 using Node.js crypto
	const { createSign } = await import('crypto');
	const sign = createSign('RSA-SHA256');
	sign.update(signingInput);
	const sig = sign.sign(sa.private_key, 'base64')
		.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

	const jwt = `${signingInput}.${sig}`;

	// Exchange JWT for access token
	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt,
		}),
	});

	if (!res.ok) throw new Error(`OAuth2 token exchange failed: ${res.status}`);
	const data = await res.json() as { access_token: string };

	_cachedToken = data.access_token;
	_tokenExpiresAt = now + 3000; // cache for 50 min
	return _cachedToken;
}

/**
 * Sends a notification payload via FCM V1 API (HTTP v1).
 *
 * - Reads project_id from FCM_SERVICE_ACCOUNT env var
 * - Uses OAuth2 service account credentials (not legacy server key)
 * - Removes invalid tokens from device_tokens on UNREGISTERED error
 *
 * Requirements: 6.5, 5.6
 */
export async function sendNotification(payload: NotificationPayload): Promise<SendNotificationResult> {
	const raw = env.FCM_SERVICE_ACCOUNT;
	if (!raw) {
		return { success: false, error: 'FCM_SERVICE_ACCOUNT env var not configured' };
	}

	const supabase = getSupabase();
	const token = payload.to;

	// Verify token exists in DB (service role bypasses RLS)
	const { data: tokenRecord, error: lookupError } = await supabase
		.from('device_tokens')
		.select('id, token')
		.eq('token', token)
		.maybeSingle();

	if (lookupError) {
		return { success: false, error: `DB lookup failed: ${lookupError.message}` };
	}
	if (!tokenRecord) {
		return { success: false, error: 'Token not found in device_tokens' };
	}

	let accessToken: string;
	try {
		accessToken = await getFcmAccessToken();
	} catch (e) {
		return { success: false, error: `Auth failed: ${e instanceof Error ? e.message : String(e)}` };
	}

	const { project_id } = JSON.parse(raw) as { project_id: string };
	const url = `https://fcm.googleapis.com/v1/projects/${project_id}/messages:send`;

	// FCM V1 payload format
	const body = {
		message: {
			token,
			notification: payload.notification,
			data: Object.fromEntries(
				Object.entries(payload.data).map(([k, v]) => [k, String(v ?? '')])
			),
		},
	};

	let fcmRes: Response;
	try {
		fcmRes = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(body),
		});
	} catch (e) {
		return { success: false, error: `FCM request failed: ${e instanceof Error ? e.message : String(e)}` };
	}

	if (fcmRes.ok) return { success: true };

	const errBody = await fcmRes.json().catch(() => ({})) as { error?: { details?: Array<{ errorCode?: string }> } };
	const errCode = errBody?.error?.details?.[0]?.errorCode ?? '';

	// Remove stale/invalid tokens
	if (fcmRes.status === 404 || errCode === 'UNREGISTERED') {
		await supabase.from('device_tokens').delete().eq('token', token);
		return { success: false, error: 'Token unregistered — removed from DB', tokenRemoved: true };
	}

	return { success: false, error: `FCM V1 error ${fcmRes.status}: ${errCode || fcmRes.statusText}` };
}

// ── Per-user delivery ────────────────────────────────────────────────────────

/**
 * Send one notification to every device a user has registered, subject to the
 * notification budget.
 *
 * Two gaps this closes.
 *
 * First, `sendNotification` takes a single token, so every existing call site
 * hand-rolls a `.limit(1)` / `.maybeSingle()` lookup — meaning a user with both an
 * Android phone and an iPad gets told on whichever row came back first. Roughly a
 * third of registered users are on iOS, so that is not a rounding error.
 *
 * Second, nothing consulted quiet hours or a cap, because neither existed.
 *
 * Returns what happened rather than throwing: notification delivery is never
 * allowed to fail the operation that triggered it.
 */
export async function sendToUser(
	userId: string,
	opts: {
		title: string;
		body: string;
		type: NotificationType;
		deepLink?: string;
		/** Skip the budget for a genuinely unmissable send. Use sparingly. */
		force?: boolean;
	}
): Promise<{ sent: number; skipped: string | null }> {
	const supabase = getSupabase();

	if (!opts.force) {
		const { checkBudget } = await import('$lib/server/notification-budget');
		const decision = await checkBudget(supabase, userId, opts.type);
		if (!decision.allowed) return { sent: 0, skipped: decision.reason };
	}

	const { data: tokens } = await supabase
		.from('device_tokens')
		.select('token')
		.eq('user_id', userId);

	const rows = (tokens ?? []) as Array<{ token: string }>;
	if (rows.length === 0) return { sent: 0, skipped: 'no_token' };

	let sent = 0;
	for (const { token } of rows) {
		try {
			// buildNotificationPayload THROWS on an unknown type or a deepLink that
			// isn't a relative path — both are programming errors, so they must not
			// take down the caller that triggered this notification.
			const payload = buildNotificationPayload({
				token,
				title: opts.title,
				body: opts.body,
				type: opts.type,
				deepLink: opts.deepLink
			});
			const result = await sendNotification(payload);
			if (result.success) sent++;
			else console.warn(`[notifications] ${opts.type} send failed:`, result.error);
		} catch (e) {
			console.error(`[notifications] invalid ${opts.type} payload:`, e);
		}
	}

	// Log once per notification, not once per device — the cap counts messages the
	// person received, and they only perceive one.
	if (sent > 0) {
		const { logNotification } = await import('$lib/server/notification-budget');
		await logNotification(supabase, userId, opts.type, { title: opts.title });
	}

	return { sent, skipped: sent === 0 ? 'all_sends_failed' : null };
}

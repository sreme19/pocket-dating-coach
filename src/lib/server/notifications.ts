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

/** Valid notification type discriminators */
export const NOTIFICATION_TYPES = [
	'conversation_reminder',
	'follow_up_prompt',
	'profile_tip'
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


/** FCM error codes that indicate an invalid/expired token */
const INVALID_TOKEN_ERRORS = ['NotRegistered', 'InvalidRegistration', 'MismatchSenderId'] as const;

/** Result of a notification send attempt */
export interface SendNotificationResult {
	success: boolean;
	error?: string;
	tokenRemoved?: boolean;
}

/** FCM legacy HTTP API response structure */
interface FcmResponse {
	multicast_id: number;
	success: number;
	failure: number;
	results: Array<{
		message_id?: string;
		error?: string;
	}>;
}

/**
 * Sends a notification payload to FCM HTTP API.
 *
 * - Only sends to tokens that exist in the device_tokens table
 * - On FCM delivery failure due to invalid token (NotRegistered, InvalidRegistration),
 *   removes the token from the database
 * - Returns success/failure status with optional error details
 *
 * Requirements: 6.5, 5.6
 *
 * @param payload - A pre-built FCM notification payload (from buildNotificationPayload)
 * @returns Result indicating success/failure and whether the token was removed
 */
export async function sendNotification(payload: NotificationPayload): Promise<SendNotificationResult> {
	const fcmServerKey = env.FCM_SERVER_KEY;

	if (!fcmServerKey) {
		return {
			success: false,
			error: 'FCM_SERVER_KEY environment variable is not configured'
		};
	}

	const supabase = getSupabase();
	const token = payload.to;

	// Verify the token exists in storage and is not flagged invalid
	const { data: tokenRecord, error: lookupError } = await supabase
		.from('device_tokens')
		.select('id, token')
		.eq('token', token)
		.maybeSingle();

	if (lookupError) {
		return {
			success: false,
			error: `Failed to verify token in database: ${lookupError.message}`
		};
	}

	if (!tokenRecord) {
		return {
			success: false,
			error: 'Token does not exist in storage or has been flagged invalid'
		};
	}

	// Send to FCM HTTP API (legacy endpoint)
	let fcmResponse: Response;
	try {
		fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `key=${fcmServerKey}`
			},
			body: JSON.stringify(payload)
		});
	} catch (fetchError) {
		return {
			success: false,
			error: `FCM request failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
		};
	}

	if (!fcmResponse.ok) {
		return {
			success: false,
			error: `FCM API returned HTTP ${fcmResponse.status}: ${fcmResponse.statusText}`
		};
	}

	// Parse FCM response
	let responseBody: FcmResponse;
	try {
		responseBody = await fcmResponse.json();
	} catch {
		return {
			success: false,
			error: 'Failed to parse FCM response'
		};
	}

	// Check for delivery failures
	if (responseBody.failure > 0 && responseBody.results?.length > 0) {
		const result = responseBody.results[0];

		if (result.error && INVALID_TOKEN_ERRORS.includes(result.error as typeof INVALID_TOKEN_ERRORS[number])) {
			// Token is invalid — remove from database
			await supabase
				.from('device_tokens')
				.delete()
				.eq('token', token);

			return {
				success: false,
				error: `FCM delivery failed: ${result.error}`,
				tokenRemoved: true
			};
		}

		return {
			success: false,
			error: `FCM delivery failed: ${result.error || 'Unknown error'}`
		};
	}

	return { success: true };
}

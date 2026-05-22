import { PushNotifications } from '@capacitor/push-notifications';
import type { PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { goto } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { getSupabaseClient } from '$lib/client/supabase';

/**
 * Platform type for device token registration.
 * Supports both Android and iOS for future extensibility.
 */
export type PushPlatform = 'android' | 'ios';

/**
 * Local storage key used to track whether push notification
 * permissions have already been requested (to avoid re-prompting).
 */
const PERMISSION_REQUESTED_KEY = 'push_permission_requested';

/**
 * Local storage key for the stored FCM device token.
 */
const DEVICE_TOKEN_KEY = 'push_device_token';

/**
 * Determines the current platform identifier for token registration.
 */
function getCurrentPlatform(): PushPlatform {
	const platform = Capacitor.getPlatform();
	return platform === 'ios' ? 'ios' : 'android';
}

/**
 * Checks whether push notifications are supported on the current platform.
 * Push notifications are only available on native platforms (not web).
 */
function isPushSupported(): boolean {
	return Capacitor.isNativePlatform();
}

/**
 * Requests push notification permissions from the user.
 * Only requests on first launch after install (checks localStorage flag).
 * If permission was previously denied, does not re-prompt.
 *
 * @returns true if permissions are granted, false otherwise
 */
export async function requestPushPermissions(): Promise<boolean> {
	if (!isPushSupported()) {
		console.log('[Push] Not on native platform, skipping permission request');
		return false;
	}

	// Check if we've already requested permissions (don't re-prompt on denial)
	const alreadyRequested = localStorage.getItem(PERMISSION_REQUESTED_KEY);
	if (alreadyRequested === 'true') {
		// Check current permission status without re-prompting
		const status = await PushNotifications.checkPermissions();
		return status.receive === 'granted';
	}

	try {
		const result = await PushNotifications.requestPermissions();
		// Mark that we've requested permissions (won't re-prompt)
		localStorage.setItem(PERMISSION_REQUESTED_KEY, 'true');

		if (result.receive === 'granted') {
			console.log('[Push] Notification permissions granted');
			return true;
		} else {
			console.log('[Push] Notification permissions denied, continuing without notifications');
			return false;
		}
	} catch (error) {
		console.error('[Push] Error requesting permissions:', error);
		localStorage.setItem(PERMISSION_REQUESTED_KEY, 'true');
		return false;
	}
}

/**
 * Registers the device with FCM and sets up token event listeners.
 * On successful registration, forwards the token to the backend API.
 * On failure, logs the error and continues without notifications.
 */
export async function registerForPushNotifications(): Promise<void> {
	if (!isPushSupported()) {
		console.log('[Push] Not on native platform, skipping registration');
		return;
	}

	try {
		// Set up registration success listener
		await PushNotifications.addListener('registration', async (token) => {
			console.log('[Push] Registration successful, token received');
			localStorage.setItem(DEVICE_TOKEN_KEY, token.value);
			await sendTokenToBackend(token.value);
		});

		// Set up registration error listener
		await PushNotifications.addListener('registrationError', (error) => {
			console.error('[Push] Registration failed:', error);
			// Continue without notifications — app should work fine without them
		});

		// Trigger the registration with FCM
		await PushNotifications.register();
	} catch (error) {
		console.error('[Push] Error during registration setup:', error);
		// Continue without notifications
	}
}

/**
 * Sends the FCM device token to the backend API for storage.
 * Associates the token with the currently authenticated user.
 * If the user is not authenticated, skips the registration silently.
 *
 * @param token - The FCM device token string
 */
async function sendTokenToBackend(token: string): Promise<void> {
	try {
		const supabase = getSupabaseClient();
		const { data: { session } } = await supabase.auth.getSession();

		if (!session?.user) {
			console.log('[Push] No authenticated user, skipping token registration with backend');
			return;
		}

		const response = await fetch('/api/push/register', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${session.access_token}`
			},
			body: JSON.stringify({
				token,
				platform: getCurrentPlatform()
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			console.error('[Push] Failed to register token with backend:', response.status, errorData);
			return;
		}

		console.log('[Push] Token registered with backend successfully');
	} catch (error) {
		console.error('[Push] Error sending token to backend:', error);
		// Continue without backend registration — will retry on next launch
	}
}

/**
 * Handles a foreground push notification by displaying an in-app banner.
 * Uses svelte-sonner toast to show the notification title and body.
 * The banner includes badge and sound presentation as configured in Capacitor config.
 *
 * @param notification - The push notification received while app is in foreground
 */
function handleForegroundNotification(notification: PushNotificationSchema): void {
	const title = notification.title || 'New Notification';
	const body = notification.body || '';

	console.log('[Push] Foreground notification received:', title, body);

	// Display in-app banner using svelte-sonner toast
	toast(title, {
		description: body,
		duration: 5000,
		action: notification.data?.deepLink
			? {
					label: 'View',
					onClick: () => {
						goto(notification.data.deepLink);
					}
				}
			: undefined
	});
}

/**
 * Handles a notification tap (action performed).
 * If the notification contains a deepLink in its data payload, navigates the WebView to that route.
 * If no deepLink is present, the app is simply brought to the foreground (default native behavior).
 *
 * @param action - The action performed on the notification (tap)
 */
function handleNotificationTap(action: ActionPerformed): void {
	const notification = action.notification;
	const deepLink = notification.data?.deepLink;

	console.log('[Push] Notification tap action performed:', action.actionId);

	if (deepLink && typeof deepLink === 'string' && deepLink.startsWith('/')) {
		// Navigate to the deep link route
		console.log('[Push] Navigating to deep link:', deepLink);
		goto(deepLink);
	} else {
		// No deep link — app is brought to foreground by default (native behavior)
		// No additional action needed
		console.log('[Push] No deep link, app brought to foreground');
	}
}

/**
 * Sets up listeners for incoming push notifications and notification taps.
 * - Foreground notifications: displayed as in-app banners via toast
 * - Background notifications: handled natively by the system (no code needed)
 * - Notification taps with deepLink: navigate WebView to the specified route
 * - Notification taps without deepLink: bring app to foreground (default behavior)
 */
export async function setupNotificationListeners(): Promise<void> {
	if (!isPushSupported()) {
		console.log('[Push] Not on native platform, skipping notification listeners');
		return;
	}

	try {
		// Handle foreground notifications: display in-app banner
		await PushNotifications.addListener(
			'pushNotificationReceived',
			(notification: PushNotificationSchema) => {
				handleForegroundNotification(notification);
			}
		);

		// Handle notification taps (from foreground or background)
		await PushNotifications.addListener(
			'pushNotificationActionPerformed',
			(action: ActionPerformed) => {
				handleNotificationTap(action);
			}
		);

		console.log('[Push] Notification listeners set up successfully');
	} catch (error) {
		console.error('[Push] Error setting up notification listeners:', error);
	}
}

/**
 * Initializes push notifications on app launch.
 * Requests permissions on first launch, then registers with FCM.
 * Sets up notification event listeners for foreground and tap handling.
 * This is the main entry point to call during app initialization.
 *
 * IMPORTANT: This function MUST be called on EVERY app launch to handle
 * token rotation. FCM tokens can change at any time, and re-registering
 * ensures the backend always has the current valid token (Requirement 5.3).
 * The backend upserts the token, so repeated calls are safe.
 *
 * Flow:
 * 1. Check if native platform (skip on web)
 * 2. Set up notification listeners (foreground display + tap handling)
 * 3. Request permissions (only prompts on first launch after install; subsequent launches check status)
 * 4. If granted, register with FCM (gets current token, handles rotation)
 * 5. On token received, forward to backend with user ID (upserts existing record)
 */
export async function initializePushNotifications(): Promise<void> {
	if (!isPushSupported()) {
		return;
	}

	// Set up notification listeners before registration
	// so we don't miss any notifications that arrive immediately
	await setupNotificationListeners();

	const permissionGranted = await requestPushPermissions();

	if (permissionGranted) {
		await registerForPushNotifications();
	} else {
		console.log('[Push] Permissions not granted, skipping FCM registration');
	}
}

/**
 * Removes the device token from the backend and clears local storage.
 * Should be called when the user logs out.
 */
export async function unregisterPushNotifications(): Promise<void> {
	if (!isPushSupported()) {
		// Even on non-native platforms, clear session data on logout
		clearSessionData();
		return;
	}

	try {
		const supabase = getSupabaseClient();
		const { data: { session } } = await supabase.auth.getSession();

		if (session?.user) {
			await fetch('/api/push/unregister', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${session.access_token}`
				},
				body: JSON.stringify({
					platform: getCurrentPlatform()
				})
			});
		}
	} catch (error) {
		console.error('[Push] Error unregistering token from backend:', error);
	}

	// Clear local token regardless of backend success
	localStorage.removeItem(DEVICE_TOKEN_KEY);

	// Remove all listeners
	try {
		await PushNotifications.removeAllListeners();
	} catch (error) {
		console.error('[Push] Error removing listeners:', error);
	}

	// Clear all WebView session data (cookies, localStorage, sessionStorage)
	clearSessionData();

	console.log('[Push] Unregistered and cleaned up');
}

/**
 * Clears all WebView session data: cookies, localStorage, and sessionStorage.
 * Called during logout to ensure no authentication tokens or user data persist.
 * This satisfies Requirements 4.10, 11.5 (clear WebView cookies, local storage,
 * session storage, and cached authentication tokens on logout).
 */
export function clearSessionData(): void {
	try {
		// Clear all cookies by setting them to expire in the past
		const cookies = document.cookie.split(';');
		for (const cookie of cookies) {
			const name = cookie.split('=')[0].trim();
			if (name) {
				document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
				// Also clear with domain variations for subdomains
				document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
			}
		}
		console.log('[Push] Cookies cleared');
	} catch (error) {
		console.error('[Push] Error clearing cookies:', error);
	}

	try {
		// Clear localStorage (removes all stored data including auth tokens)
		localStorage.clear();
		console.log('[Push] localStorage cleared');
	} catch (error) {
		console.error('[Push] Error clearing localStorage:', error);
	}

	try {
		// Clear sessionStorage
		sessionStorage.clear();
		console.log('[Push] sessionStorage cleared');
	} catch (error) {
		console.error('[Push] Error clearing sessionStorage:', error);
	}
}

/**
 * Gets the currently stored device token, if any.
 */
export function getStoredToken(): string | null {
	return localStorage.getItem(DEVICE_TOKEN_KEY);
}

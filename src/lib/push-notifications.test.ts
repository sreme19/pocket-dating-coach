import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for push notification event handlers (Task 4.2)
 *
 * Validates: Requirements 4.4, 4.5, 4.6, 4.7
 * - Foreground notifications: display in-app banner with title, body
 * - Background notifications: system notification tray (native default, no code needed)
 * - Notification tap with deep link: navigate to deepLink route
 * - Notification tap without deep link: bring app to foreground (default behavior)
 */

// Mock Capacitor modules
const mockAddListener = vi.fn().mockResolvedValue({ remove: vi.fn() });
const mockRemoveAllListeners = vi.fn().mockResolvedValue(undefined);
const mockRegister = vi.fn().mockResolvedValue(undefined);
const mockCheckPermissions = vi.fn().mockResolvedValue({ receive: 'granted' });
const mockRequestPermissions = vi.fn().mockResolvedValue({ receive: 'granted' });

vi.mock('@capacitor/push-notifications', () => ({
	PushNotifications: {
		addListener: (...args: any[]) => mockAddListener(...args),
		removeAllListeners: () => mockRemoveAllListeners(),
		register: () => mockRegister(),
		checkPermissions: () => mockCheckPermissions(),
		requestPermissions: () => mockRequestPermissions()
	}
}));

vi.mock('@capacitor/core', () => ({
	Capacitor: {
		isNativePlatform: () => true,
		getPlatform: () => 'android'
	}
}));

// Mock svelte-sonner toast
const mockToast = vi.fn();
vi.mock('svelte-sonner', () => ({
	toast: (...args: any[]) => mockToast(...args)
}));

// Mock goto from $app/navigation
const mockGoto = vi.fn().mockResolvedValue(undefined);
vi.mock('$app/navigation', () => ({
	goto: (...args: any[]) => mockGoto(...args)
}));

// Mock supabase client
vi.mock('$lib/client/supabase', () => ({
	getSupabaseClient: () => ({
		auth: {
			getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-123' }, access_token: 'token-abc' } } })
		}
	})
}));

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; })
	};
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });

describe('Push Notification Event Handlers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorageMock.clear();
	});

	describe('setupNotificationListeners', () => {
		it('should register pushNotificationReceived listener', async () => {
			const { setupNotificationListeners } = await import('./push-notifications');

			await setupNotificationListeners();

			expect(mockAddListener).toHaveBeenCalledWith(
				'pushNotificationReceived',
				expect.any(Function)
			);
		});

		it('should register pushNotificationActionPerformed listener', async () => {
			const { setupNotificationListeners } = await import('./push-notifications');

			await setupNotificationListeners();

			expect(mockAddListener).toHaveBeenCalledWith(
				'pushNotificationActionPerformed',
				expect.any(Function)
			);
		});
	});

	describe('Foreground notification handling (Requirement 4.4)', () => {
		it('should display toast with notification title and body', async () => {
			const { setupNotificationListeners } = await import('./push-notifications');

			await setupNotificationListeners();

			// Get the foreground notification handler
			const foregroundCall = mockAddListener.mock.calls.find(
				(call) => call[0] === 'pushNotificationReceived'
			);
			expect(foregroundCall).toBeDefined();
			const handler = foregroundCall![1];

			// Simulate a foreground notification
			handler({
				id: 'notif-1',
				title: 'Time to follow up!',
				body: "It's been 2 days since your last message",
				data: { type: 'conversation_reminder' }
			});

			expect(mockToast).toHaveBeenCalledWith(
				'Time to follow up!',
				expect.objectContaining({
					description: "It's been 2 days since your last message",
					duration: 5000
				})
			);
		});

		it('should use default title when notification title is missing', async () => {
			const { setupNotificationListeners } = await import('./push-notifications');

			await setupNotificationListeners();

			const foregroundCall = mockAddListener.mock.calls.find(
				(call) => call[0] === 'pushNotificationReceived'
			);
			const handler = foregroundCall![1];

			handler({
				id: 'notif-2',
				data: { type: 'profile_tip' }
			});

			expect(mockToast).toHaveBeenCalledWith(
				'New Notification',
				expect.objectContaining({
					description: '',
					duration: 5000
				})
			);
		});

		it('should include View action when deepLink is present', async () => {
			const { setupNotificationListeners } = await import('./push-notifications');

			await setupNotificationListeners();

			const foregroundCall = mockAddListener.mock.calls.find(
				(call) => call[0] === 'pushNotificationReceived'
			);
			const handler = foregroundCall![1];

			handler({
				id: 'notif-3',
				title: 'New match!',
				body: 'Check out your new match',
				data: { type: 'follow_up_prompt', deepLink: '/verified-vibe/chat/123' }
			});

			expect(mockToast).toHaveBeenCalledWith(
				'New match!',
				expect.objectContaining({
					action: expect.objectContaining({
						label: 'View',
						onClick: expect.any(Function)
					})
				})
			);
		});

		it('should not include action when no deepLink is present', async () => {
			const { setupNotificationListeners } = await import('./push-notifications');

			await setupNotificationListeners();

			const foregroundCall = mockAddListener.mock.calls.find(
				(call) => call[0] === 'pushNotificationReceived'
			);
			const handler = foregroundCall![1];

			handler({
				id: 'notif-4',
				title: 'Profile tip',
				body: 'Try adding more photos',
				data: { type: 'profile_tip' }
			});

			expect(mockToast).toHaveBeenCalledWith(
				'Profile tip',
				expect.objectContaining({
					action: undefined
				})
			);
		});
	});

	describe('Notification tap with deep link (Requirement 4.6)', () => {
		it('should navigate to deepLink route when notification is tapped', async () => {
			const { setupNotificationListeners } = await import('./push-notifications');

			await setupNotificationListeners();

			// Get the action performed handler
			const tapCall = mockAddListener.mock.calls.find(
				(call) => call[0] === 'pushNotificationActionPerformed'
			);
			expect(tapCall).toBeDefined();
			const handler = tapCall![1];

			// Simulate notification tap with deep link
			handler({
				actionId: 'tap',
				notification: {
					id: 'notif-5',
					title: 'New message',
					body: 'You have a new message',
					data: { type: 'conversation_reminder', deepLink: '/verified-vibe/chat/456' }
				}
			});

			expect(mockGoto).toHaveBeenCalledWith('/verified-vibe/chat/456');
		});

		it('should only navigate for deepLinks starting with /', async () => {
			const { setupNotificationListeners } = await import('./push-notifications');

			await setupNotificationListeners();

			const tapCall = mockAddListener.mock.calls.find(
				(call) => call[0] === 'pushNotificationActionPerformed'
			);
			const handler = tapCall![1];

			// Simulate notification tap with invalid deep link (not starting with /)
			handler({
				actionId: 'tap',
				notification: {
					id: 'notif-6',
					title: 'Test',
					body: 'Test body',
					data: { type: 'profile_tip', deepLink: 'https://malicious.com/phish' }
				}
			});

			expect(mockGoto).not.toHaveBeenCalled();
		});
	});

	describe('Notification tap without deep link (Requirement 4.7)', () => {
		it('should not navigate when no deepLink is present', async () => {
			const { setupNotificationListeners } = await import('./push-notifications');

			await setupNotificationListeners();

			const tapCall = mockAddListener.mock.calls.find(
				(call) => call[0] === 'pushNotificationActionPerformed'
			);
			const handler = tapCall![1];

			// Simulate notification tap without deep link
			handler({
				actionId: 'tap',
				notification: {
					id: 'notif-7',
					title: 'Reminder',
					body: 'Check back later',
					data: { type: 'follow_up_prompt' }
				}
			});

			// Should not navigate — app is brought to foreground by default
			expect(mockGoto).not.toHaveBeenCalled();
		});

		it('should not navigate when deepLink is empty string', async () => {
			const { setupNotificationListeners } = await import('./push-notifications');

			await setupNotificationListeners();

			const tapCall = mockAddListener.mock.calls.find(
				(call) => call[0] === 'pushNotificationActionPerformed'
			);
			const handler = tapCall![1];

			handler({
				actionId: 'tap',
				notification: {
					id: 'notif-8',
					title: 'Reminder',
					body: 'Check back later',
					data: { type: 'follow_up_prompt', deepLink: '' }
				}
			});

			expect(mockGoto).not.toHaveBeenCalled();
		});
	});

	describe('initializePushNotifications sets up listeners', () => {
		it('should set up notification listeners before registration', async () => {
			// Mark permissions as already requested
			localStorageMock.getItem.mockReturnValue('true');

			const { initializePushNotifications } = await import('./push-notifications');

			await initializePushNotifications();

			// Verify listeners were set up (pushNotificationReceived and pushNotificationActionPerformed)
			const listenerCalls = mockAddListener.mock.calls.map((call) => call[0]);
			expect(listenerCalls).toContain('pushNotificationReceived');
			expect(listenerCalls).toContain('pushNotificationActionPerformed');
		});
	});
});

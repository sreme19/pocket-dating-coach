import { describe, it, expect } from 'vitest';
import {
	buildNotificationPayload,
	MAX_TITLE_LENGTH,
	MAX_BODY_LENGTH,
	NOTIFICATION_TYPES,
	type NotificationType
} from './notifications';

const TEST_TOKEN = 'fcm-device-token-abc123';

describe('buildNotificationPayload', () => {
	it('should build a valid payload with all fields', () => {
		const result = buildNotificationPayload({
			token: TEST_TOKEN,
			title: 'Time to follow up!',
			body: "It's been 2 days since your last message to Sarah",
			type: 'conversation_reminder',
			deepLink: '/chat/123'
		});

		expect(result).toEqual({
			to: TEST_TOKEN,
			notification: {
				title: 'Time to follow up!',
				body: "It's been 2 days since your last message to Sarah"
			},
			data: {
				type: 'conversation_reminder',
				deepLink: '/chat/123'
			}
		});
	});

	it('should build a valid payload without deepLink', () => {
		const result = buildNotificationPayload({
			token: TEST_TOKEN,
			title: 'Profile tip',
			body: 'Try adding more photos to your profile',
			type: 'profile_tip'
		});

		expect(result).toEqual({
			to: TEST_TOKEN,
			notification: {
				title: 'Profile tip',
				body: 'Try adding more photos to your profile'
			},
			data: {
				type: 'profile_tip'
			}
		});
		expect(result.data.deepLink).toBeUndefined();
	});

	it('should truncate title exceeding 65 characters', () => {
		const longTitle = 'A'.repeat(100);
		const result = buildNotificationPayload({
			token: TEST_TOKEN,
			title: longTitle,
			body: 'Short body',
			type: 'follow_up_prompt'
		});

		expect(result.notification.title).toHaveLength(MAX_TITLE_LENGTH);
		expect(result.notification.title).toBe('A'.repeat(65));
	});

	it('should truncate body exceeding 240 characters', () => {
		const longBody = 'B'.repeat(300);
		const result = buildNotificationPayload({
			token: TEST_TOKEN,
			title: 'Title',
			body: longBody,
			type: 'conversation_reminder'
		});

		expect(result.notification.body).toHaveLength(MAX_BODY_LENGTH);
		expect(result.notification.body).toBe('B'.repeat(240));
	});

	it('should not truncate title at exactly 65 characters', () => {
		const exactTitle = 'C'.repeat(65);
		const result = buildNotificationPayload({
			token: TEST_TOKEN,
			title: exactTitle,
			body: 'Body',
			type: 'profile_tip'
		});

		expect(result.notification.title).toHaveLength(65);
		expect(result.notification.title).toBe(exactTitle);
	});

	it('should not truncate body at exactly 240 characters', () => {
		const exactBody = 'D'.repeat(240);
		const result = buildNotificationPayload({
			token: TEST_TOKEN,
			title: 'Title',
			body: exactBody,
			type: 'profile_tip'
		});

		expect(result.notification.body).toHaveLength(240);
		expect(result.notification.body).toBe(exactBody);
	});

	it('should accept all valid notification types', () => {
		for (const type of NOTIFICATION_TYPES) {
			const result = buildNotificationPayload({
				token: TEST_TOKEN,
				title: 'Test',
				body: 'Test body',
				type
			});
			expect(result.data.type).toBe(type);
		}
	});

	it('should throw for invalid notification type', () => {
		expect(() =>
			buildNotificationPayload({
				token: TEST_TOKEN,
				title: 'Test',
				body: 'Test body',
				type: 'invalid_type' as NotificationType
			})
		).toThrow('Invalid notification type');
	});

	it('should throw when deepLink does not start with /', () => {
		expect(() =>
			buildNotificationPayload({
				token: TEST_TOKEN,
				title: 'Test',
				body: 'Test body',
				type: 'conversation_reminder',
				deepLink: 'chat/123'
			})
		).toThrow('deepLink must be a relative path starting with "/"');
	});

	it('should accept deepLink starting with /', () => {
		const result = buildNotificationPayload({
			token: TEST_TOKEN,
			title: 'Test',
			body: 'Test body',
			type: 'follow_up_prompt',
			deepLink: '/conversations/abc'
		});

		expect(result.data.deepLink).toBe('/conversations/abc');
	});

	it('should always include both notification and data objects', () => {
		const result = buildNotificationPayload({
			token: TEST_TOKEN,
			title: 'Test',
			body: 'Test body',
			type: 'profile_tip'
		});

		expect(result).toHaveProperty('notification');
		expect(result).toHaveProperty('data');
		expect(result.notification).toHaveProperty('title');
		expect(result.notification).toHaveProperty('body');
		expect(result.data).toHaveProperty('type');
	});

	it('should include the token as the "to" field', () => {
		const result = buildNotificationPayload({
			token: 'my-specific-token',
			title: 'Test',
			body: 'Test body',
			type: 'profile_tip'
		});

		expect(result.to).toBe('my-specific-token');
	});

	it('should throw when token is empty', () => {
		expect(() =>
			buildNotificationPayload({
				token: '',
				title: 'Test',
				body: 'Test body',
				type: 'conversation_reminder'
			})
		).toThrow('FCM device token is required');
	});
});

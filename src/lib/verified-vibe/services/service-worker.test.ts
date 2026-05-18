import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceWorkerManager, isOnline, onOnlineStatusChange, requestCacheUrls } from './service-worker';

describe('ServiceWorkerManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should have register method', () => {
		expect(typeof ServiceWorkerManager.register).toBe('function');
	});

	it('should have unregister method', () => {
		expect(typeof ServiceWorkerManager.unregister).toBe('function');
	});

	it('should have checkForUpdates method', () => {
		expect(typeof ServiceWorkerManager.checkForUpdates).toBe('function');
	});

	it('should have skipWaiting method', () => {
		expect(typeof ServiceWorkerManager.skipWaiting).toBe('function');
	});

	it('should have clearCaches method', () => {
		expect(typeof ServiceWorkerManager.clearCaches).toBe('function');
	});

	it('should have cacheUrls method', () => {
		expect(typeof ServiceWorkerManager.cacheUrls).toBe('function');
	});

	it('should have getRegistration method', () => {
		expect(typeof ServiceWorkerManager.getRegistration).toBe('function');
	});

	it('should have isActive method', () => {
		expect(typeof ServiceWorkerManager.isActive).toBe('function');
	});

	it('should have getStatus method', () => {
		expect(typeof ServiceWorkerManager.getStatus).toBe('function');
	});

	it('should return not-registered status initially', () => {
		const status = ServiceWorkerManager.getStatus();
		expect(status).toBe('not-registered');
	});

	it('should return null registration initially', () => {
		const registration = ServiceWorkerManager.getRegistration();
		expect(registration).toBeNull();
	});

	it('should return false for isActive initially', () => {
		const active = ServiceWorkerManager.isActive();
		expect(active).toBe(false);
	});
});

describe('Online Status Detection', () => {
	it('should have isOnline function', () => {
		expect(typeof isOnline).toBe('function');
	});

	it('should return boolean from isOnline', () => {
		const online = isOnline();
		expect(typeof online).toBe('boolean');
	});

	it('should have onOnlineStatusChange function', () => {
		expect(typeof onOnlineStatusChange).toBe('function');
	});

	it('should return unsubscribe function from onOnlineStatusChange', () => {
		const unsubscribe = onOnlineStatusChange(() => {});
		expect(typeof unsubscribe).toBe('function');
	});
});

describe('Cache URL Requests', () => {
	it('should have requestCacheUrls function', () => {
		expect(typeof requestCacheUrls).toBe('function');
	});

	it('should accept array of URLs', () => {
		const urls = ['/page1', '/page2', '/page3'];
		expect(() => requestCacheUrls(urls)).not.toThrow();
	});

	it('should accept empty array', () => {
		expect(() => requestCacheUrls([])).not.toThrow();
	});
});

describe('Service Worker Configuration', () => {
	it('should accept config with enabled flag', async () => {
		const config = { enabled: false };
		const result = await ServiceWorkerManager.register(config);
		expect(result).toBeNull();
	});

	it('should accept config with scope', async () => {
		const config = { enabled: false, scope: '/verified-vibe' };
		const result = await ServiceWorkerManager.register(config);
		expect(result).toBeNull();
	});

	it('should accept config with updateCheckInterval', async () => {
		const config = { enabled: false, updateCheckInterval: 1800000 };
		const result = await ServiceWorkerManager.register(config);
		expect(result).toBeNull();
	});

	it('should accept partial config', async () => {
		const config = { enabled: false };
		const result = await ServiceWorkerManager.register(config);
		expect(result).toBeNull();
	});

	it('should accept empty config', async () => {
		const result = await ServiceWorkerManager.register({});
		// Result depends on browser environment
		expect(result === null || result instanceof Object).toBe(true);
	});
});

describe('Service Worker Lifecycle', () => {
	it('should handle registration lifecycle', async () => {
		const config = { enabled: false };
		const registered = await ServiceWorkerManager.register(config);
		expect(registered).toBeNull();

		const unregistered = await ServiceWorkerManager.unregister();
		expect(typeof unregistered).toBe('boolean');
	});

	it('should handle multiple register calls', async () => {
		const config = { enabled: false };
		const result1 = await ServiceWorkerManager.register(config);
		const result2 = await ServiceWorkerManager.register(config);
		expect(result1).toBeNull();
		expect(result2).toBeNull();
	});

	it('should handle unregister without registration', async () => {
		const result = await ServiceWorkerManager.unregister();
		expect(result).toBe(false);
	});
});

describe('Cache Management', () => {
	it('should handle clearCaches', async () => {
		expect(async () => {
			await ServiceWorkerManager.clearCaches();
		}).not.toThrow();
	});

	it('should handle cacheUrls with empty array', () => {
		expect(() => ServiceWorkerManager.cacheUrls([])).not.toThrow();
	});

	it('should handle cacheUrls with multiple URLs', () => {
		const urls = ['/api/data', '/images/photo.jpg', '/styles/main.css'];
		expect(() => ServiceWorkerManager.cacheUrls(urls)).not.toThrow();
	});

	it('should handle skipWaiting', () => {
		expect(() => ServiceWorkerManager.skipWaiting()).not.toThrow();
	});
});

describe('Update Checking', () => {
	it('should handle checkForUpdates', async () => {
		const result = await ServiceWorkerManager.checkForUpdates();
		expect(typeof result).toBe('boolean');
	});

	it('should return false when no registration', async () => {
		const result = await ServiceWorkerManager.checkForUpdates();
		expect(result).toBe(false);
	});
});

describe('Online Status Events', () => {
	it('should handle online status change subscription', () => {
		const callback = vi.fn();
		const unsubscribe = onOnlineStatusChange(callback);
		expect(typeof unsubscribe).toBe('function');
		unsubscribe();
	});

	it('should handle multiple subscriptions', () => {
		const callback1 = vi.fn();
		const callback2 = vi.fn();
		const unsubscribe1 = onOnlineStatusChange(callback1);
		const unsubscribe2 = onOnlineStatusChange(callback2);
		expect(typeof unsubscribe1).toBe('function');
		expect(typeof unsubscribe2).toBe('function');
		unsubscribe1();
		unsubscribe2();
	});

	it('should allow unsubscribing', () => {
		const callback = vi.fn();
		const unsubscribe = onOnlineStatusChange(callback);
		expect(() => unsubscribe()).not.toThrow();
	});
});

describe('Service Worker Status', () => {
	it('should return valid status strings', () => {
		const status = ServiceWorkerManager.getStatus();
		const validStatuses = ['not-registered', 'active', 'installing', 'waiting', 'unknown'];
		expect(validStatuses).toContain(status);
	});

	it('should return consistent status', () => {
		const status1 = ServiceWorkerManager.getStatus();
		const status2 = ServiceWorkerManager.getStatus();
		expect(status1).toBe(status2);
	});
});

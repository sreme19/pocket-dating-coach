/**
 * Service Worker Registration and Management
 */

import { Capacitor } from '@capacitor/core';

export interface ServiceWorkerConfig {
	enabled: boolean;
	scope: string;
	updateCheckInterval: number;
}

export class ServiceWorkerManager {
	private static registration: ServiceWorkerRegistration | null = null;
	private static updateCheckInterval: NodeJS.Timeout | null = null;

	/**
	 * Register service worker
	 */
	static async register(config: Partial<ServiceWorkerConfig> = {}): Promise<ServiceWorkerRegistration | null> {
		// Never register the PWA service worker inside the native (Capacitor) app —
		// the app is a locally-bundled SPA and the SW's caching/fetch interception
		// would conflict with the local assets and the remote API.
		if (Capacitor.isNativePlatform()) {
			return null;
		}

		if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
			console.warn('Service Workers not supported');
			return null;
		}

		const {
			enabled = true,
			scope = '/',
			updateCheckInterval = 3600000 // 1 hour
		} = config;

		if (!enabled) {
			return null;
		}

		try {
			this.registration = await navigator.serviceWorker.register('/service-worker.js', {
				scope
			});

			console.log('Service Worker registered successfully');

			// Check for updates periodically
			this.startUpdateCheck(updateCheckInterval);

			// Listen for controller change
			navigator.serviceWorker.addEventListener('controllerchange', () => {
				console.log('Service Worker controller changed');
			});

			return this.registration;
		} catch (error) {
			console.error('Service Worker registration failed:', error);
			return null;
		}
	}

	/**
	 * Unregister service worker
	 */
	static async unregister(): Promise<boolean> {
		if (!this.registration) {
			return false;
		}

		try {
			const success = await this.registration.unregister();
			if (success) {
				this.registration = null;
				this.stopUpdateCheck();
				console.log('Service Worker unregistered');
			}
			return success;
		} catch (error) {
			console.error('Service Worker unregistration failed:', error);
			return false;
		}
	}

	/**
	 * Check for service worker updates
	 */
	static async checkForUpdates(): Promise<boolean> {
		if (!this.registration) {
			return false;
		}

		try {
			await this.registration.update();
			if (this.registration.waiting) {
				console.log('Service Worker update available');
				return true;
			}
			return false;
		} catch (error) {
			console.error('Failed to check for updates:', error);
			return false;
		}
	}

	/**
	 * Start periodic update checks
	 */
	private static startUpdateCheck(interval: number): void {
		this.updateCheckInterval = setInterval(() => {
			this.checkForUpdates();
		}, interval);
	}

	/**
	 * Stop periodic update checks
	 */
	private static stopUpdateCheck(): void {
		if (this.updateCheckInterval) {
			clearInterval(this.updateCheckInterval);
			this.updateCheckInterval = null;
		}
	}

	/**
	 * Skip waiting and activate new service worker
	 */
	static skipWaiting(): void {
		if (this.registration?.waiting) {
			this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
		}
	}

	/**
	 * Clear all caches
	 */
	static async clearCaches(): Promise<void> {
		if (this.registration?.active) {
			this.registration.active.postMessage({ type: 'CLEAR_CACHE' });
		}

		if ('caches' in window) {
			const cacheNames = await caches.keys();
			await Promise.all(cacheNames.map((name) => caches.delete(name)));
		}
	}

	/**
	 * Cache specific URLs
	 */
	static cacheUrls(urls: string[]): void {
		if (this.registration?.active) {
			this.registration.active.postMessage({
				type: 'CACHE_URLS',
				urls
			});
		}
	}

	/**
	 * Get registration
	 */
	static getRegistration(): ServiceWorkerRegistration | null {
		return this.registration;
	}

	/**
	 * Check if service worker is active
	 */
	static isActive(): boolean {
		return this.registration?.active !== undefined;
	}

	/**
	 * Get service worker status
	 */
	static getStatus(): string {
		if (!this.registration) {
			return 'not-registered';
		}
		if (this.registration.active) {
			return 'active';
		}
		if (this.registration.installing) {
			return 'installing';
		}
		if (this.registration.waiting) {
			return 'waiting';
		}
		return 'unknown';
	}
}

/**
 * Listen for service worker messages
 */
export function onServiceWorkerMessage(callback: (data: any) => void): () => void {
	if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
		return () => {};
	}

	const handler = (event: MessageEvent) => {
		callback(event.data);
	};

	navigator.serviceWorker.addEventListener('message', handler);

	return () => {
		navigator.serviceWorker.removeEventListener('message', handler);
	};
}

/**
 * Request service worker to cache URLs
 */
export function requestCacheUrls(urls: string[]): void {
	ServiceWorkerManager.cacheUrls(urls);
}

/**
 * Check if app is online
 */
export function isOnline(): boolean {
	if (typeof window === 'undefined') {
		return true;
	}
	return navigator.onLine;
}

/**
 * Listen for online/offline events
 */
export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
	if (typeof window === 'undefined') {
		return () => {};
	}

	const handleOnline = () => callback(true);
	const handleOffline = () => callback(false);

	window.addEventListener('online', handleOnline);
	window.addEventListener('offline', handleOffline);

	return () => {
		window.removeEventListener('online', handleOnline);
		window.removeEventListener('offline', handleOffline);
	};
}

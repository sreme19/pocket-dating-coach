/**
 * Performance Monitoring and Optimization Service
 * Tracks page load times, image optimization, and caching strategies
 */

export interface PerformanceMetrics {
	pageLoadTime: number;
	firstContentfulPaint: number;
	largestContentfulPaint: number;
	cumulativeLayoutShift: number;
	timeToInteractive: number;
	resourceTiming: ResourceTiming[];
	imageMetrics: ImageMetric[];
	cacheHitRate: number;
	timestamp: Date;
}

export interface ResourceTiming {
	name: string;
	duration: number;
	size: number;
	type: string;
	cached: boolean;
}

export interface ImageMetric {
	src: string;
	originalSize: number;
	optimizedSize: number;
	format: string;
	loadTime: number;
	lazyLoaded: boolean;
}

export interface CacheConfig {
	maxAge: number;
	maxSize: number;
	strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
}

/**
 * Performance monitoring class
 */
export class PerformanceMonitor {
	private metrics: PerformanceMetrics | null = null;
	private startTime: number = 0;
	private imageMetrics: Map<string, ImageMetric> = new Map();
	private resourceCache: Map<string, ResourceTiming> = new Map();

	constructor() {
		this.startTime = performance.now();
	}

	/**
	 * Start monitoring page load
	 */
	startMonitoring(): void {
		if (typeof window === 'undefined') return;

		// Use PerformanceObserver to track Core Web Vitals
		if ('PerformanceObserver' in window) {
			try {
				// Track Largest Contentful Paint
				const lcpObserver = new PerformanceObserver((list) => {
					const entries = list.getEntries();
					const lastEntry = entries[entries.length - 1];
					if (this.metrics) {
						this.metrics.largestContentfulPaint = lastEntry.renderTime || lastEntry.loadTime;
					}
				});
				lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

				// Track Cumulative Layout Shift
				const clsObserver = new PerformanceObserver((list) => {
					for (const entry of list.getEntries()) {
						if (!(entry as any).hadRecentInput) {
							if (this.metrics) {
								this.metrics.cumulativeLayoutShift += (entry as any).value;
							}
						}
					}
				});
				clsObserver.observe({ entryTypes: ['layout-shift'] });

				// Track First Input Delay
				const fidObserver = new PerformanceObserver((list) => {
					for (const entry of list.getEntries()) {
						if (this.metrics) {
							this.metrics.timeToInteractive = Math.max(
								this.metrics.timeToInteractive,
								(entry as any).processingDuration
							);
						}
					}
				});
				fidObserver.observe({ entryTypes: ['first-input'] });
			} catch (e) {
				console.warn('PerformanceObserver not fully supported:', e);
			}
		}
	}

	/**
	 * Collect all performance metrics
	 */
	collectMetrics(): PerformanceMetrics {
		const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
		const paintEntries = performance.getEntriesByType('paint');

		const pageLoadTime = navigationTiming ? navigationTiming.loadEventEnd - navigationTiming.fetchStart : 0;
		const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint')?.startTime || 0;

		this.metrics = {
			pageLoadTime,
			firstContentfulPaint: fcp,
			largestContentfulPaint: 0,
			cumulativeLayoutShift: 0,
			timeToInteractive: 0,
			resourceTiming: this.getResourceTiming(),
			imageMetrics: Array.from(this.imageMetrics.values()),
			cacheHitRate: this.calculateCacheHitRate(),
			timestamp: new Date()
		};

		return this.metrics;
	}

	/**
	 * Get resource timing information
	 */
	private getResourceTiming(): ResourceTiming[] {
		const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
		return resources.map((resource) => ({
			name: resource.name,
			duration: resource.duration,
			size: (resource as any).transferSize || 0,
			type: resource.initiatorType,
			cached: (resource as any).transferSize === 0 && resource.decodedBodySize > 0
		}));
	}

	/**
	 * Calculate cache hit rate
	 */
	private calculateCacheHitRate(): number {
		const resources = this.resourceCache.values();
		let cachedCount = 0;
		let totalCount = 0;

		for (const resource of resources) {
			totalCount++;
			if (resource.cached) cachedCount++;
		}

		return totalCount > 0 ? (cachedCount / totalCount) * 100 : 0;
	}

	/**
	 * Track image loading
	 */
	trackImageLoad(src: string, originalSize: number, optimizedSize: number, format: string, loadTime: number, lazyLoaded: boolean): void {
		this.imageMetrics.set(src, {
			src,
			originalSize,
			optimizedSize,
			format,
			loadTime,
			lazyLoaded
		});
	}

	/**
	 * Get current metrics
	 */
	getMetrics(): PerformanceMetrics | null {
		return this.metrics;
	}

	/**
	 * Reset metrics
	 */
	reset(): void {
		this.metrics = null;
		this.imageMetrics.clear();
		this.resourceCache.clear();
		this.startTime = performance.now();
	}
}

/**
 * Image optimization service
 */
export class ImageOptimizer {
	/**
	 * Optimize image by resizing and compressing
	 */
	static async optimizeImage(
		file: File,
		maxWidth: number = 1200,
		maxHeight: number = 1200,
		quality: number = 0.8
	): Promise<Blob> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = (e) => {
				const img = new Image();
				img.onload = () => {
					const canvas = document.createElement('canvas');
					let width = img.width;
					let height = img.height;

					// Calculate new dimensions
					if (width > height) {
						if (width > maxWidth) {
							height = Math.round((height * maxWidth) / width);
							width = maxWidth;
						}
					} else {
						if (height > maxHeight) {
							width = Math.round((width * maxHeight) / height);
							height = maxHeight;
						}
					}

					canvas.width = width;
					canvas.height = height;

					const ctx = canvas.getContext('2d');
					if (!ctx) {
						reject(new Error('Failed to get canvas context'));
						return;
					}

					ctx.drawImage(img, 0, 0, width, height);

					canvas.toBlob(
						(blob) => {
							if (blob) {
								resolve(blob);
							} else {
								reject(new Error('Failed to create blob'));
							}
						},
						'image/webp',
						quality
					);
				};

				img.onerror = () => reject(new Error('Failed to load image'));
				img.src = e.target?.result as string;
			};

			reader.onerror = () => reject(new Error('Failed to read file'));
			reader.readAsDataURL(file);
		});
	}

	/**
	 * Get optimized image size
	 */
	static getOptimizedSize(originalSize: number, quality: number = 0.8): number {
		// Estimate compression ratio based on quality
		const compressionRatio = 1 - quality * 0.5;
		return Math.round(originalSize * compressionRatio);
	}

	/**
	 * Generate responsive image srcset
	 */
	static generateSrcSet(basePath: string, formats: number[] = [320, 640, 1024, 1280]): string {
		return formats.map((width) => `${basePath}?w=${width} ${width}w`).join(', ');
	}
}

/**
 * Cache management service
 */
export class CacheManager {
	private static readonly CACHE_PREFIX = 'pdc-cache-';
	private static readonly CACHE_VERSION = 'v1';

	/**
	 * Get cache key
	 */
	private static getCacheKey(key: string): string {
		return `${this.CACHE_PREFIX}${this.CACHE_VERSION}-${key}`;
	}

	/**
	 * Set cache with TTL
	 */
	static setCache(key: string, value: any, ttlSeconds: number = 3600): void {
		if (typeof window === 'undefined') return;

		const cacheKey = this.getCacheKey(key);
		const expiresAt = Date.now() + ttlSeconds * 1000;

		try {
			localStorage.setItem(cacheKey, JSON.stringify({ value, expiresAt }));
		} catch (e) {
			console.warn('Failed to set cache:', e);
		}
	}

	/**
	 * Get cache
	 */
	static getCache(key: string): any | null {
		if (typeof window === 'undefined') return null;

		const cacheKey = this.getCacheKey(key);

		try {
			const cached = localStorage.getItem(cacheKey);
			if (!cached) return null;

			const { value, expiresAt } = JSON.parse(cached);

			if (Date.now() > expiresAt) {
				localStorage.removeItem(cacheKey);
				return null;
			}

			return value;
		} catch (e) {
			console.warn('Failed to get cache:', e);
			return null;
		}
	}

	/**
	 * Clear cache
	 */
	static clearCache(key?: string): void {
		if (typeof window === 'undefined') return;

		try {
			if (key) {
				const cacheKey = this.getCacheKey(key);
				localStorage.removeItem(cacheKey);
			} else {
				// Clear all PDC caches
				const keys = Object.keys(localStorage);
				keys.forEach((k) => {
					if (k.startsWith(this.CACHE_PREFIX)) {
						localStorage.removeItem(k);
					}
				});
			}
		} catch (e) {
			console.warn('Failed to clear cache:', e);
		}
	}

	/**
	 * Get cache size
	 */
	static getCacheSize(): number {
		if (typeof window === 'undefined') return 0;

		let size = 0;
		try {
			const keys = Object.keys(localStorage);
			keys.forEach((k) => {
				if (k.startsWith(this.CACHE_PREFIX)) {
					const item = localStorage.getItem(k);
					if (item) {
						size += item.length;
					}
				}
			});
		} catch (e) {
			console.warn('Failed to calculate cache size:', e);
		}

		return size;
	}
}

/**
 * Code splitting utilities
 */
export class CodeSplitting {
	/**
	 * Dynamically import a module
	 */
	static async importModule(modulePath: string): Promise<any> {
		try {
			return await import(modulePath);
		} catch (e) {
			console.error(`Failed to import module: ${modulePath}`, e);
			throw e;
		}
	}

	/**
	 * Preload a module
	 */
	static preloadModule(modulePath: string): void {
		if (typeof window === 'undefined') return;

		const link = document.createElement('link');
		link.rel = 'modulepreload';
		link.href = modulePath;
		document.head.appendChild(link);
	}

	/**
	 * Prefetch a resource
	 */
	static prefetchResource(url: string): void {
		if (typeof window === 'undefined') return;

		const link = document.createElement('link');
		link.rel = 'prefetch';
		link.href = url;
		document.head.appendChild(link);
	}
}

/**
 * Offline support service
 */
export class OfflineSupport {
	private static readonly DB_NAME = 'pdc-offline-db';
	private static readonly DB_VERSION = 1;

	/**
	 * Initialize offline database
	 */
	static async initializeDB(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			if (typeof window === 'undefined' || !('indexedDB' in window)) {
				reject(new Error('IndexedDB not available'));
				return;
			}

			const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Create object stores
				if (!db.objectStoreNames.contains('profiles')) {
					db.createObjectStore('profiles', { keyPath: 'id' });
				}
				if (!db.objectStoreNames.contains('messages')) {
					db.createObjectStore('messages', { keyPath: 'id' });
				}
				if (!db.objectStoreNames.contains('cache')) {
					db.createObjectStore('cache', { keyPath: 'key' });
				}
			};
		});
	}

	/**
	 * Save data for offline access
	 */
	static async saveOfflineData(storeName: string, data: any): Promise<void> {
		try {
			const db = await this.initializeDB();
			const transaction = db.transaction([storeName], 'readwrite');
			const store = transaction.objectStore(storeName);
			store.put(data);

			return new Promise((resolve, reject) => {
				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error);
			});
		} catch (e) {
			console.warn('Failed to save offline data:', e);
		}
	}

	/**
	 * Get offline data
	 */
	static async getOfflineData(storeName: string, key: string): Promise<any> {
		try {
			const db = await this.initializeDB();
			const transaction = db.transaction([storeName], 'readonly');
			const store = transaction.objectStore(storeName);
			const request = store.get(key);

			return new Promise((resolve, reject) => {
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
		} catch (e) {
			console.warn('Failed to get offline data:', e);
			return null;
		}
	}

	/**
	 * Check if online
	 */
	static isOnline(): boolean {
		if (typeof window === 'undefined') return true;
		return navigator.onLine;
	}
}

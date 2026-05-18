/**
 * Service Worker for Pocket Dating Coach
 * Handles offline support, caching, and performance optimization
 */

const CACHE_NAME = 'pdc-cache-v1';
const RUNTIME_CACHE = 'pdc-runtime-v1';
const IMAGE_CACHE = 'pdc-images-v1';

const STATIC_ASSETS = [
	'/',
	'/index.html',
	'/app.css'
];

const CACHE_STRATEGIES = {
	CACHE_FIRST: 'cache-first',
	NETWORK_FIRST: 'network-first',
	STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(STATIC_ASSETS).catch((err) => {
				console.warn('Failed to cache static assets:', err);
			});
		})
	);
	self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE && cacheName !== IMAGE_CACHE) {
						return caches.delete(cacheName);
					}
				})
			);
		})
	);
	self.clients.claim();
});

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests
	if (request.method !== 'GET') {
		return;
	}

	// Skip chrome extensions
	if (url.protocol === 'chrome-extension:') {
		return;
	}

	// Handle API requests with network-first strategy
	if (url.pathname.startsWith('/api/')) {
		event.respondWith(networkFirst(request));
		return;
	}

	// Handle image requests with cache-first strategy
	if (isImageRequest(request)) {
		event.respondWith(cacheFirstImages(request));
		return;
	}

	// Handle document requests with stale-while-revalidate
	if (request.mode === 'navigate') {
		event.respondWith(staleWhileRevalidate(request));
		return;
	}

	// Default: network-first for other resources
	event.respondWith(networkFirst(request));
});

/**
 * Check if request is for an image
 */
function isImageRequest(request) {
	const url = new URL(request.url);
	return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname);
}

/**
 * Cache-first strategy for images
 */
async function cacheFirstImages(request) {
	const cache = await caches.open(IMAGE_CACHE);
	const cached = await cache.match(request);

	if (cached) {
		return cached;
	}

	try {
		const response = await fetch(request);
		if (response.ok) {
			cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		console.warn('Fetch failed for image:', request.url, error);
		return new Response('Image not available', { status: 404 });
	}
}

/**
 * Network-first strategy
 */
async function networkFirst(request) {
	const cache = await caches.open(RUNTIME_CACHE);

	try {
		const response = await fetch(request);
		if (response.ok) {
			cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		const cached = await cache.match(request);
		if (cached) {
			return cached;
		}
		return new Response('Offline - resource not available', { status: 503 });
	}
}

/**
 * Stale-while-revalidate strategy
 */
async function staleWhileRevalidate(request) {
	const cache = await caches.open(RUNTIME_CACHE);
	const cached = await cache.match(request);

	const fetchPromise = fetch(request).then((response) => {
		if (response.ok) {
			cache.put(request, response.clone());
		}
		return response;
	});

	return cached || fetchPromise;
}

/**
 * Message handler for cache management
 */
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}

	if (event.data && event.data.type === 'CLEAR_CACHE') {
		caches.keys().then((cacheNames) => {
			Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
		});
	}

	if (event.data && event.data.type === 'CACHE_URLS') {
		const urls = event.data.urls || [];
		caches.open(RUNTIME_CACHE).then((cache) => {
			cache.addAll(urls);
		});
	}
});

# Performance Optimization Integration Guide

## Quick Start

### 1. Enable Performance Monitoring

Add the PerformanceMonitor component to your main layout:

```svelte
<script lang="ts">
  import PerformanceMonitor from '$lib/verified-vibe/components/PerformanceMonitor.svelte';
</script>

<PerformanceMonitor enabled={true} />
```

### 2. Use Lazy Images

Replace regular images with LazyImage component:

```svelte
<script lang="ts">
  import LazyImage from '$lib/verified-vibe/components/LazyImage.svelte';
</script>

<!-- Before -->
<img src="/images/profile.jpg" alt="Profile" />

<!-- After -->
<LazyImage
  src="/images/profile.jpg"
  alt="Profile"
  width={400}
  height={300}
  quality={0.8}
/>
```

### 3. Register Service Worker

In your main layout or app initialization:

```typescript
import { ServiceWorkerManager } from '$lib/verified-vibe/services/service-worker';

// Register service worker
await ServiceWorkerManager.register({
  enabled: true,
  scope: '/',
  updateCheckInterval: 3600000 // 1 hour
});
```

### 4. Implement Caching

Cache API responses and data:

```typescript
import { CacheManager } from '$lib/verified-vibe/services/performance';

// Cache user profile for 1 hour
CacheManager.setCache('user-profile', userData, 3600);

// Retrieve cached data
const cached = CacheManager.getCache('user-profile');

// Clear cache when needed
CacheManager.clearCache('user-profile');
```

### 5. Monitor Performance

Access performance metrics programmatically:

```typescript
import { PerformanceMonitor } from '$lib/verified-vibe/services/performance';

const monitor = new PerformanceMonitor();
monitor.startMonitoring();

// After page load
const metrics = monitor.collectMetrics();
console.log(`Page Load: ${metrics.pageLoadTime}ms`);
console.log(`FCP: ${metrics.firstContentfulPaint}ms`);
console.log(`LCP: ${metrics.largestContentfulPaint}ms`);
console.log(`Cache Hit Rate: ${metrics.cacheHitRate}%`);
```

## Integration Patterns

### Pattern 1: Image Gallery with Lazy Loading

```svelte
<script lang="ts">
  import LazyImage from '$lib/verified-vibe/components/LazyImage.svelte';
  
  const images = [
    { src: '/images/photo1.jpg', alt: 'Photo 1' },
    { src: '/images/photo2.jpg', alt: 'Photo 2' },
    { src: '/images/photo3.jpg', alt: 'Photo 3' }
  ];
</script>

<div class="grid grid-cols-3 gap-4">
  {#each images as image}
    <LazyImage
      src={image.src}
      alt={image.alt}
      width={300}
      height={300}
      quality={0.8}
    />
  {/each}
</div>
```

### Pattern 2: API Response Caching

```typescript
import { CacheManager } from '$lib/verified-vibe/services/performance';

async function fetchUserProfile(userId: string) {
  // Check cache first
  const cached = CacheManager.getCache(`profile-${userId}`);
  if (cached) {
    return cached;
  }

  // Fetch from API
  const response = await fetch(`/api/users/${userId}`);
  const data = await response.json();

  // Cache for 1 hour
  CacheManager.setCache(`profile-${userId}`, data, 3600);

  return data;
}
```

### Pattern 3: Offline Data Persistence

```typescript
import { OfflineSupport } from '$lib/verified-vibe/services/performance';

async function saveProfileOffline(profile: UserProfile) {
  // Save to IndexedDB for offline access
  await OfflineSupport.saveOfflineData('profiles', profile);
}

async function getProfileOffline(userId: string) {
  // Retrieve from IndexedDB
  return await OfflineSupport.getOfflineData('profiles', userId);
}

// Check if online
if (OfflineSupport.isOnline()) {
  // Fetch from API
} else {
  // Use offline data
}
```

### Pattern 4: Performance Monitoring

```typescript
import { PerformanceMonitor } from '$lib/verified-vibe/services/performance';

const monitor = new PerformanceMonitor();

onMount(() => {
  monitor.startMonitoring();

  // Track image loads
  monitor.trackImageLoad('profile.jpg', 2000, 800, 'webp', 100, true);

  // Collect metrics after page load
  window.addEventListener('load', () => {
    const metrics = monitor.collectMetrics();
    
    // Send to analytics
    analytics.track('page_load', {
      pageLoadTime: metrics.pageLoadTime,
      fcp: metrics.firstContentfulPaint,
      lcp: metrics.largestContentfulPaint,
      cls: metrics.cumulativeLayoutShift,
      cacheHitRate: metrics.cacheHitRate
    });
  });
});
```

### Pattern 5: Service Worker Cache Management

```typescript
import { ServiceWorkerManager } from '$lib/verified-vibe/services/service-worker';

// Cache specific URLs
ServiceWorkerManager.cacheUrls([
  '/api/users',
  '/api/profiles',
  '/images/logo.png'
]);

// Check for updates
const hasUpdate = await ServiceWorkerManager.checkForUpdates();
if (hasUpdate) {
  // Notify user about update
  showUpdateNotification();
}

// Clear caches when needed
await ServiceWorkerManager.clearCaches();

// Monitor online status
onOnlineStatusChange((online) => {
  if (online) {
    console.log('Back online - syncing data');
    syncOfflineData();
  } else {
    console.log('Offline - using cached data');
  }
});
```

## Performance Best Practices

### 1. Image Optimization
- Always use LazyImage for images below the fold
- Set appropriate width/height to prevent layout shift
- Use quality parameter (0.7-0.9) for best balance
- Provide alt text for accessibility

### 2. Caching Strategy
- Cache API responses with appropriate TTL
- Use shorter TTL for frequently changing data
- Clear cache when data is updated
- Monitor cache size

### 3. Code Splitting
- Use dynamic imports for large features
- Preload critical resources
- Prefetch likely-to-be-used resources
- Monitor chunk sizes

### 4. Offline Support
- Save critical data to IndexedDB
- Implement sync strategies
- Handle offline gracefully
- Provide user feedback

### 5. Performance Monitoring
- Enable monitoring in production
- Track Core Web Vitals
- Monitor cache hit rates
- Set up alerts for performance degradation

## Configuration Options

### PerformanceMonitor
```typescript
const monitor = new PerformanceMonitor();
monitor.startMonitoring();
const metrics = monitor.collectMetrics();
```

### ImageOptimizer
```typescript
// Optimize image
const optimized = await ImageOptimizer.optimizeImage(file, 1200, 1200, 0.8);

// Generate srcset
const srcset = ImageOptimizer.generateSrcSet('/images/photo', [320, 640, 1024]);

// Calculate size
const size = ImageOptimizer.getOptimizedSize(2000, 0.8);
```

### CacheManager
```typescript
// Set cache with TTL
CacheManager.setCache('key', value, 3600);

// Get cache
const cached = CacheManager.getCache('key');

// Clear cache
CacheManager.clearCache('key');
CacheManager.clearCache(); // Clear all

// Get size
const size = CacheManager.getCacheSize();
```

### ServiceWorkerManager
```typescript
// Register
await ServiceWorkerManager.register({ enabled: true });

// Check updates
const hasUpdate = await ServiceWorkerManager.checkForUpdates();

// Cache URLs
ServiceWorkerManager.cacheUrls(['/api/data']);

// Clear caches
await ServiceWorkerManager.clearCaches();

// Get status
const status = ServiceWorkerManager.getStatus();
```

### OfflineSupport
```typescript
// Initialize DB
const db = await OfflineSupport.initializeDB();

// Save data
await OfflineSupport.saveOfflineData('profiles', data);

// Get data
const data = await OfflineSupport.getOfflineData('profiles', 'id');

// Check online
const online = OfflineSupport.isOnline();
```

## Testing

### Run Performance Tests
```bash
npm run test -- src/lib/verified-vibe/services/performance.test.ts
```

### Run Service Worker Tests
```bash
npm run test -- src/lib/verified-vibe/services/service-worker.test.ts
```

### Run All Tests
```bash
npm run test
```

## Monitoring & Debugging

### Enable Debug Logging
```typescript
// In your app
const monitor = new PerformanceMonitor();
monitor.startMonitoring();

window.addEventListener('load', () => {
  const metrics = monitor.collectMetrics();
  console.log('Performance Metrics:', metrics);
});
```

### Check Service Worker Status
```typescript
const status = ServiceWorkerManager.getStatus();
console.log('Service Worker Status:', status);
```

### Monitor Cache
```typescript
const size = CacheManager.getCacheSize();
console.log('Cache Size:', size);
```

### Check Online Status
```typescript
const online = OfflineSupport.isOnline();
console.log('Online:', online);
```

## Troubleshooting

### Images Not Loading
1. Check image paths
2. Verify CORS headers
3. Check browser console for errors
4. Verify lazy loading is working

### Service Worker Not Registering
1. Check browser console for errors
2. Verify service-worker.js exists
3. Check HTTPS (required for production)
4. Clear browser cache

### Cache Not Working
1. Check localStorage availability
2. Verify cache keys
3. Check TTL settings
4. Monitor cache size

### Performance Not Improving
1. Check Network tab for large resources
2. Verify code splitting is working
3. Check image optimization
4. Monitor cache hit rate

## Performance Targets

- **Page Load Time**: < 2 seconds
- **FCP**: < 1 second
- **LCP**: < 2.5 seconds
- **CLS**: < 0.1
- **Cache Hit Rate**: > 80%
- **Image Size Reduction**: 50-70%

## Deployment Checklist

- [ ] Service worker registered
- [ ] Performance monitoring enabled
- [ ] Lazy images implemented
- [ ] Caching configured
- [ ] Offline support enabled
- [ ] Tests passing
- [ ] Build optimized
- [ ] Metrics monitored
- [ ] Documentation updated
- [ ] Team trained

## Support & Resources

- [Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION.md)
- [Performance Testing Guide](./PERFORMANCE_TESTING.md)
- [Web Vitals](https://web.dev/vitals/)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)

## Next Steps

1. Integrate performance monitoring into your pages
2. Replace images with LazyImage component
3. Implement caching for API responses
4. Register service worker
5. Monitor performance metrics
6. Optimize based on real-world data

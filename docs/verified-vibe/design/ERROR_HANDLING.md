# Error Handling & Recovery System

## Overview

The Verified Vibe application includes a comprehensive error handling and recovery system designed to provide users with clear, actionable error messages and automatic recovery mechanisms for failed operations.

## Key Features

- **User-Friendly Error Messages**: All errors are translated into clear, non-technical messages
- **Automatic Retry Logic**: Failed operations are automatically retried with exponential backoff
- **Network Status Monitoring**: Real-time detection of network connectivity changes
- **Error Logging**: Centralized error logging for debugging and monitoring
- **Error Recovery Options**: Users can manually retry failed operations
- **Timeout Handling**: Operations that take too long are automatically cancelled

## Architecture

### Core Components

#### 1. ErrorHandler (`errorHandler.ts`)

The main error handling utility providing:

- **AppError**: Custom error class with metadata (severity, category, user message)
- **ErrorLogger**: Centralized error logging system
- **Error Categorization**: Automatic categorization of errors (network, validation, auth, server, client)
- **Retry Logic**: Exponential backoff retry mechanism
- **Network Utilities**: Network connectivity checking and waiting

**Key Functions:**

```typescript
// Create a custom error
const error = new AppError('Failed to load profile', {
  category: 'network',
  severity: 'warning',
  userMessage: 'Unable to load your profile. Please check your connection.',
  retryable: true
});

// Retry an operation
const result = await retryOperation(
  () => fetchUserProfile(),
  { maxRetries: 3, baseDelay: 1000 }
);

// Check if error is retryable
if (isRetryable(error)) {
  // Retry the operation
}

// Get user-friendly message
const message = getUserFriendlyMessage(error);
```

#### 2. API Client (`apiClient.ts`)

HTTP client with built-in error handling and retry logic:

```typescript
import { apiClient } from '$lib/verified-vibe/utils/apiClient';

// Make requests with automatic error handling
const user = await apiClient.get('/api/user');
const result = await apiClient.post('/api/verify', { data });

// Custom options
const data = await apiClient.get('/api/data', {
  timeout: 5000,
  maxRetries: 2,
  retryable: true
});
```

#### 3. Error Recovery Hook (`useErrorRecovery.ts`)

Svelte-friendly error handling utilities:

```typescript
import { createErrorRecovery, withErrorHandling, withRetry } from '$lib/verified-vibe/utils/useErrorRecovery';

// Create error recovery state for a component
const { state, handleError, retry, clear } = createErrorRecovery(maxRetries);

// Wrap operations with error handling
const result = await withErrorHandling(
  () => fetchData(),
  {
    onError: (error) => console.error(error),
    onSuccess: (result) => console.log(result)
  }
);

// Wrap operations with retry logic
const result = await withRetry(
  () => fetchData(),
  {
    maxRetries: 3,
    onRetry: (attempt) => console.log(`Retry attempt ${attempt}`)
  }
);
```

#### 4. Error Boundary Component (`ErrorBoundary.svelte`)

Displays errors to users with retry options:

```svelte
<script>
  import ErrorBoundary from '$lib/verified-vibe/components/ErrorBoundary.svelte';
  import { setError } from '$lib/verified-vibe/stores';

  // Show error to user
  setError('Something went wrong. Please try again.');
</script>

<ErrorBoundary />
```

#### 5. Network Status Component (`NetworkStatus.svelte`)

Monitors and displays network connectivity:

```svelte
<script>
  import NetworkStatus from '$lib/verified-vibe/components/NetworkStatus.svelte';
</script>

<NetworkStatus />
```

## Usage Examples

### Example 1: Basic Error Handling in a Component

```svelte
<script lang="ts">
  import { createErrorRecovery } from '$lib/verified-vibe/utils/useErrorRecovery';
  import { apiClient } from '$lib/verified-vibe/utils/apiClient';

  const { state, handleError, retry, clear } = createErrorRecovery();

  async function loadData() {
    try {
      const data = await apiClient.get('/api/data');
      // Process data
    } catch (error) {
      handleError(error);
    }
  }

  async function handleRetry() {
    await retry(() => apiClient.get('/api/data'));
  }
</script>

{#if $state.error}
  <div class="error-message">
    {$state.error}
    <button on:click={handleRetry} disabled={$state.isRetrying}>
      {$state.isRetrying ? 'Retrying...' : 'Try Again'}
    </button>
  </div>
{/if}
```

### Example 2: API Endpoint with Error Handling

```typescript
// src/routes/api/verified-vibe/some-endpoint/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { AppError, handleApiError } from '$lib/verified-vibe/utils/errorHandler';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    // Validate input
    if (!body.userId) {
      throw new AppError('userId is required', {
        category: 'validation',
        userMessage: 'Please provide a user ID'
      });
    }

    // Process request
    const result = await processData(body);

    return json({ data: result });
  } catch (error) {
    if (error instanceof AppError) {
      return json(
        { error: error.userMessage },
        { status: error.category === 'auth' ? 401 : 400 }
      );
    }

    console.error('Unexpected error:', error);
    return json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
};
```

### Example 3: Retry with Exponential Backoff

```typescript
import { retryOperation, getRetryDelay } from '$lib/verified-vibe/utils/errorHandler';

// Automatic retry with exponential backoff
const result = await retryOperation(
  async () => {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },
  {
    maxRetries: 5,
    baseDelay: 1000,
    onRetry: (attempt, error) => {
      const delay = getRetryDelay(attempt, 1000);
      console.log(`Retry attempt ${attempt} after ${delay}ms`);
    }
  }
);
```

### Example 4: Network-Aware Operations

```typescript
import { checkNetworkConnectivity, waitForNetwork } from '$lib/verified-vibe/utils/errorHandler';

// Check if network is available
const isOnline = await checkNetworkConnectivity();

if (!isOnline) {
  // Wait for network to be available (max 30 seconds)
  const connected = await waitForNetwork(30000);
  if (!connected) {
    throw new Error('Network is unavailable');
  }
}

// Proceed with operation
```

## Error Categories

Errors are automatically categorized for appropriate handling:

| Category | Description | Retryable | Example |
|----------|-------------|-----------|---------|
| `network` | Network connectivity issues | Yes | Connection timeout, DNS failure |
| `validation` | Invalid input data | No | Missing required field, invalid format |
| `auth` | Authentication/authorization issues | No | Unauthorized, forbidden |
| `server` | Server-side errors | Yes | 500, 503 errors |
| `client` | Client-side errors | No | TypeError, SyntaxError |
| `unknown` | Uncategorized errors | No | Unknown error |

## Error Severity Levels

| Severity | Description | UI Treatment |
|----------|-------------|--------------|
| `info` | Informational message | Blue notification |
| `warning` | Warning message | Amber notification |
| `error` | Error message | Red notification |
| `critical` | Critical error | Red notification with emphasis |

## Best Practices

### 1. Always Provide User-Friendly Messages

```typescript
// ❌ Bad
throw new Error('ECONNREFUSED: Connection refused');

// ✅ Good
throw new AppError('Connection refused', {
  userMessage: 'Unable to connect to the server. Please check your internet connection.'
});
```

### 2. Categorize Errors Appropriately

```typescript
// ❌ Bad
throw new AppError('Error');

// ✅ Good
throw new AppError('Invalid email format', {
  category: 'validation',
  userMessage: 'Please enter a valid email address'
});
```

### 3. Use Retry Logic for Transient Failures

```typescript
// ❌ Bad - No retry
const data = await fetch('/api/data').then(r => r.json());

// ✅ Good - Automatic retry
const data = await retryOperation(
  () => fetch('/api/data').then(r => r.json()),
  { maxRetries: 3 }
);
```

### 4. Log Errors for Debugging

```typescript
import { errorLogger } from '$lib/verified-vibe/utils/errorHandler';

try {
  // Operation
} catch (error) {
  const log = errorLogger.log(error, { retryable: true });
  console.log('Error logged with ID:', log.id);
}

// Export logs for debugging
const logs = errorLogger.exportLogs();
```

### 5. Handle Timeouts

```typescript
import { withTimeout } from '$lib/verified-vibe/utils/errorHandler';

// Timeout after 5 seconds
const result = await withTimeout(
  fetchLargeDataset(),
  5000
);
```

## Testing

All error handling utilities include comprehensive tests:

```bash
# Run error handling tests
npm test -- src/lib/verified-vibe/utils/errorHandler.test.ts
npm test -- src/lib/verified-vibe/utils/apiClient.test.ts
npm test -- src/lib/verified-vibe/utils/useErrorRecovery.test.ts

# Run component tests
npm test -- src/lib/verified-vibe/components/ErrorBoundary.test.ts
npm test -- src/lib/verified-vibe/components/NetworkStatus.test.ts
```

## Accessibility

The error handling system is fully accessible:

- Error messages use `role="alert"` for screen readers
- Network status uses `role="status"` with `aria-live="polite"`
- All buttons have proper `aria-label` attributes
- Color is not the only indicator of error state
- Sufficient color contrast ratios (WCAG AA)

## Performance Considerations

- Error logs are limited to 100 entries to prevent memory leaks
- Exponential backoff prevents thundering herd problems
- Network checks use HEAD requests for minimal overhead
- Timeouts prevent hanging operations

## Monitoring and Debugging

### View Error Logs

```typescript
import { errorLogger } from '$lib/verified-vibe/utils/errorHandler';

// Get all logged errors
const logs = errorLogger.getLogs();

// Export logs as JSON
const json = errorLogger.exportLogs();

// Clear logs
errorLogger.clearLogs();
```

### Debug Network Issues

```typescript
import { checkNetworkConnectivity } from '$lib/verified-vibe/utils/errorHandler';

// Check connectivity
const isOnline = await checkNetworkConnectivity();
console.log('Network status:', isOnline ? 'online' : 'offline');
```

## Migration Guide

### From Old Error Handling to New System

**Before:**
```typescript
try {
  const response = await fetch('/api/data');
  const data = await response.json();
} catch (error) {
  console.error('Error:', error);
  alert('Something went wrong');
}
```

**After:**
```typescript
import { apiClient } from '$lib/verified-vibe/utils/apiClient';
import { setError } from '$lib/verified-vibe/stores';

try {
  const data = await apiClient.get('/api/data');
} catch (error) {
  // Error is automatically logged and user-friendly message is set
  setError(getUserFriendlyMessage(error));
}
```

## Troubleshooting

### Errors Not Being Retried

Check that:
1. Error category is retryable (network, server)
2. `retryable` option is not set to `false`
3. `maxRetries` is greater than 0

### Network Status Not Updating

Ensure:
1. `NetworkStatus` component is mounted
2. Browser supports online/offline events
3. No service worker is interfering

### Error Messages Not Displaying

Verify:
1. `ErrorBoundary` component is mounted
2. Error is being set via `setError()` store
3. No CSS is hiding the error message

## Future Enhancements

- [ ] Error analytics and reporting
- [ ] Automatic error recovery strategies
- [ ] Error rate limiting
- [ ] Offline queue for failed requests
- [ ] Error recovery suggestions
- [ ] Integration with error tracking services (Sentry, etc.)

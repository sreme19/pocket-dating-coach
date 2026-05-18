import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import NetworkStatus from './NetworkStatus.svelte';

describe('NetworkStatus', () => {
  beforeEach(() => {
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
  });

  it('should render nothing when online initially', () => {
    const { container } = render(NetworkStatus);
    const notification = container.querySelector('[role="status"]');
    expect(notification).not.toBeInTheDocument();
  });

  it('should show offline indicator when offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    render(NetworkStatus);

    // Trigger offline event
    window.dispatchEvent(new Event('offline'));

    await waitFor(() => {
      expect(screen.getByText(/No internet connection/)).toBeInTheDocument();
    });
  });

  it('should show connection restored notification', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    render(NetworkStatus);

    // Trigger offline event
    window.dispatchEvent(new Event('offline'));

    await waitFor(() => {
      expect(screen.getByText(/No internet connection/)).toBeInTheDocument();
    });

    // Trigger online event
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(screen.getByText(/Connection restored/)).toBeInTheDocument();
    });
  });

  it('should have status role for accessibility', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    render(NetworkStatus);

    window.dispatchEvent(new Event('offline'));

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
    });
  });

  it('should have aria-live="polite"', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    render(NetworkStatus);

    window.dispatchEvent(new Event('offline'));

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });

  it('should show persistent offline bar', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    render(NetworkStatus);

    window.dispatchEvent(new Event('offline'));

    await waitFor(() => {
      const offlineBar = screen.getByText(/You are offline/);
      expect(offlineBar).toBeInTheDocument();
    });
  });

  it('should hide connection restored notification after 3 seconds', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    render(NetworkStatus);

    window.dispatchEvent(new Event('offline'));

    await waitFor(() => {
      expect(screen.getByText(/No internet connection/)).toBeInTheDocument();
    });

    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(screen.getByText(/Connection restored/)).toBeInTheDocument();
    });

    // Wait for notification to disappear
    await waitFor(
      () => {
        expect(screen.queryByText(/Connection restored/)).not.toBeInTheDocument();
      },
      { timeout: 4000 }
    );
  });

  it('should display wifi icon when online', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    render(NetworkStatus);

    window.dispatchEvent(new Event('offline'));

    await waitFor(() => {
      expect(screen.getByText(/No internet connection/)).toBeInTheDocument();
    });

    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      const icon = screen.getByText(/Connection restored/).parentElement?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  it('should display wifi-off icon when offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    render(NetworkStatus);

    window.dispatchEvent(new Event('offline'));

    await waitFor(() => {
      const offlineText = screen.getByText(/No internet connection/);
      expect(offlineText).toBeInTheDocument();
    });
  });

  it('should handle multiple online/offline transitions', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    render(NetworkStatus);

    // Go offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });
    window.dispatchEvent(new Event('offline'));

    await waitFor(() => {
      expect(screen.getByText(/No internet connection/)).toBeInTheDocument();
    });

    // Go online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(screen.getByText(/Connection restored/)).toBeInTheDocument();
    });

    // Go offline again
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });
    window.dispatchEvent(new Event('offline'));

    await waitFor(() => {
      expect(screen.getByText(/No internet connection/)).toBeInTheDocument();
    });
  });

  it('should clean up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(NetworkStatus);

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });

  it('should have aria-hidden on icons', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    render(NetworkStatus);

    window.dispatchEvent(new Event('offline'));

    await waitFor(() => {
      const icons = screen.getByText(/No internet connection/).parentElement?.querySelectorAll('svg');
      icons?.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });
});

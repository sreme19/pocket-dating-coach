import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ErrorBoundary from './ErrorBoundary.svelte';
import { error as errorStore, clearError } from '$lib/verified-vibe/stores';

describe('ErrorBoundary', () => {
  beforeEach(() => {
    clearError();
  });

  it('should render nothing when no error', () => {
    const { container } = render(ErrorBoundary);
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeInTheDocument();
  });

  it('should display error message', async () => {
    render(ErrorBoundary);

    errorStore.set('Test error message');

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });
  });

  it('should have alert role for accessibility', async () => {
    render(ErrorBoundary);

    errorStore.set('Test error');

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });
  });

  it('should have aria-live="polite"', async () => {
    render(ErrorBoundary);

    errorStore.set('Test error');

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });
  });

  it('should have aria-atomic="true"', async () => {
    render(ErrorBoundary);

    errorStore.set('Test error');

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-atomic', 'true');
    });
  });

  it('should dismiss error on close button click', async () => {
    render(ErrorBoundary);

    errorStore.set('Test error');

    await waitFor(() => {
      const closeButton = screen.getByLabelText('Dismiss error message');
      fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(screen.queryByText('Test error')).not.toBeInTheDocument();
    });
  });

  it('should show retry button when retry callback is set', async () => {
    const { component } = render(ErrorBoundary);

    errorStore.set('Test error');

    await waitFor(() => {
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    // Set retry callback
    const retryCallback = vi.fn().mockResolvedValue(undefined);
    component.setRetryCallback(retryCallback);

    await waitFor(() => {
      expect(screen.getByLabelText('Retry the failed operation')).toBeInTheDocument();
    });
  });

  it('should call retry callback on retry button click', async () => {
    const { component } = render(ErrorBoundary);

    const retryCallback = vi.fn().mockResolvedValue(undefined);
    component.setRetryCallback(retryCallback);

    errorStore.set('Test error');

    await waitFor(() => {
      const retryButton = screen.getByLabelText('Retry the failed operation');
      fireEvent.click(retryButton);
    });

    await waitFor(() => {
      expect(retryCallback).toHaveBeenCalled();
    });
  });

  it('should disable retry button while retrying', async () => {
    const { component } = render(ErrorBoundary);

    const retryCallback = vi.fn(
      (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 100))
    );
    component.setRetryCallback(retryCallback);

    errorStore.set('Test error');

    await waitFor(() => {
      const retryButton = screen.getByLabelText('Retry the failed operation') as HTMLButtonElement;
      fireEvent.click(retryButton);

      expect(retryButton.disabled).toBe(true);
      expect(retryButton.textContent).toContain('Retrying');
    });
  });

  it('should dismiss error after successful retry', async () => {
    const { component } = render(ErrorBoundary);

    const retryCallback = vi.fn().mockResolvedValue(undefined);
    component.setRetryCallback(retryCallback);

    errorStore.set('Test error');

    await waitFor(() => {
      const retryButton = screen.getByLabelText('Retry the failed operation');
      fireEvent.click(retryButton);
    });

    await waitFor(() => {
      expect(screen.queryByText('Test error')).not.toBeInTheDocument();
    });
  });

  it('should show error color for error severity', async () => {
    render(ErrorBoundary);

    errorStore.set('Unauthorized access');

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('border-red-200');
      expect(alert.className).toContain('bg-red-50');
    });
  });

  it('should show warning color for warning severity', async () => {
    render(ErrorBoundary);

    errorStore.set('Service temporarily unavailable');

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('border-amber-200');
      expect(alert.className).toContain('bg-amber-50');
    });
  });

  it('should show info color for info severity', async () => {
    render(ErrorBoundary);

    errorStore.set('Please try again');

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('border-blue-200');
      expect(alert.className).toContain('bg-blue-50');
    });
  });

  it('should have proper icon for error', async () => {
    render(ErrorBoundary);

    errorStore.set('Unauthorized access');

    await waitFor(() => {
      const icon = screen.getByRole('alert').querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  it('should have aria-label on dismiss button', async () => {
    render(ErrorBoundary);

    errorStore.set('Test error');

    await waitFor(() => {
      const dismissButton = screen.getByLabelText('Dismiss error message');
      expect(dismissButton).toBeInTheDocument();
    });
  });

  it('should have aria-label on retry button', async () => {
    const { component } = render(ErrorBoundary);

    const retryCallback = vi.fn().mockResolvedValue(undefined);
    component.setRetryCallback(retryCallback);

    errorStore.set('Test error');

    await waitFor(() => {
      const retryButton = screen.getByLabelText('Retry the failed operation');
      expect(retryButton).toBeInTheDocument();
    });
  });

  it('should handle multiple error updates', async () => {
    render(ErrorBoundary);

    errorStore.set('First error');

    await waitFor(() => {
      expect(screen.getByText('First error')).toBeInTheDocument();
    });

    errorStore.set('Second error');

    await waitFor(() => {
      expect(screen.getByText('Second error')).toBeInTheDocument();
      expect(screen.queryByText('First error')).not.toBeInTheDocument();
    });
  });

  it('should clear error on store clear', async () => {
    render(ErrorBoundary);

    errorStore.set('Test error');

    await waitFor(() => {
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    clearError();

    await waitFor(() => {
      expect(screen.queryByText('Test error')).not.toBeInTheDocument();
    });
  });
});

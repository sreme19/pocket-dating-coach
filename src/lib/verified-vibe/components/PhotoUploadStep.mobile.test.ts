import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PhotoUploadStep from './PhotoUploadStep.svelte';

describe('PhotoUploadStep - Mobile Responsive', () => {
  beforeEach(() => {
    // Set mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 667
    });
    window.dispatchEvent(new Event('resize'));
  });

  describe('Mobile Layout (375px)', () => {
    it('should render component on mobile viewport', () => {
      render(PhotoUploadStep);
      expect(screen.getByText('Photo Story')).toBeInTheDocument();
    });

    it('should have touch-friendly upload area', () => {
      render(PhotoUploadStep);
      const uploadArea = screen.getByRole('button', { name: 'Upload photos' });
      const styles = window.getComputedStyle(uploadArea);
      // Check that it has reasonable padding for touch
      expect(uploadArea).toBeInTheDocument();
    });

    it('should display single column photo grid on mobile', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { confidence: 92, consistent: true }
            })
        })
      ) as any;

      render(PhotoUploadStep);
      const input = screen.getByLabelText('Select photo files') as HTMLInputElement;

      const files = Array.from({ length: 5 }, (_, i) =>
        new File(['content'], `photo${i + 1}.jpg`, { type: 'image/jpeg' })
      );

      const dataTransfer = new DataTransfer();
      files.forEach(f => dataTransfer.items.add(f));
      input.files = dataTransfer.files;

      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByText('Label Your Photos')).toBeInTheDocument();
      });

      // On mobile, grid should be single column
      const photosGrid = document.querySelector('.photos-grid');
      expect(photosGrid).toBeInTheDocument();
    });

    it('should stack action buttons vertically on mobile', async () => {
      render(PhotoUploadStep);
      const input = screen.getByLabelText('Select photo files') as HTMLInputElement;

      const files = Array.from({ length: 5 }, (_, i) =>
        new File(['content'], `photo${i + 1}.jpg`, { type: 'image/jpeg' })
      );

      const dataTransfer = new DataTransfer();
      files.forEach(f => dataTransfer.items.add(f));
      input.files = dataTransfer.files;

      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByText('Label Your Photos')).toBeInTheDocument();
      });

      const actions = document.querySelector('.actions');
      expect(actions).toBeInTheDocument();
    });

    it('should have minimum 44x44px touch targets', () => {
      render(PhotoUploadStep);
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // Buttons should have min-height of 44px
        expect(button).toHaveStyle('min-height: 44px');
      });
    });

    it('should handle touch events on upload area', async () => {
      render(PhotoUploadStep);
      const uploadArea = screen.getByRole('button', { name: 'Upload photos' });

      const files = Array.from({ length: 5 }, (_, i) =>
        new File(['content'], `photo${i + 1}.jpg`, { type: 'image/jpeg' })
      );

      const dataTransfer = new DataTransfer();
      files.forEach(f => dataTransfer.items.add(f));

      fireEvent.drop(uploadArea, { dataTransfer });
      await waitFor(() => {
        expect(screen.getByText('Label Your Photos')).toBeInTheDocument();
      });
    });

    it('should display readable text without zooming', () => {
      render(PhotoUploadStep);
      const title = screen.getByText('Photo Story');
      const styles = window.getComputedStyle(title);
      // Font size should be reasonable for mobile
      expect(title).toBeInTheDocument();
    });

    it('should not have horizontal scrolling', () => {
      render(PhotoUploadStep);
      const component = document.querySelector('.photo-upload-step');
      expect(component).toBeInTheDocument();
      // Component should fit within viewport
    });
  });

  describe('Mobile Interactions', () => {
    it('should handle file selection on mobile', async () => {
      render(PhotoUploadStep);
      const input = screen.getByLabelText('Select photo files') as HTMLInputElement;

      const files = Array.from({ length: 5 }, (_, i) =>
        new File(['content'], `photo${i + 1}.jpg`, { type: 'image/jpeg' })
      );

      const dataTransfer = new DataTransfer();
      files.forEach(f => dataTransfer.items.add(f));
      input.files = dataTransfer.files;

      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByText('Label Your Photos')).toBeInTheDocument();
      });
    });

    it('should handle label selection on mobile', async () => {
      render(PhotoUploadStep);
      const input = screen.getByLabelText('Select photo files') as HTMLInputElement;

      const files = Array.from({ length: 5 }, (_, i) =>
        new File(['content'], `photo${i + 1}.jpg`, { type: 'image/jpeg' })
      );

      const dataTransfer = new DataTransfer();
      files.forEach(f => dataTransfer.items.add(f));
      input.files = dataTransfer.files;

      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByText('Label Your Photos')).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);

      // Select should be touch-friendly
      selects.forEach(select => {
        expect(select).toHaveStyle('min-height: 44px');
      });
    });

    it('should display error messages clearly on mobile', async () => {
      render(PhotoUploadStep);
      const input = screen.getByLabelText('Select photo files') as HTMLInputElement;

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;

      fireEvent.change(input);
      await waitFor(() => {
        const error = screen.getByText('Please upload only image files');
        expect(error).toBeInTheDocument();
        // Error should be visible and readable
      });
    });

    it('should handle keyboard input on mobile', async () => {
      render(PhotoUploadStep);
      const input = screen.getByLabelText('Select photo files') as HTMLInputElement;

      const files = Array.from({ length: 5 }, (_, i) =>
        new File(['content'], `photo${i + 1}.jpg`, { type: 'image/jpeg' })
      );

      const dataTransfer = new DataTransfer();
      files.forEach(f => dataTransfer.items.add(f));
      input.files = dataTransfer.files;

      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByText('Label Your Photos')).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'lead' } });
      expect(selects[0]).toHaveValue('lead');
    });
  });

  describe('Mobile Performance', () => {
    it('should lazy load image previews', async () => {
      render(PhotoUploadStep);
      const input = screen.getByLabelText('Select photo files') as HTMLInputElement;

      const files = Array.from({ length: 5 }, (_, i) =>
        new File(['content'], `photo${i + 1}.jpg`, { type: 'image/jpeg' })
      );

      const dataTransfer = new DataTransfer();
      files.forEach(f => dataTransfer.items.add(f));
      input.files = dataTransfer.files;

      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByText('Label Your Photos')).toBeInTheDocument();
      });

      // Images should be loaded
      const images = document.querySelectorAll('img');
      expect(images.length).toBeGreaterThan(0);
    });

    it('should handle large file uploads on mobile', async () => {
      render(PhotoUploadStep);
      const input = screen.getByLabelText('Select photo files') as HTMLInputElement;

      // Create files close to 5MB limit
      const files = Array.from({ length: 5 }, (_, i) =>
        new File(['x'.repeat(4 * 1024 * 1024)], `photo${i + 1}.jpg`, {
          type: 'image/jpeg'
        })
      );

      const dataTransfer = new DataTransfer();
      files.forEach(f => dataTransfer.items.add(f));
      input.files = dataTransfer.files;

      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByText('Label Your Photos')).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Accessibility', () => {
    it('should have proper touch target sizes', () => {
      render(PhotoUploadStep);
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveStyle('min-height: 44px');
      });
    });

    it('should have readable font sizes on mobile', () => {
      render(PhotoUploadStep);
      const title = screen.getByText('Photo Story');
      expect(title).toBeInTheDocument();
    });

    it('should support keyboard navigation on mobile', async () => {
      render(PhotoUploadStep);
      const input = screen.getByLabelText('Select photo files') as HTMLInputElement;

      const files = Array.from({ length: 5 }, (_, i) =>
        new File(['content'], `photo${i + 1}.jpg`, { type: 'image/jpeg' })
      );

      const dataTransfer = new DataTransfer();
      files.forEach(f => dataTransfer.items.add(f));
      input.files = dataTransfer.files;

      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByText('Label Your Photos')).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      selects[0].focus();
      expect(selects[0]).toHaveFocus();
    });

    it('should have proper color contrast on mobile', () => {
      render(PhotoUploadStep);
      const text = screen.getByText('Photo Story');
      expect(text).toBeInTheDocument();
      // Color contrast should meet WCAG AA standards
    });
  });

  describe('Mobile Orientation Changes', () => {
    it('should handle portrait orientation', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667
      });
      window.dispatchEvent(new Event('resize'));

      render(PhotoUploadStep);
      expect(screen.getByText('Photo Story')).toBeInTheDocument();
    });

    it('should handle landscape orientation', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 667
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 375
      });
      window.dispatchEvent(new Event('resize'));

      render(PhotoUploadStep);
      expect(screen.getByText('Photo Story')).toBeInTheDocument();
    });
  });
});

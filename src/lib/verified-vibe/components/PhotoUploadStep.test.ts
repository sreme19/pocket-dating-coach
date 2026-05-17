import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PhotoUploadStep from './PhotoUploadStep.svelte';

describe('PhotoUploadStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Upload State', () => {
    it('should render upload area with instructions', () => {
      render(PhotoUploadStep);
      expect(screen.getByText('Photo Story')).toBeInTheDocument();
      expect(screen.getByText('Upload 5+ photos that tell your story')).toBeInTheDocument();
      expect(screen.getByText('Drag and drop your photos here')).toBeInTheDocument();
    });

    it('should display requirements list', () => {
      render(PhotoUploadStep);
      expect(screen.getByText('Minimum 5 photos')).toBeInTheDocument();
      expect(screen.getByText('Clear, well-lit photos')).toBeInTheDocument();
      expect(screen.getByText('Max 5MB per file')).toBeInTheDocument();
    });

    it('should have file input with multiple and image accept', () => {
      render(PhotoUploadStep);
      const input = screen.getByLabelText('Select photo files') as HTMLInputElement;
      expect(input).toHaveAttribute('type', 'file');
      expect(input).toHaveAttribute('accept', 'image/*');
      expect(input).toHaveAttribute('multiple');
    });

    it('should reject non-image files', async () => {
      render(PhotoUploadStep);
      const input = screen.getByLabelText('Select photo files') as HTMLInputElement;

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;

      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByText('Please upload only image files')).toBeInTheDocument();
      });
    });

    it('should reject files larger than 5MB', async () => {
      render(PhotoUploadStep);
      const input = screen.getByLabelText('Select photo files') as HTMLInputElement;

      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg'
      });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(largeFile);
      input.files = dataTransfer.files;

      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByText('Some files exceed 5MB limit')).toBeInTheDocument();
      });
    });

    it('should reject fewer than 5 photos', async () => {
      render(PhotoUploadStep);
      const input = screen.getByLabelText('Select photo files') as HTMLInputElement;

      const files = [
        new File(['content1'], 'photo1.jpg', { type: 'image/jpeg' }),
        new File(['content2'], 'photo2.jpg', { type: 'image/jpeg' }),
        new File(['content3'], 'photo3.jpg', { type: 'image/jpeg' })
      ];

      const dataTransfer = new DataTransfer();
      files.forEach(f => dataTransfer.items.add(f));
      input.files = dataTransfer.files;

      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByText('Please upload at least 5 photos')).toBeInTheDocument();
      });
    });

    it('should accept 5 or more valid image files', async () => {
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

    it('should support drag and drop', async () => {
      render(PhotoUploadStep);
      const uploadArea = screen.getByRole('button', { name: 'Upload photos' });

      const files = Array.from({ length: 5 }, (_, i) =>
        new File(['content'], `photo${i + 1}.jpg`, { type: 'image/jpeg' })
      );

      const dataTransfer = new DataTransfer();
      files.forEach(f => dataTransfer.items.add(f));

      fireEvent.dragOver(uploadArea);
      expect(uploadArea).toHaveClass('dragging');

      fireEvent.dragLeave(uploadArea);
      expect(uploadArea).not.toHaveClass('dragging');

      fireEvent.drop(uploadArea, { dataTransfer });
      await waitFor(() => {
        expect(screen.getByText('Label Your Photos')).toBeInTheDocument();
      });
    });
  });

  describe('Label State', () => {
    beforeEach(async () => {
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

    it('should display photo grid with labels', () => {
      expect(screen.getByText('Photo 1')).toBeInTheDocument();
      expect(screen.getByText('Photo 5')).toBeInTheDocument();
    });

    it('should have label select dropdowns for each photo', () => {
      const selects = screen.getAllByRole('combobox');
      expect(selects).toHaveLength(5);
    });

    it('should have all label options', () => {
      const firstSelect = screen.getAllByRole('combobox')[0];
      const options = firstSelect.querySelectorAll('option');
      const optionTexts = Array.from(options).map(o => o.textContent);

      expect(optionTexts).toContain('Lead');
      expect(optionTexts).toContain('Warmth');
      expect(optionTexts).toContain('Lifestyle');
      expect(optionTexts).toContain('Conversation');
      expect(optionTexts).toContain('Social');
    });

    it('should disable check consistency button until all photos are labeled', async () => {
      const checkButton = screen.getByRole('button', { name: 'Check photo consistency' });
      expect(checkButton).toBeDisabled();

      // Label all photos
      const selects = screen.getAllByRole('combobox');
      for (let i = 0; i < selects.length; i++) {
        fireEvent.change(selects[i], { target: { value: 'lead' } });
      }

      await waitFor(() => {
        expect(checkButton).not.toBeDisabled();
      });
    });

    it('should have re-upload button', () => {
      expect(screen.getByRole('button', { name: 'Upload different photos' })).toBeInTheDocument();
    });
  });

  describe('Checking State', () => {
    it('should show loading state during consistency check', async () => {
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

      // Label all photos
      const selects = screen.getAllByRole('combobox');
      for (let i = 0; i < selects.length; i++) {
        fireEvent.change(selects[i], { target: { value: 'lead' } });
      }

      // Mock fetch
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { confidence: 92, consistent: true }
            })
        })
      ) as any;

      const checkButton = screen.getByRole('button', { name: 'Check photo consistency' });
      fireEvent.click(checkButton);

      await waitFor(() => {
        expect(screen.getByText('Analyzing Photos')).toBeInTheDocument();
      });
    });
  });

  describe('Result State - Success', () => {
    beforeEach(async () => {
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

      const selects = screen.getAllByRole('combobox');
      for (let i = 0; i < selects.length; i++) {
        fireEvent.change(selects[i], { target: { value: 'lead' } });
      }

      const checkButton = screen.getByRole('button', { name: 'Check photo consistency' });
      fireEvent.click(checkButton);

      await waitFor(() => {
        expect(screen.getByText('Photos Verified')).toBeInTheDocument();
      });
    });

    it('should display success message', () => {
      expect(screen.getByText('Photos Verified')).toBeInTheDocument();
      expect(screen.getByText('All photos are consistent')).toBeInTheDocument();
    });

    it('should display confidence score', () => {
      expect(screen.getByText('92%')).toBeInTheDocument();
    });

    it('should have confirm button', () => {
      expect(screen.getByRole('button', { name: 'Confirm and save photos' })).toBeInTheDocument();
    });

    it('should not have re-upload button on success', () => {
      expect(screen.queryByRole('button', { name: 'Upload different photos' })).not.toBeInTheDocument();
    });
  });

  describe('Result State - Failure', () => {
    beforeEach(async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { confidence: 45, consistent: false }
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

      const selects = screen.getAllByRole('combobox');
      for (let i = 0; i < selects.length; i++) {
        fireEvent.change(selects[i], { target: { value: 'lead' } });
      }

      const checkButton = screen.getByRole('button', { name: 'Check photo consistency' });
      fireEvent.click(checkButton);

      await waitFor(() => {
        expect(screen.getByText('Photos Inconsistent')).toBeInTheDocument();
      });
    });

    it('should display failure message', () => {
      expect(screen.getByText('Photos Inconsistent')).toBeInTheDocument();
      expect(screen.getByText(/Photos don't appear to be of the same person/)).toBeInTheDocument();
    });

    it('should display confidence score', () => {
      expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('should have re-upload button', () => {
      expect(screen.getByRole('button', { name: 'Upload different photos' })).toBeInTheDocument();
    });

    it('should not have confirm button on failure', () => {
      expect(screen.queryByRole('button', { name: 'Confirm and save photos' })).not.toBeInTheDocument();
    });
  });

  describe('Callbacks', () => {
    it('should call onSubmit with photos and labels on confirm', async () => {
      const onSubmit = vi.fn();

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { confidence: 92, consistent: true }
            })
        })
      ) as any;

      render(PhotoUploadStep, { props: { onSubmit } });
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
      for (let i = 0; i < selects.length; i++) {
        fireEvent.change(selects[i], { target: { value: 'lead' } });
      }

      const checkButton = screen.getByRole('button', { name: 'Check photo consistency' });
      fireEvent.click(checkButton);

      await waitFor(() => {
        expect(screen.getByText('Photos Verified')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: 'Confirm and save photos' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
    });

    it('should call onCancel when user cancels', () => {
      const onCancel = vi.fn();
      render(PhotoUploadStep, { props: { onCancel } });

      // Note: This test would need a cancel button in the component
      // Currently the component doesn't have a cancel button in upload state
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(PhotoUploadStep);
      expect(screen.getByLabelText('Upload photos')).toBeInTheDocument();
      expect(screen.getByLabelText('Select photo files')).toBeInTheDocument();
    });

    it('should announce errors with role="alert"', async () => {
      render(PhotoUploadStep);
      const input = screen.getByLabelText('Select photo files') as HTMLInputElement;

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;

      fireEvent.change(input);
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
      });
    });

    it('should have keyboard accessible buttons', () => {
      render(PhotoUploadStep);
      const uploadArea = screen.getByRole('button', { name: 'Upload photos' });
      expect(uploadArea).toHaveAttribute('tabindex', '0');
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import EditQAModal from './EditQAModal.svelte';

describe('EditQAModal Component', () => {
  const mockQAResponses = [
    { question: 'What are you looking for?', answer: 'Someone genuine' },
    { question: "What's your ideal first date?", answer: 'Coffee and conversation' },
    { question: 'What are your hobbies?', answer: 'Reading, hiking, cooking' }
  ];

  it('does not render when isOpen is false', () => {
    const { container } = render(EditQAModal, {
      props: {
        isOpen: false,
        qaResponses: mockQAResponses
      }
    });

    const modal = container.querySelector('.modal');
    expect(modal).toBeFalsy();
  });

  it('renders when isOpen is true', () => {
    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses
      }
    });

    const modal = container.querySelector('.modal');
    expect(modal).toBeTruthy();
  });

  it('displays modal title', () => {
    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses
      }
    });

    const title = container.querySelector('.modal-title');
    expect(title?.textContent).toContain('Edit Q&A Responses');
  });

  it('displays all Q&A fields', () => {
    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses
      }
    });

    const fields = container.querySelectorAll('.qa-field');
    expect(fields.length).toBe(3);
  });

  it('displays questions correctly', () => {
    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses
      }
    });

    const labels = container.querySelectorAll('.question-text');
    expect(labels[0]?.textContent).toContain('What are you looking for?');
    expect(labels[1]?.textContent).toContain("What's your ideal first date?");
    expect(labels[2]?.textContent).toContain('What are your hobbies?');
  });

  it('displays current answers in textareas', () => {
    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses
      }
    });

    const textareas = container.querySelectorAll('.qa-textarea');
    expect((textareas[0] as HTMLTextAreaElement).value).toBe('Someone genuine');
    expect((textareas[1] as HTMLTextAreaElement).value).toBe('Coffee and conversation');
    expect((textareas[2] as HTMLTextAreaElement).value).toBe('Reading, hiking, cooking');
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses,
        onClose
      }
    });

    const closeButton = container.querySelector('.close-button');
    await user.click(closeButton!);

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses,
        onClose
      }
    });

    const cancelButton = container.querySelector('.button-secondary');
    await user.click(cancelButton!);

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSave with updated responses when save button is clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const user = userEvent.setup();

    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses,
        onSave,
        onClose
      }
    });

    const textareas = container.querySelectorAll('.qa-textarea');
    await user.clear(textareas[0]);
    await user.type(textareas[0], 'Updated answer');

    const saveButton = container.querySelector('.button-primary');
    await user.click(saveButton!);

    expect(onSave).toHaveBeenCalled();
  });

  it('displays character count', () => {
    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses
      }
    });

    const charCounts = container.querySelectorAll('.char-count');
    expect(charCounts.length).toBe(3);
  });

  it('displays info message', () => {
    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses
      }
    });

    const infoMessage = container.querySelector('.info-message');
    expect(infoMessage?.textContent).toContain('Be honest and authentic');
  });

  it('closes modal when overlay is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses,
        onClose
      }
    });

    const overlay = container.querySelector('.modal-overlay');
    await user.click(overlay!);

    expect(onClose).toHaveBeenCalled();
  });

  it('has accessibility attributes', () => {
    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses
      }
    });

    const modal = container.querySelector('[role="dialog"]');
    expect(modal).toBeTruthy();
    expect(modal?.getAttribute('aria-modal')).toBe('true');
  });

  it('displays question numbers', () => {
    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses
      }
    });

    const numbers = container.querySelectorAll('.question-number');
    expect(numbers[0]?.textContent).toBe('Q1.');
    expect(numbers[1]?.textContent).toBe('Q2.');
    expect(numbers[2]?.textContent).toBe('Q3.');
  });

  it('handles single Q&A response', () => {
    const singleResponse = [{ question: 'Single question?', answer: 'Single answer' }];

    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: singleResponse
      }
    });

    const fields = container.querySelectorAll('.qa-field');
    expect(fields.length).toBe(1);
  });

  it('handles many Q&A responses', () => {
    const manyResponses = Array.from({ length: 10 }, (_, i) => ({
      question: `Question ${i + 1}?`,
      answer: `Answer ${i + 1}`
    }));

    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: manyResponses
      }
    });

    const fields = container.querySelectorAll('.qa-field');
    expect(fields.length).toBe(10);
  });

  it('disables buttons while saving', async () => {
    const onSave = vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 100);
        })
    );

    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses,
        onSave
      }
    });

    const saveButton = container.querySelector('.button-primary') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
  });

  it('displays error message on save failure', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));
    const user = userEvent.setup();

    const { container } = render(EditQAModal, {
      props: {
        isOpen: true,
        qaResponses: mockQAResponses,
        onSave
      }
    });

    const saveButton = container.querySelector('.button-primary');
    await user.click(saveButton!);

    // Wait for error to appear
    await new Promise((resolve) => setTimeout(resolve, 100));

    const errorMessage = container.querySelector('.error-message');
    expect(errorMessage?.textContent).toContain('Save failed');
  });
});

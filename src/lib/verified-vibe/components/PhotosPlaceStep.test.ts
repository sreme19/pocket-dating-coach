import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PhotosPlaceStep from './PhotosPlaceStep.svelte';

/**
 * The photos step is the last gate before a profile goes live. Two things must
 * hold for every viewer: they are TOLD their photos are matched against their
 * verification selfie (before they pick, not after we reject), and they cannot
 * leave without a photo — Continue stays disabled and there is no skip escape.
 */
describe('PhotosPlaceStep', () => {
  const noop = () => {};

  it('warns that photos are matched against the verification selfie', () => {
    render(PhotosPlaceStep, { props: { gender: 'woman', onSubmit: noop } });
    expect(screen.getByText(/Photos of you only/i)).toBeInTheDocument();
    expect(screen.getByText(/check every photo against your\s+verification selfie/i)).toBeInTheDocument();
  });

  it('shows the identity warning to men too', () => {
    render(PhotosPlaceStep, { props: { gender: 'man', onSubmit: noop } });
    expect(screen.getByText(/Photos of you only/i)).toBeInTheDocument();
  });

  it('offers no skip escape when the parent passes no onSkip', () => {
    render(PhotosPlaceStep, { props: { gender: 'woman', onSubmit: noop } });
    expect(screen.queryByText('Skip this step')).not.toBeInTheDocument();
  });

  it('keeps the submit button disabled until a photo is added', () => {
    render(PhotosPlaceStep, {
      props: { gender: 'woman', initialFirstName: 'Asha', initialAge: 27, onSubmit: noop },
    });
    // Name + age are pre-filled, so photos (and city) are what still block it.
    const submit = screen.getByRole('button', { name: /go live|continue|finish/i });
    expect(submit).toBeDisabled();
  });
});

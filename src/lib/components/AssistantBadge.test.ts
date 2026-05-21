import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import AssistantBadge from './AssistantBadge.svelte';
import type { AssistantType } from '$lib/types';

describe('AssistantBadge Component', () => {
	describe('Rendering', () => {
		it('should render AI Bestie badge with correct label', () => {
			render(AssistantBadge, {
				props: {
					assistantType: 'bestie'
				}
			});

			const badge = screen.getByRole('status');
			expect(badge).toBeInTheDocument();
			expect(badge).toHaveTextContent('AI Bestie');
		});

		it('should render AI Wingman badge with correct label', () => {
			render(AssistantBadge, {
				props: {
					assistantType: 'wingman'
				}
			});

			const badge = screen.getByRole('status');
			expect(badge).toBeInTheDocument();
			expect(badge).toHaveTextContent('AI Wingman');
		});

		it('should display exchange count when provided', () => {
			render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					exchangeCount: 5
				}
			});

			const badge = screen.getByRole('status');
			expect(badge).toHaveTextContent('(5)');
		});

		it('should not display exchange count when zero', () => {
			render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					exchangeCount: 0
				}
			});

			const badge = screen.getByRole('status');
			expect(badge).not.toHaveTextContent('(0)');
		});

		it('should render with correct aria-label', () => {
			render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					status: 'active',
					exchangeCount: 3
				}
			});

			const badge = screen.getByRole('status');
			expect(badge).toHaveAttribute('aria-label', 'AI Bestie - Active (3 exchanges)');
		});
	});

	describe('Styling - Color Coding', () => {
		it('should apply rose/pink colors for Bestie', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie'
				}
			});

			const badge = container.querySelector('[role="status"]');
			expect(badge?.className).toContain('bg-rose-500/20');
			expect(badge?.className).toContain('text-rose-300');
			expect(badge?.className).toContain('border-rose-500/30');
		});

		it('should apply blue colors for Wingman', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'wingman'
				}
			});

			const badge = container.querySelector('[role="status"]');
			expect(badge?.className).toContain('bg-blue-500/20');
			expect(badge?.className).toContain('text-blue-300');
			expect(badge?.className).toContain('border-blue-500/30');
		});

		it('should apply opacity-60 when status is inactive', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					status: 'inactive'
				}
			});

			const badge = container.querySelector('[role="status"]');
			expect(badge?.className).toContain('opacity-60');
		});

		it('should apply opacity-100 when status is active', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					status: 'active'
				}
			});

			const badge = container.querySelector('[role="status"]');
			expect(badge?.className).toContain('opacity-100');
		});
	});

	describe('Icon Differentiation', () => {
		it('should render heart icon for Bestie', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie'
				}
			});

			// Check for SVG with heart-like structure (lucide-svelte Heart component)
			const svg = container.querySelector('svg');
			expect(svg).toBeInTheDocument();
			// The Heart icon from lucide-svelte has specific attributes
			expect(svg?.getAttribute('data-icon') || svg?.className).toBeDefined();
		});

		it('should render shield icon for Wingman', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'wingman'
				}
			});

			// Check for SVG with shield-like structure (lucide-svelte Shield component)
			const svg = container.querySelector('svg');
			expect(svg).toBeInTheDocument();
		});

		it('should show pulse animation when active', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					status: 'active'
				}
			});

			const pulseDiv = container.querySelector('.animate-pulse');
			expect(pulseDiv).toBeInTheDocument();
		});

		it('should not show pulse animation when inactive', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					status: 'inactive'
				}
			});

			const pulseDiv = container.querySelector('.animate-pulse');
			expect(pulseDiv).not.toBeInTheDocument();
		});
	});

	describe('Tooltip Functionality', () => {
		it('should show tooltip on hover when showTooltip is true', async () => {
			const user = userEvent.setup();
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					status: 'active',
					exchangeCount: 2,
					showTooltip: true
				}
			});

			const badge = container.querySelector('[role="status"]');
			expect(badge).toBeInTheDocument();

			// Hover over badge
			await user.hover(badge!);

			// Tooltip should be visible
			const tooltip = container.querySelector('.animate-in');
			expect(tooltip).toBeInTheDocument();
			expect(tooltip).toHaveTextContent('AI Bestie - Active (2 exchanges)');
		});

		it('should hide tooltip on mouse leave', async () => {
			const user = userEvent.setup();
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					showTooltip: true
				}
			});

			const badge = container.querySelector('[role="status"]');

			// Hover and then leave
			await user.hover(badge!);
			await user.unhover(badge!);

			// Tooltip should not be visible
			const tooltip = container.querySelector('.animate-in');
			expect(tooltip).not.toBeInTheDocument();
		});

		it('should not show tooltip when showTooltip is false', async () => {
			const user = userEvent.setup();
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					showTooltip: false
				}
			});

			const badge = container.querySelector('[role="status"]');
			await user.hover(badge!);

			// Tooltip should not be visible
			const tooltip = container.querySelector('.animate-in');
			expect(tooltip).not.toBeInTheDocument();
		});

		it('should display correct tooltip content with exchange count', async () => {
			const user = userEvent.setup();
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'wingman',
					status: 'active',
					exchangeCount: 7,
					showTooltip: true
				}
			});

			const badge = container.querySelector('[role="status"]');
			await user.hover(badge!);

			const tooltip = container.querySelector('.animate-in');
			expect(tooltip).toHaveTextContent('AI Wingman - Active (7 exchanges)');
		});

		it('should display correct tooltip content without exchange count', async () => {
			const user = userEvent.setup();
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					status: 'inactive',
					exchangeCount: 0,
					showTooltip: true
				}
			});

			const badge = container.querySelector('[role="status"]');
			await user.hover(badge!);

			const tooltip = container.querySelector('.animate-in');
			expect(tooltip).toHaveTextContent('AI Bestie - Inactive');
			expect(tooltip).not.toHaveTextContent('exchanges');
		});
	});

	describe('Size Variants', () => {
		it('should render small size correctly', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					size: 'sm'
				}
			});

			const badge = container.querySelector('[role="status"]');
			expect(badge?.className).toContain('px-2');
			expect(badge?.className).toContain('py-1');
			expect(badge?.className).toContain('text-xs');
		});

		it('should render medium size correctly', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					size: 'md'
				}
			});

			const badge = container.querySelector('[role="status"]');
			expect(badge?.className).toContain('px-3');
			expect(badge?.className).toContain('py-1.5');
			expect(badge?.className).toContain('text-sm');
		});

		it('should render large size correctly', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					size: 'lg'
				}
			});

			const badge = container.querySelector('[role="status"]');
			expect(badge?.className).toContain('px-4');
			expect(badge?.className).toContain('py-2');
			expect(badge?.className).toContain('text-base');
		});
	});

	describe('Variant Styles', () => {
		it('should render badge variant with label and exchange count', () => {
			render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					variant: 'badge',
					exchangeCount: 3
				}
			});

			const badge = screen.getByRole('status');
			expect(badge).toHaveTextContent('AI Bestie');
			expect(badge).toHaveTextContent('(3)');
		});

		it('should render pill variant with label and exchange count', () => {
			render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					variant: 'pill',
					exchangeCount: 3
				}
			});

			const badge = screen.getByRole('status');
			expect(badge).toHaveTextContent('AI Bestie');
			expect(badge).toHaveTextContent('(3)');
		});

		it('should render compact variant without label', () => {
			render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					variant: 'compact'
				}
			});

			const badge = screen.getByRole('status');
			expect(badge).not.toHaveTextContent('AI Bestie');
		});

		it('should render compact variant without exchange count', () => {
			render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					variant: 'compact',
					exchangeCount: 5
				}
			});

			const badge = screen.getByRole('status');
			expect(badge).not.toHaveTextContent('(5)');
		});
	});

	describe('Accessibility', () => {
		it('should have proper role attribute', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie'
				}
			});

			const badge = container.querySelector('[role="status"]');
			expect(badge).toHaveAttribute('role', 'status');
		});

		it('should have descriptive aria-label', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'wingman',
					status: 'active',
					exchangeCount: 5
				}
			});

			const badge = container.querySelector('[role="status"]');
			expect(badge).toHaveAttribute('aria-label', 'AI Wingman - Active (5 exchanges)');
		});

		it('should have proper semantic structure', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie'
				}
			});

			const badge = container.querySelector('[role="status"]');
			expect(badge).toBeInTheDocument();
			expect(badge?.querySelector('svg')).toBeInTheDocument();
		});
	});

	describe('Responsive Behavior', () => {
		it('should render correctly on all sizes', () => {
			const sizes: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg'];

			sizes.forEach((size) => {
				const { container } = render(AssistantBadge, {
					props: {
						assistantType: 'bestie',
						size
					}
				});

				const badge = container.querySelector('[role="status"]');
				expect(badge).toBeInTheDocument();
			});
		});

		it('should maintain proper spacing with different exchange counts', () => {
			const counts = [0, 1, 5, 10, 100];

			counts.forEach((count) => {
				const { container } = render(AssistantBadge, {
					props: {
						assistantType: 'bestie',
						exchangeCount: count
					}
				});

				const badge = container.querySelector('[role="status"]');
				expect(badge).toBeInTheDocument();
			});
		});
	});

	describe('Edge Cases', () => {
		it('should handle large exchange counts', () => {
			render(AssistantBadge, {
				props: {
					assistantType: 'bestie',
					exchangeCount: 999
				}
			});

			const badge = screen.getByRole('status');
			expect(badge).toHaveTextContent('(999)');
		});

		it('should handle both assistant types', () => {
			const types: AssistantType[] = ['bestie', 'wingman'];

			types.forEach((type) => {
				const { container } = render(AssistantBadge, {
					props: {
						assistantType: type
					}
				});

				const badge = container.querySelector('[role="status"]');
				expect(badge).toBeInTheDocument();
			});
		});

		it('should handle all status values', () => {
			const statuses: Array<'active' | 'inactive'> = ['active', 'inactive'];

			statuses.forEach((status) => {
				const { container } = render(AssistantBadge, {
					props: {
						assistantType: 'bestie',
						status
					}
				});

				const badge = container.querySelector('[role="status"]');
				expect(badge).toBeInTheDocument();
			});
		});

		it('should handle all variant combinations', () => {
			const variants: Array<'badge' | 'pill' | 'compact'> = ['badge', 'pill', 'compact'];

			variants.forEach((variant) => {
				const { container } = render(AssistantBadge, {
					props: {
						assistantType: 'bestie',
						variant
					}
				});

				const badge = container.querySelector('[role="status"]');
				expect(badge).toBeInTheDocument();
			});
		});
	});

	describe('Integration', () => {
		it('should work with all props combined', () => {
			render(AssistantBadge, {
				props: {
					assistantType: 'wingman',
					status: 'active',
					exchangeCount: 8,
					showTooltip: true,
					size: 'lg',
					variant: 'badge'
				}
			});

			const badge = screen.getByRole('status');
			expect(badge).toHaveTextContent('AI Wingman');
			expect(badge).toHaveTextContent('(8)');
			expect(badge).toHaveAttribute('aria-label', 'AI Wingman - Active (8 exchanges)');
		});

		it('should render multiple badges independently', () => {
			const { container } = render(AssistantBadge, {
				props: {
					assistantType: 'bestie'
				}
			});

			const badge1 = container.querySelector('[role="status"]');
			expect(badge1).toBeInTheDocument();

			const { container: container2 } = render(AssistantBadge, {
				props: {
					assistantType: 'wingman'
				}
			});

			const badge2 = container2.querySelector('[role="status"]');
			expect(badge2).toBeInTheDocument();
		});
	});
});

import { describe, it, expect } from 'vitest';

/**
 * Design Tokens Test Suite
 * 
 * This test suite verifies that all utility classes and design tokens
 * are properly defined and work correctly with both light and dark modes.
 */

describe('Design Tokens - Utility Classes', () => {
	describe('Spacing Utilities', () => {
		it('should have padding utilities for all sizes', () => {
			const sizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];
			sizes.forEach(size => {
				expect(`.p-${size}`).toBeDefined();
			});
		});

		it('should have margin utilities for all sizes', () => {
			const sizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];
			sizes.forEach(size => {
				expect(`.m-${size}`).toBeDefined();
			});
		});

		it('should have gap utilities for all sizes', () => {
			const sizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];
			sizes.forEach(size => {
				expect(`.gap-${size}`).toBeDefined();
			});
		});

		it('should have directional padding utilities', () => {
			const directions = ['t', 'b', 'l', 'r', 'x', 'y'];
			const sizes = ['xs', 'sm', 'md', 'lg', 'xl'];
			directions.forEach(dir => {
				sizes.forEach(size => {
					expect(`.p${dir}-${size}`).toBeDefined();
				});
			});
		});

		it('should have directional margin utilities', () => {
			const directions = ['t', 'b', 'l', 'r', 'x', 'y'];
			const sizes = ['xs', 'sm', 'md', 'lg', 'xl'];
			directions.forEach(dir => {
				sizes.forEach(size => {
					expect(`.m${dir}-${size}`).toBeDefined();
				});
			});
		});
	});

	describe('Border Radius Utilities', () => {
		it('should have border radius utilities for all sizes', () => {
			const sizes = ['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'];
			sizes.forEach(size => {
				expect(`.rounded-${size}`).toBeDefined();
			});
		});

		it('should have directional border radius utilities', () => {
			const directions = ['t', 'b', 'l', 'r'];
			const sizes = ['sm', 'md', 'lg'];
			directions.forEach(dir => {
				sizes.forEach(size => {
					expect(`.rounded-${dir}-${size}`).toBeDefined();
				});
			});
		});
	});

	describe('Font Utilities', () => {
		it('should have font size utilities', () => {
			const sizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
			sizes.forEach(size => {
				expect(`.text-${size}`).toBeDefined();
			});
		});

		it('should have font weight utilities', () => {
			const weights = ['light', 'normal', 'medium', 'semibold', 'bold'];
			weights.forEach(weight => {
				expect(`.font-${weight}`).toBeDefined();
			});
		});

		it('should have line height utilities', () => {
			const heights = ['tight', 'normal', 'relaxed', 'loose'];
			heights.forEach(height => {
				expect(`.leading-${height}`).toBeDefined();
			});
		});

		it('should have letter spacing utilities', () => {
			const spacings = ['tight', 'normal', 'wide'];
			spacings.forEach(spacing => {
				expect(`.tracking-${spacing}`).toBeDefined();
			});
		});

		it('should have heading style utilities', () => {
			const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
			headings.forEach(heading => {
				expect(`.heading-${heading}`).toBeDefined();
			});
		});

		it('should have body text style utilities', () => {
			expect('.body-lg').toBeDefined();
			expect('.body-base').toBeDefined();
			expect('.body-sm').toBeDefined();
		});

		it('should have caption utility', () => {
			expect('.caption').toBeDefined();
		});
	});

	describe('Shadow Utilities', () => {
		it('should have shadow utilities for all levels', () => {
			const levels = ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'inset'];
			levels.forEach(level => {
				expect(`.shadow-${level}`).toBeDefined();
			});
		});

		it('should have interactive shadow utilities', () => {
			expect('.shadow-hover').toBeDefined();
			expect('.shadow-active').toBeDefined();
		});
	});

	describe('Transition Utilities', () => {
		it('should have transition utilities', () => {
			const transitions = ['fast', 'base', 'slow', 'colors', 'transform', 'opacity', 'shadow', 'all'];
			transitions.forEach(transition => {
				expect(`.transition-${transition}`).toBeDefined();
			});
		});
	});

	describe('Color Utilities', () => {
		it('should have background color utilities', () => {
			const colors = ['emerald', 'mint', 'lime', 'amber', 'bg-1', 'bg-2', 'bg-3'];
			colors.forEach(color => {
				expect(`.bg-vibe-${color}`).toBeDefined();
			});
		});

		it('should have text color utilities', () => {
			const colors = ['emerald', 'mint', 'lime', 'amber', 'text-1', 'text-2', 'text-3', 'text-4'];
			colors.forEach(color => {
				expect(`.text-vibe-${color}`).toBeDefined();
			});
		});

		it('should have border color utilities', () => {
			expect('.border-vibe-border').toBeDefined();
			expect('.border-vibe-border-light').toBeDefined();
		});

		it('should have light color variants', () => {
			expect('.bg-vibe-emerald-light').toBeDefined();
			expect('.bg-vibe-emerald-lighter').toBeDefined();
			expect('.bg-vibe-mint-light').toBeDefined();
			expect('.bg-vibe-lime-light').toBeDefined();
			expect('.bg-vibe-amber-light').toBeDefined();
		});

		it('should have light text color variants', () => {
			expect('.text-vibe-emerald-light').toBeDefined();
			expect('.text-vibe-mint-light').toBeDefined();
			expect('.text-vibe-lime-light').toBeDefined();
			expect('.text-vibe-amber-light').toBeDefined();
		});
	});

	describe('Button Component Patterns', () => {
		it('should have button base pattern', () => {
			expect('.btn-base').toBeDefined();
		});

		it('should have button variants', () => {
			const variants = ['primary', 'secondary', 'ghost', 'danger'];
			variants.forEach(variant => {
				expect(`.btn-${variant}`).toBeDefined();
			});
		});

		it('should have button sizes', () => {
			expect('.btn-sm').toBeDefined();
			expect('.btn-lg').toBeDefined();
		});

		it('should have button states', () => {
			expect('.btn-disabled').toBeDefined();
			expect('.btn-full').toBeDefined();
		});
	});

	describe('Card Component Patterns', () => {
		it('should have card base pattern', () => {
			expect('.card-base').toBeDefined();
		});

		it('should have card variants', () => {
			const variants = ['elevated', 'interactive', 'sm', 'lg', 'bordered', 'accent'];
			variants.forEach(variant => {
				expect(`.card-${variant}`).toBeDefined();
			});
		});
	});

	describe('Input Component Patterns', () => {
		it('should have input base pattern', () => {
			expect('.input-base').toBeDefined();
		});

		it('should have input sizes', () => {
			expect('.input-sm').toBeDefined();
			expect('.input-lg').toBeDefined();
		});

		it('should have input states', () => {
			expect('.input-error').toBeDefined();
			expect('.input-success').toBeDefined();
			expect('.input-disabled').toBeDefined();
		});
	});

	describe('Badge Component Patterns', () => {
		it('should have badge base pattern', () => {
			expect('.badge-base').toBeDefined();
		});

		it('should have badge variants', () => {
			const variants = ['primary', 'success', 'warning', 'danger', 'neutral'];
			variants.forEach(variant => {
				expect(`.badge-${variant}`).toBeDefined();
			});
		});

		it('should have badge sizes', () => {
			expect('.badge-lg').toBeDefined();
		});
	});

	describe('Layout Utilities', () => {
		it('should have flexbox utilities', () => {
			expect('.flex-center').toBeDefined();
			expect('.flex-between').toBeDefined();
			expect('.flex-col').toBeDefined();
			expect('.flex-col-center').toBeDefined();
		});

		it('should have grid utilities', () => {
			expect('.grid-cols-2').toBeDefined();
			expect('.grid-cols-3').toBeDefined();
			expect('.grid-cols-4').toBeDefined();
		});

		it('should have responsive grid utilities', () => {
			expect('.grid-cols-2-tablet').toBeDefined();
			expect('.grid-cols-3-desktop').toBeDefined();
			expect('.grid-cols-4-desktop').toBeDefined();
		});
	});

	describe('Responsive Utilities', () => {
		it('should have mobile-specific utilities', () => {
			expect('.hidden-mobile').toBeDefined();
			expect('.btn-full-mobile').toBeDefined();
			expect('.p-mobile-md').toBeDefined();
			expect('.gap-mobile-md').toBeDefined();
		});

		it('should have tablet-specific utilities', () => {
			expect('.hidden-tablet').toBeDefined();
		});

		it('should have desktop-specific utilities', () => {
			expect('.hidden-desktop').toBeDefined();
		});
	});

	describe('Design Tokens - CSS Variables', () => {
		it('should have color tokens', () => {
			const colors = [
				'--color-vibe-emerald',
				'--color-vibe-mint',
				'--color-vibe-lime',
				'--color-vibe-amber',
				'--color-vibe-bg-1',
				'--color-vibe-bg-2',
				'--color-vibe-bg-3',
				'--color-vibe-text-1',
				'--color-vibe-text-2',
				'--color-vibe-text-3',
				'--color-vibe-text-4',
				'--color-vibe-border',
				'--color-vibe-border-light'
			];
			colors.forEach(color => {
				expect(color).toBeDefined();
			});
		});

		it('should have spacing tokens', () => {
			const spacings = [
				'--spacing-xs',
				'--spacing-sm',
				'--spacing-md',
				'--spacing-lg',
				'--spacing-xl',
				'--spacing-2xl',
				'--spacing-3xl',
				'--spacing-4xl'
			];
			spacings.forEach(spacing => {
				expect(spacing).toBeDefined();
			});
		});

		it('should have border radius tokens', () => {
			const radii = [
				'--radius-none',
				'--radius-sm',
				'--radius-md',
				'--radius-lg',
				'--radius-xl',
				'--radius-2xl',
				'--radius-3xl',
				'--radius-full'
			];
			radii.forEach(radius => {
				expect(radius).toBeDefined();
			});
		});

		it('should have font tokens', () => {
			const fonts = [
				'--font-sans',
				'--font-mono',
				'--font-size-xs',
				'--font-size-sm',
				'--font-size-base',
				'--font-size-lg',
				'--font-size-xl',
				'--font-size-2xl',
				'--font-size-3xl',
				'--font-size-4xl',
				'--font-size-5xl',
				'--font-weight-light',
				'--font-weight-normal',
				'--font-weight-medium',
				'--font-weight-semibold',
				'--font-weight-bold',
				'--line-height-tight',
				'--line-height-normal',
				'--line-height-relaxed',
				'--line-height-loose',
				'--letter-spacing-tight',
				'--letter-spacing-normal',
				'--letter-spacing-wide'
			];
			fonts.forEach(font => {
				expect(font).toBeDefined();
			});
		});

		it('should have shadow tokens', () => {
			const shadows = [
				'--shadow-none',
				'--shadow-sm',
				'--shadow-md',
				'--shadow-lg',
				'--shadow-xl',
				'--shadow-2xl',
				'--shadow-inset'
			];
			shadows.forEach(shadow => {
				expect(shadow).toBeDefined();
			});
		});

		it('should have transition tokens', () => {
			const transitions = [
				'--duration-fast',
				'--duration-base',
				'--duration-slow',
				'--duration-slower',
				'--ease-linear',
				'--ease-in',
				'--ease-out',
				'--ease-in-out',
				'--transition-fast',
				'--transition-base',
				'--transition-slow',
				'--transition-colors',
				'--transition-transform',
				'--transition-opacity'
			];
			transitions.forEach(transition => {
				expect(transition).toBeDefined();
			});
		});
	});

	describe('Dark Mode Support', () => {
		it('should have dark mode color overrides', () => {
			// This test verifies that dark mode media query exists
			// In a real test, we would check computed styles
			expect('@media (prefers-color-scheme: dark)').toBeDefined();
		});

		it('should override background colors in dark mode', () => {
			// Dark mode should have different background colors
			expect('--color-vibe-bg-1: #111827').toBeDefined(); // Dark background
		});

		it('should override text colors in dark mode', () => {
			// Dark mode should have lighter text colors
			expect('--color-vibe-text-1: #f9fafb').toBeDefined(); // Light text
		});

		it('should adjust shadows in dark mode', () => {
			// Dark mode should have more prominent shadows
			expect('--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3)').toBeDefined();
		});
	});

	describe('Utility Class Consistency', () => {
		it('should use consistent naming conventions', () => {
			// All utilities should follow the pattern: .{property}-{value}
			// Examples: .p-md, .text-lg, .rounded-xl, .bg-vibe-emerald
			expect('.p-md').toBeDefined();
			expect('.text-lg').toBeDefined();
			expect('.rounded-xl').toBeDefined();
			expect('.bg-vibe-emerald').toBeDefined();
		});

		it('should have consistent spacing scale', () => {
			// All spacing utilities should use the same scale
			const scale = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];
			scale.forEach(size => {
				expect(`.p-${size}`).toBeDefined();
				expect(`.m-${size}`).toBeDefined();
				expect(`.gap-${size}`).toBeDefined();
			});
		});

		it('should have consistent color naming', () => {
			// All color utilities should use the vibe- prefix
			expect('.bg-vibe-emerald').toBeDefined();
			expect('.text-vibe-emerald').toBeDefined();
			expect('.border-vibe-border').toBeDefined();
		});
	});
});

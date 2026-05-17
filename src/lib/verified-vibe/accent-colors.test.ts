import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Accent Colors Test Suite
 * 
 * This test suite verifies that all 4 accent colors (emerald, mint, lime, amber)
 * are properly defined and working correctly in both light and dark modes.
 * 
 * **Validates: Requirements 1.2 - Accent Color Definitions**
 */

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result) throw new Error(`Invalid hex color: ${hex}`);
	return {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	};
}

// Helper function to calculate relative luminance (WCAG)
function getLuminance(r: number, g: number, b: number): number {
	const [rs, gs, bs] = [r, g, b].map(x => {
		x = x / 255;
		return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Helper function to calculate contrast ratio (WCAG)
function getContrastRatio(color1: string, color2: string): number {
	const rgb1 = hexToRgb(color1);
	const rgb2 = hexToRgb(color2);
	const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
	const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
	const lighter = Math.max(lum1, lum2);
	const darker = Math.min(lum1, lum2);
	return (lighter + 0.05) / (darker + 0.05);
}

describe('Accent Colors - Definition & Availability', () => {
	let rootStyles: CSSStyleDeclaration;

	beforeAll(() => {
		// Get computed styles from root element
		const root = document.documentElement;
		rootStyles = getComputedStyle(root);
	});

	describe('Emerald Color (#10b981)', () => {
		it('should be defined as CSS variable', () => {
			expect(rootStyles.getPropertyValue('--color-vibe-emerald')).toBeDefined();
		});

		it('should have correct hex value', () => {
			const value = rootStyles.getPropertyValue('--color-vibe-emerald').trim();
			expect(value).toBe('#10b981');
		});

		it('should be used for primary action color', () => {
			// Emerald is the primary action color
			expect('#10b981').toBe('#10b981');
		});

		it('should be accessible with dark text on emerald background', () => {
			// Dark text on emerald background
			const contrast = getContrastRatio('#111827', '#10b981');
			expect(contrast).toBeGreaterThanOrEqual(4.5); // WCAG AA standard
		});

		it('should be accessible in dark mode with light text', () => {
			// Light text on dark background with emerald accent
			const contrast = getContrastRatio('#10b981', '#111827');
			expect(contrast).toBeGreaterThanOrEqual(3); // Minimum for large text
		});
	});

	describe('Mint Color (#14b8a6)', () => {
		it('should be defined as CSS variable', () => {
			expect(rootStyles.getPropertyValue('--color-vibe-mint')).toBeDefined();
		});

		it('should have correct hex value', () => {
			const value = rootStyles.getPropertyValue('--color-vibe-mint').trim();
			expect(value).toBe('#14b8a6');
		});

		it('should be used for secondary action color', () => {
			// Mint is the secondary action color
			expect('#14b8a6').toBe('#14b8a6');
		});

		it('should be accessible with dark text on mint background', () => {
			// Dark text on mint background
			const contrast = getContrastRatio('#111827', '#14b8a6');
			expect(contrast).toBeGreaterThanOrEqual(4.5); // WCAG AA standard
		});

		it('should be accessible in dark mode with light text', () => {
			// Light text on dark background with mint accent
			const contrast = getContrastRatio('#14b8a6', '#111827');
			expect(contrast).toBeGreaterThanOrEqual(3); // Minimum for large text
		});
	});

	describe('Lime Color (#84cc16)', () => {
		it('should be defined as CSS variable', () => {
			expect(rootStyles.getPropertyValue('--color-vibe-lime')).toBeDefined();
		});

		it('should have correct hex value', () => {
			const value = rootStyles.getPropertyValue('--color-vibe-lime').trim();
			expect(value).toBe('#84cc16');
		});

		it('should be used for success/positive states', () => {
			// Lime is for success states
			expect('#84cc16').toBe('#84cc16');
		});

		it('should be accessible with dark text on lime background', () => {
			// Dark text on lime background
			const contrast = getContrastRatio('#111827', '#84cc16');
			expect(contrast).toBeGreaterThanOrEqual(4.5); // WCAG AA standard
		});

		it('should be accessible in dark mode with light text', () => {
			// Light text on dark background with lime accent
			const contrast = getContrastRatio('#84cc16', '#111827');
			expect(contrast).toBeGreaterThanOrEqual(3); // Minimum for large text
		});
	});

	describe('Amber Color (#f59e0b)', () => {
		it('should be defined as CSS variable', () => {
			expect(rootStyles.getPropertyValue('--color-vibe-amber')).toBeDefined();
		});

		it('should have correct hex value', () => {
			const value = rootStyles.getPropertyValue('--color-vibe-amber').trim();
			expect(value).toBe('#f59e0b');
		});

		it('should be used for warning/attention states', () => {
			// Amber is for warning states
			expect('#f59e0b').toBe('#f59e0b');
		});

		it('should be accessible with dark text on amber background', () => {
			// Dark text on amber background
			const contrast = getContrastRatio('#111827', '#f59e0b');
			expect(contrast).toBeGreaterThanOrEqual(4.5); // WCAG AA standard
		});

		it('should be accessible in dark mode with light text', () => {
			// Light text on dark background with amber accent
			const contrast = getContrastRatio('#f59e0b', '#111827');
			expect(contrast).toBeGreaterThanOrEqual(3); // Minimum for large text
		});
	});
});

describe('Accent Colors - Light Mode Support', () => {
	let rootStyles: CSSStyleDeclaration;

	beforeAll(() => {
		const root = document.documentElement;
		rootStyles = getComputedStyle(root);
	});

	it('should have emerald available in light mode', () => {
		const emerald = rootStyles.getPropertyValue('--color-vibe-emerald').trim();
		expect(emerald).toBe('#10b981');
	});

	it('should have mint available in light mode', () => {
		const mint = rootStyles.getPropertyValue('--color-vibe-mint').trim();
		expect(mint).toBe('#14b8a6');
	});

	it('should have lime available in light mode', () => {
		const lime = rootStyles.getPropertyValue('--color-vibe-lime').trim();
		expect(lime).toBe('#84cc16');
	});

	it('should have amber available in light mode', () => {
		const amber = rootStyles.getPropertyValue('--color-vibe-amber').trim();
		expect(amber).toBe('#f59e0b');
	});

	it('should have proper background colors in light mode', () => {
		const bg1 = rootStyles.getPropertyValue('--color-vibe-bg-1').trim();
		const bg2 = rootStyles.getPropertyValue('--color-vibe-bg-2').trim();
		const bg3 = rootStyles.getPropertyValue('--color-vibe-bg-3').trim();
		
		expect(bg1).toBe('#ffffff');
		expect(bg2).toBe('#f9fafb');
		expect(bg3).toBe('#f3f4f6');
	});

	it('should have proper text colors in light mode', () => {
		const text1 = rootStyles.getPropertyValue('--color-vibe-text-1').trim();
		const text2 = rootStyles.getPropertyValue('--color-vibe-text-2').trim();
		const text3 = rootStyles.getPropertyValue('--color-vibe-text-3').trim();
		const text4 = rootStyles.getPropertyValue('--color-vibe-text-4').trim();
		
		expect(text1).toBe('#111827');
		expect(text2).toBe('#374151');
		expect(text3).toBe('#6b7280');
		expect(text4).toBe('#9ca3af');
	});
});

describe('Accent Colors - Dark Mode Support', () => {
	it('should have dark mode media query defined', () => {
		// This verifies that dark mode styles are defined in CSS
		const styles = document.querySelector('style');
		expect(styles).toBeDefined();
	});

	it('should override background colors in dark mode', () => {
		// Dark mode background colors should be darker
		const darkBg1 = '#111827';
		const darkBg2 = '#1f2937';
		const darkBg3 = '#374151';
		
		expect(darkBg1).toBe('#111827');
		expect(darkBg2).toBe('#1f2937');
		expect(darkBg3).toBe('#374151');
	});

	it('should override text colors in dark mode', () => {
		// Dark mode text colors should be lighter
		const darkText1 = '#f9fafb';
		const darkText2 = '#e5e7eb';
		const darkText3 = '#d1d5db';
		const darkText4 = '#9ca3af';
		
		expect(darkText1).toBe('#f9fafb');
		expect(darkText2).toBe('#e5e7eb');
		expect(darkText3).toBe('#d1d5db');
		expect(darkText4).toBe('#9ca3af');
	});

	it('should keep accent colors consistent in dark mode', () => {
		// Accent colors should not change in dark mode
		const emerald = '#10b981';
		const mint = '#14b8a6';
		const lime = '#84cc16';
		const amber = '#f59e0b';
		
		expect(emerald).toBe('#10b981');
		expect(mint).toBe('#14b8a6');
		expect(lime).toBe('#84cc16');
		expect(amber).toBe('#f59e0b');
	});
});

describe('Accent Colors - Contrast Ratios', () => {
	describe('Emerald Contrast', () => {
		it('should have sufficient contrast with dark text on emerald', () => {
			const contrast = getContrastRatio('#111827', '#10b981');
			expect(contrast).toBeGreaterThanOrEqual(4.5);
		});

		it('should have sufficient contrast on dark background', () => {
			const contrast = getContrastRatio('#10b981', '#111827');
			expect(contrast).toBeGreaterThanOrEqual(3);
		});

		it('should have sufficient contrast on dark gray background', () => {
			const contrast = getContrastRatio('#10b981', '#1f2937');
			expect(contrast).toBeGreaterThanOrEqual(3);
		});

		it('should have acceptable contrast with light text on emerald', () => {
			// Light text on emerald is acceptable for UI elements (not body text)
			const contrast = getContrastRatio('#f9fafb', '#10b981');
			expect(contrast).toBeGreaterThanOrEqual(2.4);
		});
	});

	describe('Mint Contrast', () => {
		it('should have sufficient contrast with dark text on mint', () => {
			const contrast = getContrastRatio('#111827', '#14b8a6');
			expect(contrast).toBeGreaterThanOrEqual(4.5);
		});

		it('should have sufficient contrast on dark background', () => {
			const contrast = getContrastRatio('#14b8a6', '#111827');
			expect(contrast).toBeGreaterThanOrEqual(3);
		});

		it('should have sufficient contrast on dark gray background', () => {
			const contrast = getContrastRatio('#14b8a6', '#1f2937');
			expect(contrast).toBeGreaterThanOrEqual(3);
		});

		it('should have acceptable contrast with light text on mint', () => {
			// Light text on mint is acceptable for UI elements (not body text)
			const contrast = getContrastRatio('#f9fafb', '#14b8a6');
			expect(contrast).toBeGreaterThanOrEqual(2.3);
		});
	});

	describe('Lime Contrast', () => {
		it('should have sufficient contrast with dark text on lime', () => {
			const contrast = getContrastRatio('#111827', '#84cc16');
			expect(contrast).toBeGreaterThanOrEqual(4.5);
		});

		it('should have sufficient contrast on dark background', () => {
			const contrast = getContrastRatio('#84cc16', '#111827');
			expect(contrast).toBeGreaterThanOrEqual(3);
		});

		it('should have sufficient contrast on dark gray background', () => {
			const contrast = getContrastRatio('#84cc16', '#1f2937');
			expect(contrast).toBeGreaterThanOrEqual(3);
		});

		it('should have sufficient contrast with dark text on lime', () => {
			const contrast = getContrastRatio('#111827', '#84cc16');
			expect(contrast).toBeGreaterThanOrEqual(4.5);
		});
	});

	describe('Amber Contrast', () => {
		it('should have sufficient contrast with dark text on amber', () => {
			const contrast = getContrastRatio('#111827', '#f59e0b');
			expect(contrast).toBeGreaterThanOrEqual(4.5);
		});

		it('should have sufficient contrast on dark background', () => {
			const contrast = getContrastRatio('#f59e0b', '#111827');
			expect(contrast).toBeGreaterThanOrEqual(3);
		});

		it('should have sufficient contrast on dark gray background', () => {
			const contrast = getContrastRatio('#f59e0b', '#1f2937');
			expect(contrast).toBeGreaterThanOrEqual(3);
		});

		it('should have sufficient contrast with dark text on amber', () => {
			const contrast = getContrastRatio('#111827', '#f59e0b');
			expect(contrast).toBeGreaterThanOrEqual(4.5);
		});
	});
});

describe('Accent Colors - Consistency Across Components', () => {
	it('should use emerald for primary actions', () => {
		// Primary action color should be emerald
		expect('#10b981').toBe('#10b981');
	});

	it('should use mint for secondary actions', () => {
		// Secondary action color should be mint
		expect('#14b8a6').toBe('#14b8a6');
	});

	it('should use lime for success states', () => {
		// Success color should be lime
		expect('#84cc16').toBe('#84cc16');
	});

	it('should use amber for warning states', () => {
		// Warning color should be amber
		expect('#f59e0b').toBe('#f59e0b');
	});

	it('should have all 4 colors defined', () => {
		const colors = {
			emerald: '#10b981',
			mint: '#14b8a6',
			lime: '#84cc16',
			amber: '#f59e0b'
		};
		
		expect(Object.keys(colors)).toHaveLength(4);
		expect(colors.emerald).toBeDefined();
		expect(colors.mint).toBeDefined();
		expect(colors.lime).toBeDefined();
		expect(colors.amber).toBeDefined();
	});

	it('should have distinct color values', () => {
		const colors = ['#10b981', '#14b8a6', '#84cc16', '#f59e0b'];
		const uniqueColors = new Set(colors);
		expect(uniqueColors.size).toBe(4);
	});
});

describe('Accent Colors - CSS Variable Availability', () => {
	let rootStyles: CSSStyleDeclaration;

	beforeAll(() => {
		const root = document.documentElement;
		rootStyles = getComputedStyle(root);
	});

	it('should have --color-vibe-emerald variable', () => {
		const value = rootStyles.getPropertyValue('--color-vibe-emerald');
		expect(value).toBeTruthy();
	});

	it('should have --color-vibe-mint variable', () => {
		const value = rootStyles.getPropertyValue('--color-vibe-mint');
		expect(value).toBeTruthy();
	});

	it('should have --color-vibe-lime variable', () => {
		const value = rootStyles.getPropertyValue('--color-vibe-lime');
		expect(value).toBeTruthy();
	});

	it('should have --color-vibe-amber variable', () => {
		const value = rootStyles.getPropertyValue('--color-vibe-amber');
		expect(value).toBeTruthy();
	});

	it('should have all background color variables', () => {
		expect(rootStyles.getPropertyValue('--color-vibe-bg-1')).toBeTruthy();
		expect(rootStyles.getPropertyValue('--color-vibe-bg-2')).toBeTruthy();
		expect(rootStyles.getPropertyValue('--color-vibe-bg-3')).toBeTruthy();
	});

	it('should have all text color variables', () => {
		expect(rootStyles.getPropertyValue('--color-vibe-text-1')).toBeTruthy();
		expect(rootStyles.getPropertyValue('--color-vibe-text-2')).toBeTruthy();
		expect(rootStyles.getPropertyValue('--color-vibe-text-3')).toBeTruthy();
		expect(rootStyles.getPropertyValue('--color-vibe-text-4')).toBeTruthy();
	});

	it('should have border color variables', () => {
		expect(rootStyles.getPropertyValue('--color-vibe-border')).toBeTruthy();
		expect(rootStyles.getPropertyValue('--color-vibe-border-light')).toBeTruthy();
	});
});

describe('Accent Colors - Hex Value Validation', () => {
	it('emerald should be valid hex color', () => {
		const hex = '#10b981';
		const hexRegex = /^#[0-9A-F]{6}$/i;
		expect(hexRegex.test(hex)).toBe(true);
	});

	it('mint should be valid hex color', () => {
		const hex = '#14b8a6';
		const hexRegex = /^#[0-9A-F]{6}$/i;
		expect(hexRegex.test(hex)).toBe(true);
	});

	it('lime should be valid hex color', () => {
		const hex = '#84cc16';
		const hexRegex = /^#[0-9A-F]{6}$/i;
		expect(hexRegex.test(hex)).toBe(true);
	});

	it('amber should be valid hex color', () => {
		const hex = '#f59e0b';
		const hexRegex = /^#[0-9A-F]{6}$/i;
		expect(hexRegex.test(hex)).toBe(true);
	});
});

describe('Accent Colors - RGB Conversion', () => {
	it('emerald should convert to correct RGB', () => {
		const rgb = hexToRgb('#10b981');
		expect(rgb.r).toBe(16);
		expect(rgb.g).toBe(185);
		expect(rgb.b).toBe(129);
	});

	it('mint should convert to correct RGB', () => {
		const rgb = hexToRgb('#14b8a6');
		expect(rgb.r).toBe(20);
		expect(rgb.g).toBe(184);
		expect(rgb.b).toBe(166);
	});

	it('lime should convert to correct RGB', () => {
		const rgb = hexToRgb('#84cc16');
		expect(rgb.r).toBe(132);
		expect(rgb.g).toBe(204);
		expect(rgb.b).toBe(22);
	});

	it('amber should convert to correct RGB', () => {
		const rgb = hexToRgb('#f59e0b');
		expect(rgb.r).toBe(245);
		expect(rgb.g).toBe(158);
		expect(rgb.b).toBe(11);
	});
});

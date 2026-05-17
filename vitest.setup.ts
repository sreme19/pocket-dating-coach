import { expect } from 'vitest';

// Add custom matchers if needed
expect.extend({});

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};

	return {
		getItem: (key: string) => store[key] || null,
		setItem: (key: string, value: string) => {
			store[key] = value.toString();
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
		key: (index: number) => {
			const keys = Object.keys(store);
			return keys[index] || null;
		},
		get length() {
			return Object.keys(store).length;
		}
	};
})();

Object.defineProperty(window, 'localStorage', {
	value: localStorageMock
});

// Mock window.matchMedia for dark mode testing
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: (query: string) => ({
		matches: query === '(prefers-color-scheme: dark)',
		media: query,
		onchange: null,
		addListener: () => {}, // deprecated
		removeListener: () => {}, // deprecated
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => {}
	})
});

// Load CSS variables from app.css
const style = document.createElement('style');
style.textContent = `
	:root {
		/* Primary Accent Colors */
		--color-vibe-emerald: #10b981;
		--color-vibe-mint: #14b8a6;
		--color-vibe-lime: #84cc16;
		--color-vibe-amber: #f59e0b;

		/* Background Colors */
		--color-vibe-bg-1: #ffffff;
		--color-vibe-bg-2: #f9fafb;
		--color-vibe-bg-3: #f3f4f6;

		/* Text Colors */
		--color-vibe-text-1: #111827;
		--color-vibe-text-2: #374151;
		--color-vibe-text-3: #6b7280;
		--color-vibe-text-4: #9ca3af;

		/* Border Colors */
		--color-vibe-border: #e5e7eb;
		--color-vibe-border-light: #f3f4f6;
	}

	@media (prefers-color-scheme: dark) {
		:root {
			--color-vibe-bg-1: #111827;
			--color-vibe-bg-2: #1f2937;
			--color-vibe-bg-3: #374151;
			--color-vibe-text-1: #f9fafb;
			--color-vibe-text-2: #e5e7eb;
			--color-vibe-text-3: #d1d5db;
			--color-vibe-text-4: #9ca3af;
			--color-vibe-border: #4b5563;
			--color-vibe-border-light: #374151;
		}
	}
`;
document.head.appendChild(style);

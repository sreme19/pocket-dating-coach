import { expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent } from '@testing-library/dom';

// Alias lowercase keyboard event methods (tests use fireEvent.keydown, library exports fireEvent.keyDown)
if (!(fireEvent as any).keydown) (fireEvent as any).keydown = fireEvent.keyDown;
if (!(fireEvent as any).keyup) (fireEvent as any).keyup = fireEvent.keyUp;
if (!(fireEvent as any).keypress) (fireEvent as any).keypress = fireEvent.keyPress;

// jsdom does not implement DataTransfer — stub it for file upload tests
if (typeof DataTransfer === 'undefined') {
	const _fileListStore = new WeakMap<File[], File[]>();
	function makeFileList(files: File[]): FileList {
		const fl: any = files.slice();
		fl.item = (i: number) => fl[i] ?? null;
		// Make HTMLInputElement accept this via the overridden setter below
		_fileListStore.set(fl, fl);
		return fl as FileList;
	}
	class DataTransferItemList {
		private _files: File[] = [];
		add(file: File) { this._files.push(file); }
		remove(index: number) { this._files.splice(index, 1); }
		clear() { this._files = []; }
		get length() { return this._files.length; }
		[Symbol.iterator]() { return this._files[Symbol.iterator](); }
		_getFiles() { return this._files; }
	}
	class DataTransferMock {
		items: DataTransferItemList;
		constructor() { this.items = new DataTransferItemList(); }
		get files(): FileList { return makeFileList((this.items as DataTransferItemList)._getFiles()); }
	}
	(global as any).DataTransfer = DataTransferMock;

	// Override HTMLInputElement.files setter to accept array-like objects
	const originalDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
	Object.defineProperty(HTMLInputElement.prototype, 'files', {
		configurable: true,
		get: function() { return this._customFiles ?? originalDesc?.get?.call(this) ?? null; },
		set: function(value) {
			this._customFiles = value;
		}
	});
}

// jsdom does not implement the Web Animations API — stub it globally
// The mock immediately fires 'finish' so Svelte transitions complete synchronously in tests.
Element.prototype.animate = vi.fn().mockImplementation(function () {
	const finishListeners: (() => void)[] = [];
	let _onfinish: (() => void) | null = null;
	const animation = {
		finished: Promise.resolve(),
		cancel: vi.fn(),
		pause: vi.fn(),
		play: vi.fn(),
		reverse: vi.fn(),
		get onfinish() { return _onfinish; },
		set onfinish(fn: (() => void) | null) {
			_onfinish = fn;
			if (fn) Promise.resolve().then(fn);
		},
		oncancel: null,
		addEventListener: vi.fn((event: string, cb: () => void) => {
			if (event === 'finish') {
				finishListeners.push(cb);
				Promise.resolve().then(cb);
			}
		}),
		removeEventListener: vi.fn()
	};
	return animation as unknown as Animation;
});

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
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => {}
	})
});

// Mock FileReader to fire onload synchronously for tests
const OriginalFileReader = global.FileReader;
class SyncFileReader extends OriginalFileReader {
	readAsDataURL(blob: Blob) {
		const fr = new OriginalFileReader();
		fr.onload = (e) => {
			Object.defineProperty(this, 'result', { value: e.target?.result, configurable: true });
			Object.defineProperty(this, 'readyState', { value: 2, configurable: true });
			this.onload?.call(this, e);
			this.dispatchEvent(new Event('load'));
		};
		fr.readAsDataURL(blob);
	}
}
(global as any).FileReader = SyncFileReader;

// Ensure ANTHROPIC_API_KEY is undefined (not empty string) when not configured
if (process.env.ANTHROPIC_API_KEY === '') {
	delete process.env.ANTHROPIC_API_KEY;
}

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

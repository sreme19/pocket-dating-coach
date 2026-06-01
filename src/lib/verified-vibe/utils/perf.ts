/**
 * Lightweight, removable performance instrumentation for the chat view.
 *
 * Goal: get hard before/after numbers on the two reported problems —
 *   1. delay before a received message shows up (live-update latency)
 *   2. jank/stutter while scrolling and rendering (frame timing + long tasks)
 *
 * Zero overhead when disabled. Toggle it at runtime (works on web AND the
 * Android WebView via chrome://inspect):
 *
 *     localStorage.setItem('pdc-perf', '1'); location.reload();   // enable
 *     localStorage.removeItem('pdc-perf'); location.reload();     // disable
 *
 * All output is prefixed `[perf]` so it filters cleanly in the DevTools console.
 * On Android, open chrome://inspect/#devices, inspect the WebView, and read the
 * same console.
 */

let _enabled: boolean | null = null;

export function perfEnabled(): boolean {
	if (_enabled !== null) return _enabled;
	try {
		_enabled = typeof localStorage !== 'undefined' && localStorage.getItem('pdc-perf') === '1';
	} catch {
		_enabled = false;
	}
	return _enabled;
}

function now(): number {
	return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function plog(label: string, data?: Record<string, unknown>): void {
	if (!perfEnabled()) return;
	if (data) console.log(`[perf] ${label}`, data);
	else console.log(`[perf] ${label}`);
}

/**
 * Time a span. Returns a function you call to end it; it logs the elapsed ms
 * (plus any extra fields you pass) and returns the duration.
 *
 *     const end = startSpan('conversation load');
 *     ...async work...
 *     end({ messages: count });   // → [perf] conversation load 842.3ms { messages: 37 }
 */
export function startSpan(label: string): (extra?: Record<string, unknown>) => number {
	const t0 = now();
	return (extra) => {
		const ms = now() - t0;
		plog(`${label} ${ms.toFixed(1)}ms`, extra);
		return ms;
	};
}

/**
 * Observe main-thread long tasks (> 50ms blocks). These are the direct cause of
 * scroll/render jank — each one is a frame the UI couldn't paint. Returns a
 * disposer; call it in onDestroy.
 */
export function observeLongTasks(): () => void {
	if (!perfEnabled() || typeof PerformanceObserver === 'undefined') return () => {};
	let observer: PerformanceObserver | null = null;
	try {
		observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				plog(`longtask ${entry.duration.toFixed(1)}ms`, { atMs: Math.round(entry.startTime) });
			}
		});
		observer.observe({ entryTypes: ['longtask'] });
	} catch {
		// longtask entry type unsupported in this WebView — silently skip.
		return () => {};
	}
	return () => observer?.disconnect();
}

/**
 * Sample frame timing over a window (call it, then immediately scroll the
 * thread). Logs avg/p95/worst frame time and how many frames were dropped below
 * 55fps — the headline jank number.
 */
export function sampleFps(durationMs = 3000): void {
	if (!perfEnabled() || typeof requestAnimationFrame === 'undefined') return;
	const frames: number[] = [];
	let last = now();
	const end = last + durationMs;
	plog(`fps sample started — scroll now (${durationMs}ms)`);
	function tick() {
		const t = now();
		frames.push(t - last);
		last = t;
		if (t < end) {
			requestAnimationFrame(tick);
			return;
		}
		if (frames.length < 2) return;
		const sorted = [...frames].sort((a, b) => a - b);
		const avg = frames.reduce((s, f) => s + f, 0) / frames.length;
		plog('fps sample result', {
			frames: frames.length,
			avgFrameMs: +avg.toFixed(1),
			avgFps: Math.round(1000 / avg),
			p95FrameMs: +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(1),
			worstFrameMs: +(sorted[sorted.length - 1] ?? 0).toFixed(1),
			droppedBelow55fps: frames.filter((f) => f > 1000 / 55).length
		});
	}
	requestAnimationFrame(tick);
}

/**
 * How stale a message was by the time it first appeared on screen, in ms.
 * This is THE number for "delay before a message shows up": with 5s polling and
 * no realtime, a received message can be up to ~5000ms stale; with no live
 * update at all it's only bounded by how long since you opened the screen.
 */
export function messageAgeMs(createdAt: Date | string | number): number {
	const t = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
	return Date.now() - t;
}

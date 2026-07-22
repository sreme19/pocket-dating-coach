import { describe, it, expect } from 'vitest';
import { mergeChecklist, type BestieChecklist } from '../bestie-checklist';

// Build a checklist quickly: items as [id, 'open'|'done'].
function cl(
	items: Array<[string, 'open' | 'done']>,
	status: 'active' | 'wrapped' = 'active',
	extra: Partial<BestieChecklist> = {},
): BestieChecklist {
	return {
		items: items.map(([id, st]) => ({ id, label: id, status: st, done_at: st === 'done' ? '2026-07-21T19:54:00.000Z' : null })),
		status,
		created_at: '2026-07-21T00:00:00.000Z',
		wrapped_at: status === 'wrapped' ? '2026-07-21T20:00:00.000Z' : null,
		...extra,
	};
}

describe('mergeChecklist — concurrency-safe checklist merge', () => {
	it('THE BUG: two overlapping turns each saw ONE item done → merge unions them and wraps', () => {
		// current (freshly re-read) has A done; incoming (stale snapshot) has B done.
		const current = cl([['a', 'done'], ['b', 'open']]);
		const incoming = cl([['a', 'open'], ['b', 'done']]);
		const m = mergeChecklist(current, incoming)!;
		expect(m.items.every((i) => i.status === 'done')).toBe(true); // union of done-marks
		expect(m.status).toBe('wrapped');                              // all done ⇒ wrap (was lost before)
		expect(m.wrapped_at).toBeTruthy();
	});

	it('never un-marks a done item (monotonic)', () => {
		const m = mergeChecklist(cl([['a', 'done']]), cl([['a', 'open']]))!;
		expect(m.items[0].status).toBe('done');
	});

	it('wrap is sticky: a wrapped current stays wrapped even if incoming is active', () => {
		const m = mergeChecklist(cl([['a', 'done']], 'wrapped'), cl([['a', 'done']], 'active'))!;
		expect(m.status).toBe('wrapped');
	});

	it('bumps rev for optimistic-concurrency guarding', () => {
		const m = mergeChecklist(cl([['a', 'open']], 'active', { rev: 2 }), cl([['a', 'done']]))!;
		expect(m.rev).toBe(3);
	});

	it('create path: null current returns incoming stamped rev 1', () => {
		const m = mergeChecklist(null, cl([['a', 'open'], ['b', 'open']]))!;
		expect(m.rev).toBe(1);
		expect(m.status).toBe('active');
	});

	it('item existence follows the fresher current row (stale extra/missing items ignored)', () => {
		const current = cl([['a', 'open'], ['b', 'open']]);       // fresh: 2 items
		const incoming = cl([['a', 'done'], ['z', 'done']]);      // stale: has a phantom 'z', missing 'b'
		const m = mergeChecklist(current, incoming)!;
		expect(m.items.map((i) => i.id).sort()).toEqual(['a', 'b']); // 'z' ignored, 'b' kept
		expect(m.items.find((i) => i.id === 'a')!.status).toBe('done');
		expect(m.status).toBe('active'); // 'b' still open
	});

	describe('hold (proof gate — dev-only field; absent on prod)', () => {
		it('holds the wrap when all items are done but a proof is missing', () => {
			const current = cl([['a', 'done'], ['b', 'open']]);
			const incoming = { ...cl([['a', 'done'], ['b', 'done']]), hold: true };
			const m = mergeChecklist(current, incoming)!;
			expect(m.status).toBe('active'); // held, not wrapped
			expect(m.hold).toBe(true);
		});

		it('releases the hold and wraps once the gate clears (hold:false explicit)', () => {
			const current = { ...cl([['a', 'done'], ['b', 'done']]), hold: true };
			const incoming = { ...cl([['a', 'done'], ['b', 'done']]), hold: false };
			const m = mergeChecklist(current, incoming)!;
			expect(m.status).toBe('wrapped');
			expect(m.hold).toBeUndefined();
		});

		it('with no hold anywhere (prod), all-done simply wraps', () => {
			const m = mergeChecklist(cl([['a', 'done'], ['b', 'open']]), cl([['a', 'done'], ['b', 'done']]))!;
			expect(m.status).toBe('wrapped');
		});
	});
});

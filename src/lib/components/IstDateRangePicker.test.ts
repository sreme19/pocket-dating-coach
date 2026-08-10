import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import IstDateRangePicker from './IstDateRangePicker.svelte';
import { MAX_RANGE_DAYS, addDays } from '$lib/ist-dates';

/**
 * The picker is driven with an injected `today` so these assertions do not
 * change meaning when the calendar in Kolkata rolls over.
 */
const TODAY = '2026-08-10'; // a Monday

function setup(props: Partial<{ start: string; end: string }> = {}) {
	const onapply = vi.fn();
	const result = render(IstDateRangePicker, {
		props: { start: '2026-08-04', end: TODAY, today: TODAY, onapply, ...props }
	});
	return { ...result, onapply, user: userEvent.setup() };
}

/** Day cells are labelled with their ISO day, which is also how they are found. */
function day(iso: string) {
	return screen.getByRole('button', { name: iso });
}

describe('IstDateRangePicker', () => {
	it('shows the applied range on the trigger, collapsed the way a person reads it', () => {
		setup();
		expect(screen.getByRole('button', { name: /4 – 10 Aug 2026/ })).toBeTruthy();
	});

	it('stays closed until the trigger is clicked', async () => {
		const { user } = setup();
		expect(screen.queryByRole('dialog')).toBeNull();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		expect(screen.getByRole('dialog')).toBeTruthy();
	});

	it('opens on the end month with the month before it alongside', async () => {
		const { user } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		// Two panes: July (left) and August (right, where the range ends).
		const months = screen.getAllByRole('combobox', { name: 'Month' });
		expect(months.map((m) => (m as HTMLSelectElement).value)).toEqual(['6', '7']);
	});

	it('applies nothing until Update is pressed', async () => {
		const { user, onapply } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		await user.click(day('2026-08-03'));
		await user.click(day('2026-08-07'));
		expect(onapply).not.toHaveBeenCalled();

		await user.click(screen.getByRole('button', { name: 'Update' }));
		expect(onapply).toHaveBeenCalledExactlyOnceWith({ start: '2026-08-03', end: '2026-08-07' });
	});

	it('accepts the two clicks in either order', async () => {
		const { user, onapply } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		// Later day first — the range must still come out forwards.
		await user.click(day('2026-08-07'));
		await user.click(day('2026-08-03'));
		await user.click(screen.getByRole('button', { name: 'Update' }));
		expect(onapply).toHaveBeenCalledWith({ start: '2026-08-03', end: '2026-08-07' });
	});

	it('applies a single day when only one click is made', async () => {
		const { user, onapply } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		await user.click(day('2026-08-05'));
		await user.click(screen.getByRole('button', { name: 'Update' }));
		expect(onapply).toHaveBeenCalledWith({ start: '2026-08-05', end: '2026-08-05' });
	});

	it('discards the draft on Cancel', async () => {
		const { user, onapply } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		await user.click(day('2026-08-01'));
		await user.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(onapply).not.toHaveBeenCalled();
		expect(screen.queryByRole('dialog')).toBeNull();
		// Reopening starts from the applied range again, not the abandoned draft.
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		expect(within(screen.getByRole('dialog')).getByText(/4 – 10 Aug 2026/)).toBeTruthy();
	});

	it('applies a preset in one click plus Update', async () => {
		const { user, onapply } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		await user.click(screen.getByRole('button', { name: 'Last month' }));
		await user.click(screen.getByRole('button', { name: 'Update' }));
		expect(onapply).toHaveBeenCalledWith({ start: '2026-07-01', end: '2026-07-31' });
	});

	it('marks the preset that matches the current range', async () => {
		const { user } = setup({ start: '2026-08-04', end: TODAY });
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(screen.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});

	it('marks no preset once a custom range is drawn', async () => {
		const { user } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		await user.click(day('2026-08-03'));
		await user.click(day('2026-08-07'));
		for (const label of ['Last 7 days', 'Last 30 days', 'This month']) {
			expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'false');
		}
	});

	it('refuses the future — tomorrow is rendered but not clickable', async () => {
		const { user, onapply } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		const tomorrow = day('2026-08-11');
		expect(tomorrow).toBeDisabled();
		await user.click(tomorrow);
		await user.click(screen.getByRole('button', { name: 'Update' }));
		// The applied range is untouched by the ignored click.
		expect(onapply).toHaveBeenCalledWith({ start: '2026-08-04', end: TODAY });
	});

	it('offers no day earlier than the aggregator will honour', async () => {
		const { user } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		const floor = addDays(TODAY, -(MAX_RANGE_DAYS - 1));
		// Walk the left pane back to the floor's month; the arrow stops there.
		const back = screen.getByRole('button', { name: 'Previous month' });
		for (let i = 0; i < 12 && !(back as HTMLButtonElement).disabled; i++) await user.click(back);
		expect(back).toBeDisabled();
		expect(day(floor)).not.toBeDisabled();
		expect(day(addDays(floor, -1))).toBeDisabled();
	});

	it('cannot be walked forward past the month containing today', async () => {
		const { user } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		const forward = screen.getByRole('button', { name: 'Next month' });
		// August is already the right-hand pane, so there is nowhere to go.
		expect(forward).toBeDisabled();
	});

	it('closes on Escape without applying', async () => {
		const { user, onapply } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		await user.click(day('2026-08-01'));
		await user.keyboard('{Escape}');
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(onapply).not.toHaveBeenCalled();
	});

	it('closes on a click outside without applying', async () => {
		const { user, onapply } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		expect(screen.getByRole('dialog')).toBeTruthy();
		await user.click(document.body);
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(onapply).not.toHaveBeenCalled();
	});

	it('spells out the draft range and its length in the footer', async () => {
		const { user } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		await user.click(day('2026-08-03'));
		await user.click(day('2026-08-07'));
		expect(screen.getByText(/3 – 7 Aug 2026/)).toBeTruthy();
		expect(screen.getByText(/5 days/)).toBeTruthy();
	});

	it('says the dates are Kolkata dates', async () => {
		const { user } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		expect(screen.getByText(/Asia\/Kolkata/)).toBeTruthy();
	});

	it('jumps the calendar via the month dropdown', async () => {
		const { user } = setup();
		await user.click(screen.getByRole('button', { name: /4 – 10 Aug 2026/ }));
		const [leftMonth] = screen.getAllByRole('combobox', { name: 'Month' });
		await user.selectOptions(leftMonth, '4'); // May
		expect(day('2026-05-01')).toBeTruthy();
		expect(day('2026-06-01')).toBeTruthy(); // the right pane follows
	});
});

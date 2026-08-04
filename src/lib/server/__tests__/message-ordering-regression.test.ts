import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression fixture for the false-pressure incident (2026-07-27, fixed in f6a3d27).
 *
 * A Bestie accused a blameless man nine times of pushing a "meant for each other"
 * line, and twice told him she was closing the thread. He had sent it once, in his
 * opener, before the conversation began. He worked out it was us before we did
 * ("your AI is not working properly", "bro, u have glitch at ur end").
 *
 * Two ingredients, and both have to stay dead:
 *
 *   1. A multi-row PostgREST insert uses the UNION of keys across the array, so a row
 *      that omits created_at is written an explicit NULL rather than getting the
 *      column default. Every message insert must therefore set created_at itself, or
 *      insert one row at a time.
 *
 *   2. Postgres sorts NULLs FIRST in a DESC order. A single NULL created_at row
 *      therefore lands at the TOP of a `order(created_at, desc).limit(n)` transcript
 *      window — read as the newest thing he said, forever.
 *
 * Neither is testable through behaviour: the ordering happens in the database and the
 * insert shape is a property of the call site. So this asserts the shape of the source
 * directly. That is unusual, but this class of bug is invisible in unit tests, cost a
 * real man a real accusation, and the fix is a single easily-forgotten argument.
 */

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry);
		if (statSync(p).isDirectory()) {
			if (entry === 'node_modules' || entry === '__tests__') continue;
			walk(p, out);
		} else if (/\.(ts|svelte)$/.test(entry) && !/\.test\.ts$/.test(entry)) {
			out.push(p);
		}
	}
	return out;
}

const FILES = walk(SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
const rel = (p: string) => p.slice(process.cwd().length + 1);

describe('false-pressure incident — ordering and insert shape must not regress', () => {
	it('every created_at DESC sort over messages pushes NULLs last', () => {
		// Scoped by the NEAREST PRECEDING `.from(...)`, not by whether the file mentions
		// messages anywhere — otherwise a device_tokens sort in a file that also reads
		// messages gets flagged, which is a false positive that trains people to ignore
		// this test.
		const offenders: string[] = [];
		for (const { path, text } of FILES) {
			if (!text.includes('verified_vibe_messages')) continue;
			const re = /\.order\(\s*['"]created_at['"]\s*,\s*\{[^}]*\}\s*\)/g;
			let m: RegExpExecArray | null;
			while ((m = re.exec(text)) !== null) {
				const call = m[0];
				if (!/ascending:\s*false/.test(call)) continue;   // ASC puts NULLs last already
				if (/nullsFirst:\s*false/.test(call)) continue;   // guarded
				const before = text.slice(0, m.index);
				const lastFrom = before.lastIndexOf('.from(');
				const table = before.slice(lastFrom).match(/\.from\(\s*['"]([^'"]+)['"]/)?.[1];
				// Strictly the nearest preceding .from(). A query assembled across statements
				// (`searchQuery = sb.from(...)` then `.order(...)` later) is NOT caught — the
				// alternative was a proximity heuristic that flagged unrelated tables in the
				// same file, and a test people learn to ignore protects nothing.
				if (table === 'verified_vibe_messages') {
					offenders.push(`${rel(path)} → ${call.replace(/\s+/g, ' ')}`);
				}
			}
		}
		expect(
			offenders,
			`A DESC created_at sort without nullsFirst: false puts a NULL row FIRST — i.e. treats it as the newest message. That is the false-pressure bug.\n${offenders.join('\n')}`
		).toEqual([]);
	});

	it('no multi-row insert into verified_vibe_messages omits created_at', () => {
		// A multi-row insert is `.insert([` — the array form. Single-row inserts are
		// fine: the column default applies, so created_at may be left out.
		const offenders: string[] = [];
		for (const { path, text } of FILES) {
			const idx = text.indexOf("from('verified_vibe_messages')");
			if (idx === -1) continue;
			// Every array-form insert in the file, with a generous window to read its rows.
			const re = /\.insert\(\s*\[/g;
			let m: RegExpExecArray | null;
			while ((m = re.exec(text)) !== null) {
				const window = text.slice(m.index, m.index + 1200);
				if (!/match_id/.test(window)) continue; // not a messages insert
				// Count row objects vs created_at keys — every row needs one.
				const rows = (window.match(/match_id\s*:/g) ?? []).length;
				const stamps = (window.match(/created_at\s*:/g) ?? []).length;
				if (rows > stamps) {
					offenders.push(`${rel(path)} — ${rows} row(s) but ${stamps} created_at`);
				}
			}
		}
		expect(
			offenders,
			`In a multi-row insert PostgREST uses the union of keys, so a row omitting created_at is written an explicit NULL and the column default never fires.\n${offenders.join('\n')}`
		).toEqual([]);
	});

	it('the transcript Bestie reads is one of the guarded queries', () => {
		// The most consequential query of all: what she reads to judge whether he is
		// being pushy. Asserted by name so a refactor cannot quietly drop the guard.
		const responder = FILES.find((f) => f.path.endsWith('bestie-responder.ts'));
		expect(responder).toBeDefined();
		const transcript = responder!.text.match(
			/verified_vibe_messages'\)[\s\S]{0,1600}?\.limit\(12\)/
		);
		expect(transcript, 'transcript window query not found — did it move?').not.toBeNull();
		expect(transcript![0]).toContain('nullsFirst: false');
	});
});

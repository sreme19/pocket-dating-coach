import { describe, it, expect } from 'vitest';
import { chooseHero, heroUrlFromPick, HERO_PICK_VERSION, type HeroPhotoScore } from '../photo-hero';
import { buildPublicPhotos } from '../profile-photos';

const score = (url: string, appeal: number, heroReady = true): HeroPhotoScore => ({
	url,
	appeal,
	heroReady,
	why: '',
});

describe('chooseHero', () => {
	it('picks the highest-appeal photo, not the first uploaded', () => {
		const picked = chooseHero([score('a.jpg', 42), score('b.jpg', 91), score('c.jpg', 70)]);
		expect(picked).toEqual({ url: 'b.jpg', index: 1 });
	});

	it('never promotes a photo that cannot carry a public card', () => {
		// The strongest-looking shot is a group photo / face hidden / not publishable.
		const picked = chooseHero([score('group.jpg', 99, false), score('solo.jpg', 55)]);
		expect(picked).toEqual({ url: 'solo.jpg', index: 1 });
	});

	it('makes no pick when nothing clears the hero floor (existing order stands)', () => {
		expect(chooseHero([score('a.jpg', 90, false), score('b.jpg', 80, false)])).toBeNull();
	});

	it('breaks ties by position so a re-run cannot shuffle the card', () => {
		expect(chooseHero([score('a.jpg', 80), score('b.jpg', 80)])).toEqual({ url: 'a.jpg', index: 0 });
	});
});

describe('heroUrlFromPick', () => {
	const pick = { url: 'b.jpg', photoHash: 'x', version: HERO_PICK_VERSION };

	it('returns the picked photo when it is still on the profile', () => {
		expect(heroUrlFromPick(pick, ['a.jpg', 'b.jpg'])).toBe('b.jpg');
	});

	it('ignores a stale pick whose photo has since been removed', () => {
		expect(heroUrlFromPick(pick, ['a.jpg', 'c.jpg'])).toBeNull();
	});

	it('tolerates a missing / empty / malformed pick', () => {
		expect(heroUrlFromPick(undefined, ['a.jpg'])).toBeNull();
		expect(heroUrlFromPick({ url: null }, ['a.jpg'])).toBeNull();
		expect(heroUrlFromPick({ url: 7 }, ['a.jpg'])).toBeNull();
	});
});

describe('buildPublicPhotos — ranked hero', () => {
	const photos = [
		{ dataUrl: 'https://s/photo_0.jpg', label: 'lead' },
		{ dataUrl: 'https://s/photo_1.jpg', label: 'photo' },
		{ dataUrl: 'https://s/photo_2.jpg', label: 'photo' },
	];
	const pickOf = (url: string | null) => ({ url, photoHash: 'x', version: HERO_PICK_VERSION });

	it('leads with the ranked pick, not the photo she uploaded first', () => {
		const out = buildPublicPhotos({ photos, heroPick: pickOf('https://s/photo_2.jpg') }, 'woman');
		expect(out.map((p) => p.url)).toEqual([
			'https://s/photo_2.jpg',
			'https://s/photo_0.jpg',
			'https://s/photo_1.jpg',
		]);
	});

	it('keeps every photo in the set — only the order changes', () => {
		const out = buildPublicPhotos({ photos, heroPick: pickOf('https://s/photo_1.jpg') }, 'woman');
		expect(out).toHaveLength(3);
		expect(out.map((p) => p.url).sort()).toEqual(photos.map((p) => p.dataUrl).sort());
	});

	it('falls back to the lead label when there is no pick', () => {
		const unranked = [photos[1], photos[0], photos[2]];
		expect(buildPublicPhotos({ photos: unranked }, 'woman')[0].url).toBe('https://s/photo_0.jpg');
	});

	it('falls back to the lead label when the pick is stale or empty', () => {
		for (const heroPick of [pickOf(null), pickOf('https://s/deleted.jpg')]) {
			const unranked = [photos[1], photos[0], photos[2]];
			expect(buildPublicPhotos({ photos: unranked, heroPick }, 'woman')[0].url).toBe('https://s/photo_0.jpg');
		}
	});

	it('leaves men alone — their AI lead portrait is assigned at generation', () => {
		const aiPhotos = [
			{ url: 'https://s/ai_warmth.png', role: 'warmth' },
			{ url: 'https://s/ai_lead.png', role: 'lead' },
		];
		// A stray heroPick (e.g. from before a gender correction) must not re-order his set.
		const out = buildPublicPhotos({ aiPhotos, photos, heroPick: pickOf('https://s/ai_warmth.png') }, 'man');
		expect(out[0].url).toBe('https://s/ai_lead.png');
		expect(out.every((p) => p.ai)).toBe(true);
	});
});

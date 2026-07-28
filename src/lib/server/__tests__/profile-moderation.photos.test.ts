import { describe, it, expect } from 'vitest';
import { profileHideReason } from '../profile-moderation';
import { ownHostedPhotosOnly } from '../profile-photos';

const good = { firstName: 'Ruhii', age: 30, city: 'Rudrapur', about: 'Loves long drives.' };

describe('profileHideReason — photo gates', () => {
	it('shows a normal profile with a photo', () => {
		expect(profileHideReason({ ...good, hasPhoto: true, photoGateStatus: 'passed' })).toBeNull();
	});

	it('hides a profile with no displayable photo', () => {
		expect(profileHideReason({ ...good, hasPhoto: false })).toBe('no photo');
	});

	it('hides a profile whose photos are not the owner', () => {
		expect(profileHideReason({ ...good, hasPhoto: true, photoGateStatus: 'rejected' }))
			.toBe('photos do not match verification selfie');
	});

	it('does NOT hide when the gate could not reach a verdict', () => {
		// A vision outage or a user with no anchor selfie must not empty the feed.
		for (const status of ['unverified', 'error', 'off', undefined]) {
			expect(profileHideReason({ ...good, hasPhoto: true, photoGateStatus: status })).toBeNull();
		}
	});

	it('leaves the photo checks opt-in (undefined hasPhoto skips them)', () => {
		expect(profileHideReason(good)).toBeNull();
	});

	it('still applies the pre-existing identity gates first', () => {
		expect(profileHideReason({ ...good, firstName: 'New member', hasPhoto: true }))
			.toBe('default name not updated');
	});
});

describe('ownHostedPhotosOnly', () => {
	const OWN = 'https://stikoktiaxqtcsohcxzp.supabase.co';

	it('keeps photos hosted in our storage', () => {
		const photos = [
			{ dataUrl: `${OWN}/storage/v1/object/public/profiles/users/u/photo_0.jpg`, label: 'lead' },
			{ url: `${OWN}/storage/v1/object/public/profiles/ai/u/lead.png`, role: 'lead' },
		];
		expect(ownHostedPhotosOnly(photos, OWN)).toEqual(photos);
	});

	it('drops externally hosted URLs — the way around the identity gate', () => {
		const kept = { dataUrl: `${OWN}/storage/v1/object/public/profiles/users/u/photo_0.jpg` };
		expect(
			ownHostedPhotosOnly(
				[{ dataUrl: 'https://example.com/someone-else.jpg' }, kept, { url: 'data:image/jpeg;base64,AAAA' }],
				OWN
			)
		).toEqual([kept]);
	});

	it('drops malformed entries and tolerates non-arrays', () => {
		expect(ownHostedPhotosOnly([{}, null, 'nope', { dataUrl: 7 }], OWN)).toEqual([]);
		expect(ownHostedPhotosOnly(undefined, OWN)).toEqual([]);
	});

	it('is not fooled by a look-alike host prefix', () => {
		expect(ownHostedPhotosOnly([{ url: 'https://evil.com/https://stikoktiaxqtcsohcxzp.supabase.co/x.jpg' }], OWN))
			.toEqual([]);
	});
});

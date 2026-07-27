/**
 * WhatsApp / phone number handling, shared by the browser form and the server
 * endpoint that stores it. Both sides must agree on what "valid" means, so the
 * rules live here once — the client copy is for instant feedback only, the
 * server copy is the real gate (see the input-limits convention: never trust a
 * value just because a form validated it).
 *
 * We deliberately do NOT depend on libphonenumber: it is ~500KB, this is one
 * field on one public landing page, and per-country carrier rules would give us
 * nothing here. What we need is the number to be dialable on WhatsApp, and for
 * that E.164 shape plus a national-length range is enough.
 */

/** Dial codes offered in the picker, most likely first. */
export const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91' },
  { code: '+62', label: '🇮🇩 +62' },
  { code: '+1', label: '🇺🇸 +1' },
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+971', label: '🇦🇪 +971' },
  { code: '+65', label: '🇸🇬 +65' },
  { code: '+61', label: '🇦🇺 +61' },
  { code: '+60', label: '🇲🇾 +60' },
  { code: '+63', label: '🇵🇭 +63' },
  { code: '+66', label: '🇹🇭 +66' },
  { code: '+84', label: '🇻🇳 +84' },
  { code: '+81', label: '🇯🇵 +81' },
  { code: '+82', label: '🇰🇷 +82' },
  { code: '+86', label: '🇨🇳 +86' },
  { code: '+49', label: '🇩🇪 +49' },
  { code: '+33', label: '🇫🇷 +33' },
  { code: '+34', label: '🇪🇸 +34' },
  { code: '+39', label: '🇮🇹 +39' },
  { code: '+31', label: '🇳🇱 +31' },
  { code: '+64', label: '🇳🇿 +64' },
  { code: '+27', label: '🇿🇦 +27' },
  { code: '+234', label: '🇳🇬 +234' },
  { code: '+92', label: '🇵🇰 +92' },
  { code: '+880', label: '🇧🇩 +880' },
  { code: '+94', label: '🇱🇰 +94' },
  { code: '+977', label: '🇳🇵 +977' },
] as const;

/** India — the default, and the only code with a tightened rule below. */
export const DEFAULT_COUNTRY_CODE = '+91';

const VALID_CODES = new Set<string>(COUNTRY_CODES.map((c) => c.code));

/** E.164 allows 15 digits total including the country code. */
const MAX_E164_DIGITS = 15;
const MIN_NATIONAL_DIGITS = 6;

/** Strip everything that isn't a digit — spaces, dashes, brackets, dots. */
export function digitsOnly(value: string): string {
  return value.replace(/\D+/g, '');
}

export interface PhoneResult {
  ok: boolean;
  /** Digits only, no country code. Set whenever parsing got that far. */
  national: string;
  /** Full +<code><national>, ready to dial. Only set when ok. */
  e164: string;
  /** User-facing reason, already phrased for display. */
  error: string;
}

/**
 * Validate a (country code, typed number) pair and build the E.164 form.
 *
 * People paste numbers in every shape — "+91 98765 43210", "098765-43210",
 * "0091…" — so we normalize before judging: strip non-digits, then drop a
 * duplicated country code or a national trunk '0' prefix rather than rejecting
 * a number that is actually fine.
 */
export function parsePhone(countryCode: string, rawNumber: string): PhoneResult {
  const fail = (error: string, national = ''): PhoneResult => ({
    ok: false,
    national,
    e164: '',
    error,
  });

  const code = countryCode.trim();
  if (!VALID_CODES.has(code)) {
    return fail('Please select your country code.');
  }

  let national = digitsOnly(rawNumber);
  if (!national) {
    return fail('Please enter your WhatsApp number.');
  }

  // "+91 98765 43210" typed into the number box, or a 00-prefixed international
  // form — the country code is already selected, so shed the duplicate.
  const bare = code.slice(1);
  if (national.startsWith(`00${bare}`)) national = national.slice(2 + bare.length);
  else if (national.length > bare.length && national.startsWith(bare)) {
    const rest = national.slice(bare.length);
    // Only treat it as a duplicated code if what's left is still a plausible
    // number — otherwise "911234" (a real 6-digit national number) loses its 91.
    if (rest.length >= MIN_NATIONAL_DIGITS) national = rest;
  }

  // Domestic trunk prefix: 098765 43210 → 98765 43210.
  if (national.startsWith('0')) national = national.replace(/^0+/, '');

  if (!national) {
    return fail('Please enter your WhatsApp number.');
  }

  // India is the overwhelming majority of signups and has one unambiguous rule
  // (10 digits, starting 6-9), so it's worth catching a typo'd Indian number
  // precisely instead of waving through anything 6-14 digits long.
  if (code === DEFAULT_COUNTRY_CODE) {
    if (national.length !== 10 || !/^[6-9]/.test(national)) {
      return fail('Enter a 10-digit Indian mobile number.', national);
    }
  } else if (
    national.length < MIN_NATIONAL_DIGITS ||
    national.length + bare.length > MAX_E164_DIGITS
  ) {
    return fail('That phone number doesn’t look right.', national);
  }

  return { ok: true, national, e164: `${code}${national}`, error: '' };
}

/** Display form for admin tables: "+91 98765 43210". */
export function formatPhone(countryCode: string | null, national: string | null): string {
  if (!countryCode || !national) return '';
  if (countryCode === DEFAULT_COUNTRY_CODE && national.length === 10) {
    return `${countryCode} ${national.slice(0, 5)} ${national.slice(5)}`;
  }
  return `${countryCode} ${national}`;
}

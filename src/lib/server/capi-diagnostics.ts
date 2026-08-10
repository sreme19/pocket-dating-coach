/**
 * Prove the Meta Conversions API token in the environment actually works.
 *
 * WHY THIS IS WORTH A FILE. The token is a user access token, extended to roughly
 * 60 days, which means it will expire and be replaced several times a year. Every
 * one of those rotations has the same failure mode: the wrong string gets pasted —
 * Meta's debugger shows a short-lived token in the field above and the extended one
 * in a box below, and they look identical — and nothing complains. Forwarding just
 * stops.
 *
 * Without this, the only way to find out is to wait for a real store tap and read
 * `meta_forwarded` afterwards. At current volumes that is hours, and it tests the
 * token by spending money on an advert. This asks Meta directly, in one call.
 *
 * NOTHING IT SENDS REACHES OPTIMISATION. Every event carries `test_event_code`,
 * which routes it to the Test Events tab in Events Manager instead of into the
 * dataset that trains delivery. That matters: this codebase already had to fix
 * developer traffic polluting the pixel, and a diagnostic that did the same thing
 * would be the identical mistake wearing a different hat.
 *
 * The payload deliberately mirrors what recordStoreClick actually sends, including
 * the fbc/fbp shape, so a pass here means the real path passes too rather than
 * merely that the credential is alive.
 */

import { env } from '$env/dynamic/private';

const META_PIXEL_ID = '2286986682092608';
const API_VERSION = 'v21.0';
const TIMEOUT_MS = 10_000;

export interface CapiTestResult {
  configured: boolean;
  ok: boolean;
  /** Meta's verbatim response body, so a failure can be read rather than guessed at. */
  response: unknown;
  /** Set when the failure is one with a known cause and a known fix. */
  diagnosis: string | null;
}

/**
 * Send one test event and report exactly what Meta said.
 *
 * `testEventCode` comes from Events Manager → Test Events. Without it the event
 * would land in real data, so an absent code is refused rather than silently
 * downgraded into a live event.
 */
export async function testMetaCapi(testEventCode: string): Promise<CapiTestResult> {
  const token = env.META_CAPI_TOKEN;
  if (!token) {
    return {
      configured: false,
      ok: false,
      response: null,
      diagnosis: 'META_CAPI_TOKEN is not set in this environment.'
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${META_PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        access_token: token,
        test_event_code: testEventCode,
        data: [
          {
            event_name: 'StoreClick',
            event_time: Math.floor(Date.now() / 1000),
            event_id: `capi-selftest-${Date.now()}`,
            event_source_url: 'https://www.riteangle.dating/get',
            action_source: 'website',
            // Same shape recordStoreClick sends. A bare event without user_data is
            // rejected outright for being too broad to match, so testing without
            // these would test a payload we never actually send.
            user_data: {
              client_user_agent:
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
              client_ip_address: '49.207.1.1',
              fbc: `fb.1.${Date.now()}.capiSelfTest`,
              fbp: `fb.1.${Date.now()}.1234567890`
            },
            custom_data: { cta: 'selftest', campaign: 'capi_selftest' }
          }
        ]
      })
    });

    const body = await res.json().catch(() => null);
    const ok = res.ok && typeof body === 'object' && body !== null && 'events_received' in body;

    return { configured: true, ok, response: body, diagnosis: ok ? null : diagnose(body) };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      response: String(err),
      diagnosis: 'The request to Meta failed or timed out before a response arrived.'
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Turn Meta's error codes into the thing to actually go and do.
 *
 * Worth the mapping because the two commonest failures look nothing like their
 * cause: an expired token reports as 190, which on a chart is indistinguishable
 * from a campaign that stopped spending, and a stale test code reports as a
 * parameter error rather than as "your test code expired".
 */
function diagnose(body: unknown): string {
  const error = (body as { error?: { code?: number; error_subcode?: number; message?: string } })
    ?.error;
  if (!error) return 'Meta returned an unexpected response shape.';

  if (error.code === 190) {
    return 'Token expired or revoked (code 190). Generate a fresh one and Extend it — note the extended token is the box BELOW the debugger results, not the field above.';
  }
  if (error.code === 200 || error.code === 10) {
    return 'Token authenticated but lacks permission on this dataset (code 200/10). It needs ads_management on the pixel.';
  }
  if (error.error_subcode === 2804050) {
    return 'Rejected for insufficient customer information parameters — the payload lost its user_data, which should not happen from this endpoint.';
  }
  if (error.code === 100) {
    return `Invalid parameter — most often an expired or mistyped test_event_code. Re-copy it from Events Manager → Test Events. (${error.message ?? ''})`;
  }
  return error.message ?? 'Unknown error from Meta.';
}

import { createClient } from '@supabase/supabase-js';
import { createSign } from 'node:crypto';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!) as any;

const MAX_TITLE_LENGTH = 65;
const MAX_BODY_LENGTH = 240;

function buildPayload(token: string, title: string, body: string, deepLink: string) {
  return {
    to: token,
    notification: {
      title: title.slice(0, MAX_TITLE_LENGTH),
      body: body.slice(0, MAX_BODY_LENGTH),
    },
    data: { type: 'profile_tip', deepLink },
  };
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getFcmAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < tokenExpiresAt) return cachedToken;

  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FCM_SERVICE_ACCOUNT env var not set');
  const sa = JSON.parse(raw) as { client_email: string; private_key: string };

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const claimset = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const signingInput = `${header}.${claimset}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const sig = sign.sign(sa.private_key, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${signingInput}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`OAuth2 token exchange failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  cachedToken = data.access_token;
  tokenExpiresAt = now + 3000;
  return cachedToken;
}

async function sendOne(token: string, title: string, body: string, deepLink: string) {
  const raw = process.env.FCM_SERVICE_ACCOUNT!;
  const { project_id } = JSON.parse(raw) as { project_id: string };
  const accessToken = await getFcmAccessToken();
  const payload = buildPayload(token, title, body, deepLink);

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${project_id}/messages:send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      message: {
        token,
        notification: payload.notification,
        data: Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v ?? '')])),
      },
    }),
  });
  if (res.ok) return { success: true };
  const errBody = await res.json().catch(() => ({})) as any;
  const errCode = errBody?.error?.details?.[0]?.errorCode ?? '';
  if (res.status === 404 || errCode === 'UNREGISTERED') {
    await db.from('device_tokens').delete().eq('token', token);
    return { success: false, error: 'unregistered, removed' };
  }
  return { success: false, error: `FCM ${res.status}: ${errCode || res.statusText}` };
}

async function sendToUser(userId: string, title: string, body: string, deepLink: string) {
  const { data: tokens } = await db.from('device_tokens').select('token').eq('user_id', userId);
  const rows = (tokens ?? []) as Array<{ token: string }>;
  if (rows.length === 0) return { sent: 0, skipped: 'no_token' };

  let sent = 0;
  for (const { token } of rows) {
    const result = await sendOne(token, title, body, deepLink);
    if (result.success) sent++;
    else console.warn(`  send failed for token: ${result.error}`);
  }
  if (sent > 0) {
    await db.from('notification_log').insert({ user_id: userId, type: 'profile_tip', channel: 'push', title });
  }
  return { sent, skipped: sent === 0 ? 'all_sends_failed' : null };
}

(async () => {
  const userIds: string[] = JSON.parse(process.argv[2] ?? '[]');
  if (userIds.length === 0) {
    console.log('usage: notify-photo-ready.ts \'["uuid1","uuid2"]\'');
    return;
  }

  const title = 'Your new photos are up ✨';
  const body = 'We refreshed your profile photos — check them out.';
  const deepLink = '/verified-vibe/profile';

  console.log(`Notifying ${userIds.length} users...`);
  for (const userId of userIds) {
    try {
      const result = await sendToUser(userId, title, body, deepLink);
      console.log(`${userId}: sent=${result.sent} skipped=${result.skipped ?? '-'}`);
    } catch (e) {
      console.error(`${userId}: FAILED`, e instanceof Error ? e.message : e);
    }
  }
  console.log('Done.');
})();

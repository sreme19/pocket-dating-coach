import sys, json, os
from datetime import datetime, timezone, timedelta

rows        = json.loads(open(sys.argv[1]).read())
check_name  = os.environ.get('CHECK_NAME', '')
last_error  = os.environ.get('LAST_ERROR', 'Unknown error')
http_code   = os.environ.get('HTTP_CODE', '0')
response_ms = os.environ.get('RESPONSE_MS', '0')
endpoint    = os.environ.get('ENDPOINT', '')
app_url     = os.environ.get('APP_URL', '')
alert_email = os.environ.get('ALERT_EMAIL', '')

now_utc = datetime.now(timezone.utc)
now_wib = now_utc.astimezone(timezone(timedelta(hours=7)))

DIAG = {
  '000': ('Connection timeout / DNS failure',  'Domain may be unreachable. Check Vercel status and DNS settings.'),
  '502': ('Bad gateway',                       'App is not responding behind the proxy. Check Vercel function logs.'),
  '503': ('Server unavailable or overloaded',  'Service is down or cold-start failed. Check Vercel deployment logs.'),
  '504': ('Gateway timeout',                   'App did not respond in time. Check Vercel and Supabase status pages.'),
  '401': ('Authentication failed',             'Check CRON_SECRET and API key environment variables in Vercel.'),
  '403': ('Forbidden',                         'Check permissions and environment variable configuration.'),
  '429': ('Rate limited',                      'Too many requests. Check API usage quotas and rate-limit config.'),
}
diag_title, diag_action = DIAG.get(str(http_code), ('Unexpected error', f'HTTP {http_code} — check server logs and Vercel function output for details.'))

def status_style(s):
  if s == 'OK':   return '#16a34a', '✅'
  if s == 'WARN': return '#d97706', '⚠️'
  return '#dc2626', '🔴'

history_rows = ''
for r in rows:
  s   = r.get('status', '?')
  ts  = r.get('created_at', '')[:16].replace('T', ' ')
  ms  = r.get('response_time_ms')
  err = (r.get('error_message') or '')[:70]
  color, emoji = status_style(s)
  history_rows += (
    f'<tr>'
    f'<td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280">{ts} UTC</td>'
    f'<td style="padding:5px 10px;border-bottom:1px solid #f3f4f6"><span style="color:{color};font-weight:700;font-size:12px">{emoji} {s}</span></td>'
    f'<td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280">{ms}ms' if ms else '<td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#9ca3af">—'
    + f'</td>'
    f'<td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#9ca3af">{err}</td>'
    f'</tr>'
  )

html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:24px">
<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.12)">

  <div style="background:#dc2626;color:#fff;padding:20px 24px">
    <h2 style="margin:0;font-size:18px">🔴 CRITICAL: Service Alert — riteangle.dating</h2>
    <p style="margin:6px 0 0;font-size:13px;opacity:0.9">3 consecutive failures · immediate action required</p>
  </div>

  <div style="padding:16px 24px;background:#fef2f2;border-bottom:1px solid #fecaca">
    <p style="margin:0;font-size:14px;color:#991b1b">
      <strong>{check_name}</strong> has failed 3 times in a row.
    </p>
    <p style="margin:6px 0 0;font-size:12px;color:#6b7280">
      {now_utc.strftime('%a, %d %b %Y %H:%M:%S UTC')} &nbsp;·&nbsp; {now_wib.strftime('%H:%M:%S WIB')}
    </p>
  </div>

  <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb">
    <h3 style="margin:0 0 12px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Failure Detail</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:5px 0;color:#6b7280;width:120px;vertical-align:top">Check</td>
          <td style="padding:5px 0;color:#111827;font-weight:600;font-family:monospace">{check_name}</td></tr>
      <tr><td style="padding:5px 0;color:#6b7280;vertical-align:top">Endpoint</td>
          <td style="padding:5px 0;color:#374151;font-family:monospace;font-size:12px;word-break:break-all">{endpoint}</td></tr>
      <tr><td style="padding:5px 0;color:#6b7280">HTTP Code</td>
          <td style="padding:5px 0;color:#dc2626;font-weight:700;font-size:18px">{http_code}</td></tr>
      <tr><td style="padding:5px 0;color:#6b7280">Response Time</td>
          <td style="padding:5px 0;color:#374151">{response_ms} ms</td></tr>
      <tr><td style="padding:5px 0;color:#6b7280;vertical-align:top">Error</td>
          <td style="padding:5px 0;color:#991b1b;font-size:13px">{last_error}</td></tr>
    </table>
  </div>

  <div style="padding:16px 24px;background:#fffbeb;border-bottom:1px solid #fde68a">
    <p style="margin:0;font-size:13px;font-weight:700;color:#92400e">⚡ {diag_title}</p>
    <p style="margin:6px 0 0;font-size:13px;color:#78350f">{diag_action}</p>
  </div>

  <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb">
    <h3 style="margin:0 0 10px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Recent History (last 5 checks)</h3>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#f9fafb">
        <th style="padding:5px 10px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600">Time (UTC)</th>
        <th style="padding:5px 10px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600">Status</th>
        <th style="padding:5px 10px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600">Latency</th>
        <th style="padding:5px 10px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600">Error</th>
      </tr></thead>
      <tbody>{history_rows}</tbody>
    </table>
  </div>

  <div style="padding:16px 24px;border-bottom:1px solid #e5e7eb">
    <a href="{app_url}/admin/monitoring" style="display:inline-block;padding:10px 18px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;margin-right:8px">View Monitoring Dashboard</a>
    <a href="{app_url}/api/health" style="display:inline-block;padding:10px 18px;background:#f3f4f6;color:#374151;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">Live Health API</a>
  </div>

  <div style="padding:12px 24px;background:#f9fafb;color:#9ca3af;font-size:11px">
    Sent by GitHub Actions Monitor · riteangle.dating
  </div>
</div>
</body></html>"""

payload = json.dumps({
  "from":    "PDC Monitor <monitor@riteangle.dating>",
  "to":      [alert_email],
  "subject": f"🔴 CRITICAL: {check_name} failed 3× (HTTP {http_code}) — riteangle.dating",
  "html":    html,
})
print(payload)

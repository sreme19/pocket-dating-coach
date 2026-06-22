import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { runHealthCheck } from '$lib/server/health';

export const HEAD: RequestHandler = async () => new Response(null, { status: 200 });

export const GET: RequestHandler = async () => {
  const report = await runHealthCheck();
  const httpStatus = report.status === 'down' ? 503 : report.status === 'degraded' ? 207 : 200;
  return json(report, { status: httpStatus });
};

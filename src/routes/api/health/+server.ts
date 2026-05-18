import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * Health check endpoint
 * Used to verify server connectivity and basic functionality
 */
export const HEAD: RequestHandler = async () => {
  return new Response(null, { status: 200 });
};

export const GET: RequestHandler = async () => {
  return json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime?.() || 0
  });
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateAllHourlySummaries, deleteOldSummaries } from '$lib/server/summary-generator';
import {
	throwAuthenticationError,
	throwValidationError,
	throwInternalError,
	logError,
	ErrorType
} from '$lib/server/error-handler';

/**
 * POST /api/ai-bestie/summary-job
 * 
 * Scheduled job endpoint to generate hourly summaries for all users.
 * This endpoint should be called by a cron service (e.g., Vercel Cron, AWS EventBridge, etc.)
 * 
 * Authentication: Requires a valid CRON_SECRET header
 * 
 * Request headers:
 * {
 *   "Authorization": "Bearer <CRON_SECRET>"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "processed": 5,
 *   "failed": 0,
 *   "errors": [],
 *   "message": "Hourly summaries generated successfully"
 * }
 * 
 * Requirements: 7.1, 7.2, 7.3, 42.1
 */
export const POST: RequestHandler = async ({ request }) => {
	// Validate cron secret from environment
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret) {
		logError(
			'POST /api/ai-bestie/summary-job',
			new Error('CRON_SECRET not configured'),
			ErrorType.INTERNAL_ERROR
		);
		throwInternalError(
			'POST /api/ai-bestie/summary-job',
			new Error('CRON_SECRET not configured'),
			'Cron job not properly configured'
		);
	}

	// Validate authorization header
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		logError(
			'POST /api/ai-bestie/summary-job',
			new Error('Missing or invalid Authorization header'),
			ErrorType.VALIDATION_ERROR
		);
		throwValidationError('Missing or invalid Authorization header');
	}

	const token = authHeader.substring(7); // Remove "Bearer " prefix
	if (token !== cronSecret) {
		logError(
			'POST /api/ai-bestie/summary-job',
			new Error('Invalid cron secret'),
			ErrorType.VALIDATION_ERROR
		);
		throwValidationError('Invalid cron secret');
	}

	try {
		// Generate hourly summaries for all users
		const result = await generateAllHourlySummaries();

		// Clean up old summaries (older than 30 days)
		const cleanupResult = await deleteOldSummaries(30);

		return json({
			success: true,
			processed: result.processed,
			failed: result.failed,
			errors: result.errors,
			cleaned: cleanupResult.deleted,
			message: `Hourly summaries generated successfully. Processed: ${result.processed}, Failed: ${result.failed}, Cleaned: ${cleanupResult.deleted}`
		});
	} catch (err) {
		logError('POST /api/ai-bestie/summary-job', err, ErrorType.INTERNAL_ERROR);
		throwInternalError(
			'POST /api/ai-bestie/summary-job',
			err,
			'Failed to generate hourly summaries'
		);
	}
};

/**
 * GET /api/ai-bestie/summary-job
 * 
 * Health check endpoint for the scheduled job
 * 
 * Response:
 * {
 *   "status": "ok",
 *   "message": "Summary job endpoint is ready"
 * }
 */
export const GET: RequestHandler = async () => {
	return json({
		status: 'ok',
		message: 'Summary job endpoint is ready'
	});
};

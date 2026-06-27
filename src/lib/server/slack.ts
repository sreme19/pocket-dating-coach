/**
 * Shared Slack webhook utility.
 * Set SLACK_WEBHOOK_URL in Vercel environment variables.
 * All calls are fire-and-forget — never throws, never blocks the response.
 */

type SlackColor = 'critical' | 'warning' | 'info' | 'ok';

const COLOR: Record<SlackColor, string> = {
	critical: '#dc2626', // red
	warning:  '#f59e0b', // amber
	info:     '#7c3aed', // purple
	ok:       '#16a34a', // green
};

interface SlackField {
	label: string;
	value: string;
	short?: boolean;
}

interface SlackAlertOptions {
	color:    SlackColor;
	emoji:    string;
	title:    string;
	subtitle?: string;
	fields?:  SlackField[];
	footer?:  string;
	dashboardUrl?: string;
}

export async function sendSlackAlert(opts: SlackAlertOptions): Promise<void> {
	const webhookUrl = process.env.SLACK_WEBHOOK_URL;
	if (!webhookUrl) return;

	const now = new Date();
	const wibStr = new Date(now.getTime() + 7 * 3600 * 1000)
		.toISOString().slice(11, 16) + ' WIB';

	const fieldBlocks = (opts.fields ?? []).map((f) => ({
		type: 'mrkdwn',
		text: `*${f.label}*\n${f.value}`,
	}));

	const blocks: object[] = [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `${opts.emoji} *${opts.title}*${opts.subtitle ? `\n${opts.subtitle}` : ''}`,
			},
		},
	];

	if (fieldBlocks.length > 0) {
		// Slack allows max 10 fields per section; chunk into rows of 2
		for (let i = 0; i < fieldBlocks.length; i += 2) {
			blocks.push({
				type: 'section',
				fields: fieldBlocks.slice(i, i + 2),
			});
		}
	}

	if (opts.dashboardUrl) {
		blocks.push({
			type: 'actions',
			elements: [
				{
					type: 'button',
					text: { type: 'plain_text', text: 'View Dashboard', emoji: true },
					url: opts.dashboardUrl,
					style: opts.color === 'critical' ? 'danger' : 'primary',
				},
			],
		});
	}

	blocks.push({
		type: 'context',
		elements: [
			{
				type: 'mrkdwn',
				text: `${opts.footer ?? 'riteangle monitor'} · ${wibStr}`,
			},
		],
	});

	const payload = {
		attachments: [
			{
				color:  COLOR[opts.color],
				blocks,
			},
		],
	};

	try {
		await fetch(webhookUrl, {
			method:  'POST',
			headers: { 'Content-Type': 'application/json' },
			body:    JSON.stringify(payload),
		});
	} catch (e) {
		console.error('[slack] Webhook failed:', e);
	}
}

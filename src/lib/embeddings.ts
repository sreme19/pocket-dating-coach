import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, 'embed-worker.mjs');

function runEmbedWorker(text: string): Promise<number[]> {
	return new Promise((resolve, reject) => {
		execFile(
			process.execPath,
			[WORKER_PATH, text],
			{ maxBuffer: 1024 * 1024 * 10 },
			(err, stdout, stderr) => {
				if (err) {
					reject(new Error(`Embed worker error: ${stderr || err.message}`));
					return;
				}
				try {
					resolve(JSON.parse(stdout));
				} catch {
					reject(new Error(`Failed to parse embedding: ${stdout.slice(0, 100)}`));
				}
			}
		);
	});
}

export async function getEmbedding(text: string): Promise<number[]> {
	return runEmbedWorker(text);
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
	return Promise.all(texts.map(runEmbedWorker));
}

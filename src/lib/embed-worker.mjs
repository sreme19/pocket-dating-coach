/**
 * Standalone embedding worker — called as a child process from embeddings.ts
 * Reads text from stdin, writes JSON embedding array to stdout.
 */
import { pipeline } from '@xenova/transformers';

const text = process.argv[2];
if (!text) {
	process.stderr.write('No text provided\n');
	process.exit(1);
}

const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const output = await embedder(text, { pooling: 'mean', normalize: true });
process.stdout.write(JSON.stringify(Array.from(output.data)));

/**
 * Book ingestion script
 * Run once after setting up Supabase:
 *   npm run ingest
 *
 * Requires .env to have SUPABASE_URL and SUPABASE_SERVICE_KEY set.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { createRequire } from 'module';
import { pipeline } from '@xenova/transformers';

const require = createRequire(import.meta.url);

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';
const DATA_DIR = join(process.cwd(), 'data');
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
	console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment');
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function extractTextFromPdf(filePath: string): Promise<{ text: string; chapter: string }[]> {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const pdfParse = require('pdf-parse');
	const buffer = readFileSync(filePath);
	const data = await pdfParse(buffer);

	const fullText = data.text;
	const lines = fullText.split('\n');
	const sections: { text: string; chapter: string }[] = [];

	let currentChapter = 'Introduction';
	let currentText = '';

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const isChapterHeading =
			/^chapter\s+\d+/i.test(trimmed) ||
			/^part\s+[ivxlcdm]+/i.test(trimmed) ||
			(trimmed.length < 60 && trimmed === trimmed.toUpperCase() && trimmed.length > 3);

		if (isChapterHeading) {
			if (currentText.trim().length > 100) {
				sections.push({ text: currentText.trim(), chapter: currentChapter });
			}
			currentChapter = trimmed;
			currentText = '';
		} else {
			currentText += ' ' + trimmed;
		}
	}

	if (currentText.trim().length > 100) {
		sections.push({ text: currentText.trim(), chapter: currentChapter });
	}

	return sections;
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
	const words = text.split(/\s+/);
	const chunks: string[] = [];
	let start = 0;

	while (start < words.length) {
		const end = Math.min(start + chunkSize, words.length);
		chunks.push(words.slice(start, end).join(' '));
		start += chunkSize - overlap;
	}

	return chunks;
}

async function main() {
	console.log('🚀 Starting book ingestion...');

	const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

	const pdfFiles = readdirSync(DATA_DIR).filter(f => extname(f).toLowerCase() === '.pdf');

	if (pdfFiles.length === 0) {
		console.error('❌ No PDF files found in /data directory');
		process.exit(1);
	}

	console.log(`📚 Found ${pdfFiles.length} PDF file(s): ${pdfFiles.join(', ')}`);

	const { error: clearError } = await supabase.from('book_chunks').delete().neq('id', 0);
	if (clearError) {
		console.log('⚠️  Could not clear existing chunks (may be empty):', clearError.message);
	} else {
		console.log('🗑️  Cleared existing chunks');
	}

	let totalChunks = 0;

	for (const pdfFile of pdfFiles) {
		const filePath = join(DATA_DIR, pdfFile);
		console.log(`\n📖 Processing: ${pdfFile}`);

		const sections = await extractTextFromPdf(filePath);
		console.log(`   Found ${sections.length} sections`);

		for (const section of sections) {
			const chunks = chunkText(section.text, CHUNK_SIZE, CHUNK_OVERLAP);

			for (let i = 0; i < chunks.length; i++) {
				const chunk = chunks[i];
				if (chunk.trim().length < 50) continue;

				process.stdout.write(`   Embedding chunk ${totalChunks + 1}...\r`);

				const output = await embedder(chunk, { pooling: 'mean', normalize: true });
				const embedding = Array.from(output.data);

				const { error: insertError } = await supabase.from('book_chunks').insert({
					content: chunk,
					chapter: section.chapter,
					chunk_index: totalChunks,
					embedding
				});

				if (insertError) {
					console.error(`\n❌ Failed to insert chunk ${totalChunks}:`, insertError.message);
				} else {
					totalChunks++;
				}
			}
		}
	}

	console.log(`\n✅ Ingestion complete! ${totalChunks} chunks stored in Supabase.`);
}

main().catch(err => {
	console.error('Fatal error:', err);
	process.exit(1);
});

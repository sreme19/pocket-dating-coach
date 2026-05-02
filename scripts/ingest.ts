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

const require = createRequire(import.meta.url);

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY ?? '';
const DATA_DIR = join(process.cwd(), 'data');
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !VOYAGE_API_KEY) {
	console.error('❌ Missing SUPABASE_URL, SUPABASE_SERVICE_KEY, or VOYAGE_API_KEY in environment');
	process.exit(1);
}

async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
	const res = await fetch('https://api.voyageai.com/v1/embeddings', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${VOYAGE_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ input: texts, model: 'voyage-3-lite' })
	});
	if (!res.ok) throw new Error(`Voyage error: ${await res.text()}`);
	const data = await res.json() as { data: Array<{ embedding: number[] }> };
	return data.data.map(d => d.embedding);
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

	// Collect all chunks first
	const allChunks: Array<{ content: string; chapter: string }> = [];

	for (const pdfFile of pdfFiles) {
		const filePath = join(DATA_DIR, pdfFile);
		console.log(`\n📖 Processing: ${pdfFile}`);
		const sections = await extractTextFromPdf(filePath);
		console.log(`   Found ${sections.length} sections`);
		for (const section of sections) {
			const chunks = chunkText(section.text, CHUNK_SIZE, CHUNK_OVERLAP);
			for (const chunk of chunks) {
				if (chunk.trim().length >= 50) {
					allChunks.push({ content: chunk, chapter: section.chapter });
				}
			}
		}
	}

	console.log(`\n📦 Total chunks to embed: ${allChunks.length}`);

	// Free tier: 3 RPM, 10K TPM. ~500 words/chunk ≈ 650 tokens. 3 chunks ≈ 2K tokens, safe.
	const BATCH_SIZE = 3;
	const BATCH_DELAY_MS = 22000;
	let totalChunks = 0;

	for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
		const batch = allChunks.slice(i, i + BATCH_SIZE);
		const batchNum = Math.floor(i / BATCH_SIZE) + 1;
		const totalBatches = Math.ceil(allChunks.length / BATCH_SIZE);

		console.log(`   Batch ${batchNum}/${totalBatches} (${batch.length} chunks)...`);

		const embeddings = await getEmbeddingsBatch(batch.map(c => c.content));

		for (let j = 0; j < batch.length; j++) {
			const { error: insertError } = await supabase.from('book_chunks').insert({
				content: batch[j].content,
				chapter: batch[j].chapter,
				chunk_index: i + j,
				embedding: embeddings[j]
			});
			if (insertError) {
				console.error(`   ❌ Failed chunk ${i + j}:`, insertError.message);
			} else {
				totalChunks++;
			}
		}

		if (i + BATCH_SIZE < allChunks.length) {
			console.log(`   ⏳ Waiting ${BATCH_DELAY_MS / 1000}s (rate limit)...`);
			await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
		}
	}

	console.log(`\n✅ Ingestion complete! ${totalChunks} chunks stored in Supabase.`);
}

main().catch(err => {
	console.error('Fatal error:', err);
	process.exit(1);
});

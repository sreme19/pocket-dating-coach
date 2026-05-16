import { getSupabase } from '$lib/server/supabase';

export async function searchBookChunks(
	queryEmbedding: number[],
	topK = 5
): Promise<{ content: string; chapter: string; similarity: number }[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('match_book_chunks', {
		query_embedding: queryEmbedding,
		match_count: topK
	});

	if (error) {
		console.error('Supabase vector search error:', error);
		return [];
	}

	return (data ?? []) as { content: string; chapter: string; similarity: number }[];
}

export async function insertBookChunk(
	content: string,
	chapter: string,
	chunkIndex: number,
	embedding: number[]
): Promise<void> {
	const supabase = getSupabase();
	const { error } = await supabase.from('book_chunks').insert({
		content,
		chapter,
		chunk_index: chunkIndex,
		embedding
	});
	if (error) throw new Error(`Failed to insert chunk ${chunkIndex}: ${error.message}`);
}

export async function getChunkCount(): Promise<number> {
	const supabase = getSupabase();
	const { count, error } = await supabase
		.from('book_chunks')
		.select('*', { count: 'exact', head: true });
	if (error) return 0;
	return count ?? 0;
}

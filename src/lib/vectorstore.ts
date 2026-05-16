import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '$env/static/private';

type Database = {
	public: {
		Tables: {
			book_chunks: {
				Row: {
					id: string;
					content: string;
					chapter: string;
					chunk_index: number;
					embedding: number[];
				};
				Insert: {
					content: string;
					chapter: string;
					chunk_index: number;
					embedding: number[];
				};
				Update: Partial<Database['public']['Tables']['book_chunks']['Insert']>;
				Relationships: [];
			};
		};
		Functions: {
			match_book_chunks: {
				Args: {
					query_embedding: number[];
					match_count: number;
				};
				Returns: Array<{
					content: string;
					chapter: string;
					similarity: number;
				}>;
			};
		};
		Views: Record<string, never>;
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
};

let _supabase: ReturnType<typeof createClient<Database>> | null = null;

function getSupabase() {
	if (!_supabase) {
		_supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);
	}
	return _supabase;
}

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

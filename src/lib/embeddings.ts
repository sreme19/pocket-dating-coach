import { VOYAGE_API_KEY } from '$env/static/private';

const VOYAGE_MODEL = 'voyage-3-lite';
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';

async function fetchEmbeddings(inputs: string[]): Promise<number[][]> {
	const res = await fetch(VOYAGE_URL, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${VOYAGE_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ input: inputs, model: VOYAGE_MODEL })
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Voyage AI error ${res.status}: ${err}`);
	}

	const data = await res.json() as { data: Array<{ embedding: number[] }> };
	return data.data.map(d => d.embedding);
}

export async function getEmbedding(text: string): Promise<number[]> {
	const results = await fetchEmbeddings([text]);
	return results[0];
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
	return fetchEmbeddings(texts);
}

import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Load precomputed vectors in-memory
const vectors = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'vectors.json'), 'utf-8')
);

// Cosine similarity
function cosine(a, b) {
  let dot = 0; let normA = 0; let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function fetchTopChunks(query, topK = 5) {
  // 1. Embed the query
  const { data } = await openai.embeddings.create({ model: 'text-embedding-ada-002', input: query });
  const queryVec = data[0].embedding;

  // 2. Score each vector
  const scored = vectors.map(v => ({
    score: cosine(queryVec, v.embedding),
    text: v.metadata.text
  }));

  // 3. Return top K
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

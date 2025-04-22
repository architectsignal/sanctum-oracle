import fs from 'fs';
import path from 'path';
// import pdfParse from 'pdf-parse';   // temporarily disabled
import { load } from 'cheerio';
import MarkdownIt from 'markdown-it';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper to strip boilerplate and extract text
function extractTextFromHTML(html) {
  const $ = load(html);
  $('nav, footer, script, style').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

async function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (ext === '.pdf') {
    console.log(`Skipping PDF ${filePath}`);
    return '';
  }
  if (ext === '.html') {
    return extractTextFromHTML(buffer.toString());
  }
  if (ext === '.md') {
    const md = new MarkdownIt();
    const html = md.render(buffer.toString());
    return extractTextFromHTML(html);
  }
  return '';
}

function chunkText(text, maxLen = 1000) {
  const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
  const chunks = [];
  let chunk = '';
  for (const sent of sentences) {
    if ((chunk + sent).length > maxLen) {
      chunks.push(chunk.trim());
      chunk = sent;
    } else {
      chunk += sent;
    }
  }
  if (chunk) chunks.push(chunk.trim());
  return chunks;
}

(async () => {
  const docsDir = path.resolve('./site_simple_oracle_working');
  const files = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (['.html','.md','.pdf'].includes(path.extname(full).toLowerCase())) {
        files.push(full);
      }
    }
  }
  walk(docsDir);

  const vectors = [];
  for (const file of files) {
    const text = await processFile(file);
    if (!text) continue;  // skip empty results (PDFs, etc.)
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      const { data } = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: chunk
      });
      vectors.push({
        id: `${path.basename(file)}-${vectors.length}`,
        embedding: data[0].embedding,
        metadata: { source: file, text: chunk }
      });
    }
  }

  fs.writeFileSync(
    './netlify/functions/vectors.json',
    JSON.stringify(vectors, null, 2)
  );
  console.log('Indexing complete:', vectors.length, 'vectors');
})();
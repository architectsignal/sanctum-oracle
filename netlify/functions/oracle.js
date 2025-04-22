import 'dotenv/config';                     // ← loads OPENAI_API_KEY from .env
import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import MarkdownIt from 'markdown-it';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const md = new MarkdownIt();
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// extract HTML or MD as plain text
function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, 'utf-8');
  if (ext === '.html') {
    const $ = load(raw);
    $('nav, footer, script, style').remove();
    return $('body').text().replace(/\s+/g, ' ').trim();
  }
  if (ext === '.md') {
    const html = md.render(raw);
    const $ = load(html);
    return $('body').text().replace(/\s+/g, ' ').trim();
  }
  return '';
}

// chunk into ~1000-char pieces
function chunkText(text, maxLen = 1000) {
  const sentences = text.match(/[^\.\!\?]+[\.\!\?]+/g) || [text];
  const chunks = [];
  let buf = '';
  for (const s of sentences) {
    if (buf.length + s.length > maxLen) {
      chunks.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf) chunks.push(buf.trim());
  return chunks;
}

// score by keyword occurrences
function scoreChunk(chunk, words) {
  const lower = chunk.toLowerCase();
  return words.reduce(
    (sum, w) => sum + (w.length > 2 && lower.includes(w) ? 1 : 0),
    0
  );
}

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      payload = {};
    }
    const { question } = payload;
    if (!question) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Missing question' })
      };
    }

    // 1) Read & chunk site content
    const docsDir = path.resolve(process.cwd(), 'site_simple_oracle_working');
    const allChunks = [];
    (function walk(dir) {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
          walk(full);
        } else if (['.html', '.md'].includes(path.extname(full).toLowerCase())) {
          const txt = extractText(full);
          for (const c of chunkText(txt)) {
            allChunks.push({
              source: path.relative(process.cwd(), full),
              chunk: c
            });
          }
        }
      }
    })(docsDir);

    // 2) Score & pick top 5
    const qWords = question.toLowerCase().split(/\W+/);
    const top = allChunks
      .map(c => ({ ...c, score: scoreChunk(c.chunk, qWords) }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const context = top
      .map((c, i) => `(${i + 1}) [${c.source}]\n${c.chunk}`)
      .join('\n\n');

    // 3) Ask GPT-4
    const messages = [
      {
        role: 'system',
        content:
          'You are the Oracle of the Sanctum. Use these excerpts to answer clearly and mystically.'
      },
      {
        role: 'user',
        content: `Excerpts:\n${context}\n\nQuestion: ${question}`
      }
    ];

    const resp = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.8,
      max_tokens: 300
    });

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ answer: resp.choices[0].message.content })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: err.message || 'Server error' })
    };
  }
}

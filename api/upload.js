// ============================================================
// 實康復健科診所 RAG 上傳 API (Vercel)
// 路徑：api/upload.js
//
// 接收完整文章內容，切段後逐段 Embedding 存入 Supabase
// 使用串流方式避免記憶體問題
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const UPLOAD_SECRET = process.env.UPLOAD_SECRET;

// ── 文字切段 ────────────────────────────────────────────────
function chunkText(text, chunkSize = 400, overlap = 50) {
  const chunks = [];
  let start = 0;
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      const bp = text.lastIndexOf('。', end);
      if (bp > start + 100) end = bp + 1;
    }
    const chunk = text.substring(start, end).trim();
    if (chunk.length > 20) chunks.push(chunk);
    start = end - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}

// ── 單段 Embedding ──────────────────────────────────────────
async function embedChunk(text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] },
        outputDimensionality: 768
      })
    }
  );
  const data = await res.json();
  return data.embedding?.values || null;
}

// ── 存入 Supabase ───────────────────────────────────────────
async function insertChunk(title, idx, content, embedding, sourceFile) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
      'apikey': SUPABASE_SECRET_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ title, chunk_index: idx, content, embedding, source_file: sourceFile })
  });
  return res.status === 201;
}

// ── 主 Handler ──────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = req.headers['x-upload-secret'];
  if (!UPLOAD_SECRET || secret !== UPLOAD_SECRET) return res.status(403).end();

  const { fileName, content } = req.body;
  if (!fileName || !content) return res.status(400).json({ error: 'Missing fields' });

  const title = fileName.replace(/\.(txt|md).*/i, '');
  const chunks = chunkText(content);

  // 刪除舊版本
  await fetch(
    `${SUPABASE_URL}/rest/v1/knowledge_base?source_file=eq.${encodeURIComponent(fileName)}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`, 'apikey': SUPABASE_SECRET_KEY }
    }
  );

  // 逐段處理（await 確保每段完成再處理下一段，控制記憶體）
  let successCount = 0;
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedChunk(chunks[i]);
    if (!embedding) continue;
    const ok = await insertChunk(title, i, chunks[i], embedding, fileName);
    if (ok) successCount++;
  }

  return res.status(200).json({ success: true, totalChunks: chunks.length, successCount });
}

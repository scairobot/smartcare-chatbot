// ============================================================
// 實康復健科診所 RAG 文章上傳 API (Vercel)
// 路徑：api/upload.js
//
// Apps Script 把文章內容 POST 過來
// 這裡負責切段、Embedding、存入 Supabase
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const UPLOAD_SECRET = process.env.UPLOAD_SECRET; // 防止外人呼叫

// ── 文字切段 ────────────────────────────────────────────────
function chunkText(text, chunkSize = 300, overlap = 50) {
  const chunks = [];
  let start = 0;
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  while (start < text.length) {
    let end = start + chunkSize;
    if (end < text.length) {
      const breakPoint = text.lastIndexOf('。', end);
      if (breakPoint > start) end = breakPoint + 1;
    }
    const chunk = text.substring(start, Math.min(end, text.length)).trim();
    if (chunk.length > 20) chunks.push(chunk);
    start = end - overlap;
  }
  return chunks;
}

// ── Gemini Embedding ────────────────────────────────────────
async function getEmbedding(text) {
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

// ── 刪除舊版本 ──────────────────────────────────────────────
async function deleteOldChunks(sourceFile) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/knowledge_base?source_file=eq.${encodeURIComponent(sourceFile)}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
        'apikey': SUPABASE_SECRET_KEY
      }
    }
  );
}

// ── 存入 Supabase ───────────────────────────────────────────
async function insertChunk(title, chunkIndex, content, embedding, sourceFile) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
      'apikey': SUPABASE_SECRET_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ title, chunk_index: chunkIndex, content, embedding, source_file: sourceFile })
  });
  return res.status === 201;
}

// ── 主 Handler ──────────────────────────────────────────────
export default async function handler(req, res) {
  // 只允許 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 驗證 secret（防止外人呼叫）
  const secret = req.headers['x-upload-secret'];
  if (!UPLOAD_SECRET || secret !== UPLOAD_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { fileName, content } = req.body;
  if (!fileName || !content) {
    return res.status(400).json({ error: 'Missing fileName or content' });
  }

  try {
    const title = fileName.replace(/\.(txt|md).*/i, '');
    const chunks = chunkText(content);

    // 刪除舊版本
    await deleteOldChunks(fileName);

    // 逐段 Embedding + 存入
    let successCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await getEmbedding(chunks[i]);
      if (!embedding) continue;
      const ok = await insertChunk(title, i, chunks[i], embedding, fileName);
      if (ok) successCount++;
    }

    return res.status(200).json({
      success: true,
      fileName,
      totalChunks: chunks.length,
      successCount
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
}

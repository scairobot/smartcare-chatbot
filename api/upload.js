// ============================================================
// 實康復健科診所 RAG 單段上傳 API (Vercel)
// 路徑：api/upload.js
//
// 每次接收一個段落，做 Embedding 後存入 Supabase
// Apps Script 負責切段，一段一段呼叫這個 API
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const UPLOAD_SECRET = process.env.UPLOAD_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-upload-secret'];
  if (!UPLOAD_SECRET || secret !== UPLOAD_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { fileName, title, chunkIndex, content, deleteFirst } = req.body;
  if (!fileName || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 第一段時先刪除舊版本
    if (deleteFirst) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/knowledge_base?source_file=eq.${encodeURIComponent(fileName)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
            'apikey': SUPABASE_SECRET_KEY
          }
        }
      );
    }

    // Embedding
    const embedRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text: content }] },
          outputDimensionality: 768
        })
      }
    );
    const embedData = await embedRes.json();
    const embedding = embedData.embedding?.values;
    if (!embedding) {
      return res.status(500).json({ error: 'Embedding failed', detail: embedData });
    }

    // 存入 Supabase
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
        'apikey': SUPABASE_SECRET_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        title: title || fileName,
        chunk_index: chunkIndex || 0,
        content,
        embedding,
        source_file: fileName
      })
    });

    if (insertRes.status !== 201) {
      const errText = await insertRes.text();
      return res.status(500).json({ error: 'Insert failed', detail: errText });
    }

    return res.status(200).json({ success: true, chunkIndex });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
}


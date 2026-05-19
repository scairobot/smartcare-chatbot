// ============================================================
// 實康復健科診所 AI 客服後端 (Vercel)
// FAQ 和診所資訊從 Google Sheets 讀取
// RAG 知識庫從 Supabase 讀取（衛教文章等）
// ============================================================

const ALLOWED_ORIGINS = [
  'https://www.smartcare.com.tw',
  'https://smartcare.com.tw',
  'https://smartcare-chatbot.vercel.app',
  'http://smartcare-chatbot.vercel.app',
];

const SPREADSHEET_ID = '1ElYYK3wK-M0n11yxinpKcuBeHHmKuG_YY6AYvp355TU';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

// 時間相關詞彙 — 含這些詞直接送 Gemini，不走 FAQ
const TIME_KEYWORDS = [
  '今天', '今日', '現在', '目前', '這週', '本週', '這禮拜',
  '明天', '明日', '後天', '昨天', '幾號', '幾月', '星期幾',
  '週一', '週二', '週三', '週四', '週五', '週六', '週日',
  '禮拜一', '禮拜二', '禮拜三', '禮拜四', '禮拜五', '禮拜六', '禮拜日',
  '上午', '下午', '早上', '晚上', '中午', '幾點', '有沒有', '有開', '有上班',
  '休診', '休假', '放假', '連假', '假日'
];

// ── RAG 向量搜尋 ────────────────────────────────────────────
async function searchRAG(query, geminiApiKey, topK = 3) {
  try {
    // 把問題轉成向量
    const embedRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text: query }] },
          outputDimensionality: 768
        })
      }
    );
    const embedData = await embedRes.json();
    if (!embedData.embedding?.values) return '';

    // 搜尋 Supabase
    const searchRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_knowledge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'apikey': SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify({
        query_embedding: embedData.embedding.values,
        match_threshold: 0.7,
        match_count: topK
      })
    });

    const results = await searchRes.json();
    if (!Array.isArray(results) || results.length === 0) return '';

    // 組成 context 文字
    let context = '\n\n【相關衛教資料】\n';
    results.forEach((r, i) => {
      context += `(${i+1}) ${r.title}：\n${r.content}\n\n`;
    });
    return context;
  } catch (err) {
    console.error('RAG search error:', err);
    return '';
  }
}

// ── Google Sheets 認證 ──────────────────────────────────────
async function getAccessToken(serviceAccount) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signingInput = `${encode(header)}.${encode(claim)}`;
  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(serviceAccount.private_key, 'base64url');
  const jwt = `${signingInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// ── 讀取 Sheets 資料 ────────────────────────────────────────
async function readSheet(accessToken, sheetName) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  return data.values || [];
}

// ── FAQ 比對 ────────────────────────────────────────────────
function findFAQ(message, faqRows) {
  const msg = message.toLowerCase().trim();

  // 含時間詞 → 跳過 FAQ
  if (TIME_KEYWORDS.some(kw => msg.includes(kw))) return null;

  for (const row of faqRows) {
    if (!row[0] || !row[1]) continue;
    const keywords = row[0].split(',').map(k => k.trim());
    if (keywords.some(kw => msg.includes(kw.toLowerCase()))) {
      // \n 轉為真正換行
      return row[1].replace(/\\n/g, '\n');
    }
  }
  return null;
}

// ── 組建 CLINIC_KNOWLEDGE ───────────────────────────────────
function buildKnowledge(infoRows) {
  const info = {};
  for (const row of infoRows) {
    if (row[0] && row[1]) info[row[0]] = row[1];
  }

  return `
你是實康復健科診所的AI客服助理。請用親切、專業的繁體中文回答，回答要簡潔清楚。超出範圍的問題請引導來電 ${info['電話'] || '02-26292000'}。

【基本資訊】
- 名稱：${info['診所名稱'] || '實康復健科診所'}
- 地址：${info['地址'] || '新北市淡水區學府路36號2樓'}
- 電話：${info['電話'] || '02-26292000'}
- Email：${info['Email'] || 'shikang.tsrc@msa.hinet.net'}

【醫師門診表】
時段：早診${info['早診時間']} / 午診${info['午診時間']} / 晚診${info['晚診時間']}

劉盈宏醫師：${info['醫師門診_劉盈宏']}
毛琪瑛醫師：${info['醫師門診_毛琪瑛']}
江唯真醫師：${info['醫師門診_江唯真']}

${info['週六'] || '週六僅早診'}。${info['週日'] || '週日全天休診'}。

【復健治療服務時間】
- ${info['復健時間_平日']}
- ${info['復健時間_週六']}

【掛號須知】
- 初診：${info['掛號費_初診']}，複診：${info['掛號費_複診']}
- ${info['掛號方式']}
- 需攜帶健保卡；未帶者7日內補卡可退費
- ${info['物理治療次數']}

【假日休診公告】
${info['假日公告'] ? info['假日公告'].replace(/｜/g, '\n- ').replace(/^/, '- ') : '目前無特殊休診公告，依正常門診時間運作'}

【回答「今天有沒有看診」的規則】
1. 先確認現在台灣時間是星期幾、幾月幾日
2. 先查【假日休診公告】，確認今天是否休診
3. 如果今天在休診公告裡 → 回答「今天休診」並說明原因
4. 如果今天不在休診公告裡 → 查門診表回答今天門診時間
5. 永遠優先以假日休診公告為準

【重要規則】
- 嚴禁捏造任何資訊
- 未知事項請導向電話 02-26292000 詢問
- 回答長度適中，不要太冗長
`.trim();
}

// ── 寫入 QA 記錄 ────────────────────────────────────────────
async function logToSheets(accessToken, question, answer, source) {
  try {
    const twNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const timeStr = twNow.toISOString().replace('T', ' ').substring(0, 19);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/工作表1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [[timeStr, source, question, answer, '']] })
      }
    );
  } catch (err) {
    console.error('Sheets log error:', err);
  }
}

// ── 主要 Handler ────────────────────────────────────────────
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed = !origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o));
  if (!isAllowed) return res.status(403).json({ error: 'Forbidden' });

  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });

  // ── 取得 Sheets 存取權限 ──
  const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const accessToken = await getAccessToken(serviceAccount);

  // ── 同時讀取 FAQ 和診所資訊 ──
  const [faqRows, infoRows] = await Promise.all([
    readSheet(accessToken, 'FAQ'),
    readSheet(accessToken, '診所資訊')
  ]);

  // ── FAQ 比對 ──
  const faqAnswer = findFAQ(message, faqRows);
  if (faqAnswer) {
    return res.status(200).json({ reply: faqAnswer });
  }

  // ── RAG 搜尋（衛教文章）──
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const ragContext = await searchRAG(message, GEMINI_API_KEY);

  const now = new Date();
  const twTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dayName = days[twTime.getUTCDay()];
  const hour = twTime.getUTCHours();
  const minute = String(twTime.getUTCMinutes()).padStart(2, '0');
  const timeContext = `【現在時間】台灣時間 ${dayName} ${hour}:${minute}`;

  // ── 送 Gemini ──
  const clinicKnowledge = buildKnowledge(infoRows) + ragContext;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      system_instruction: { parts: [{ text: clinicKnowledge }] },
      contents: [{ role: 'user', parts: [{ text: `${timeContext}\n${message}` }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 400 }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.candidates?.[0]) {
      const rawText = result.candidates[0].content.parts[0].text;
      const text = rawText
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/#{1,6}\s/g, '')
        .replace(/`/g, '')
        .trim();

      const source = origin.includes('smartcare.com.tw') ? '官網' : '客服頁面';
      await logToSheets(accessToken, message, text, source);
      return res.status(200).json({ reply: text });
    } else {
      return res.status(200).json({ reply: '抱歉，目前系統忙碌中，請來電 02-26292000 或稍後再試。' });
    }
  } catch (error) {
    return res.status(200).json({ reply: '抱歉，系統發生錯誤，請來電 02-26292000 詢問。' });
  }
}

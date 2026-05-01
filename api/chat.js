const ALLOWED_ORIGINS = [
  'https://www.smartcare.com.tw',
  'https://smartcare.com.tw',
  'https://smartcare-chatbot.vercel.app',
  'http://smartcare-chatbot.vercel.app',
];

// ============================================================
// 內建常見問題回答（不消耗 Gemini API）
// ============================================================
const FAQ = [
  // 地址、位置
  {
    keywords: ['地址', '在哪', '哪裡', '位置', '怎麼去', '交通', '學府路'],
    answer: '診所地址：新北市淡水區學府路36號2樓。如需交通指引，歡迎來電 02-26292000 詢問。'
  },
  // 電話
  {
    keywords: ['電話', '電話號碼', '聯絡', '打電話', '連絡'],
    answer: '診所電話：02-26292000'
  },
  // 掛號費
  {
    keywords: ['掛號費', '費用', '多少錢', '收費', '初診', '複診'],
    answer: '掛號費說明：\n• 初診：300元（含部分負擔）\n• 複診：250元（含部分負擔）\n其他治療費用依病情及療程而定，歡迎來電 02-26292000 詢問。'
  },
  // 掛號方式
  {
    keywords: ['如何掛號', '怎麼掛號', '掛號方式', '網路掛號', '線上掛號', '預約'],
    answer: '掛號方式：\n• 現場掛號\n• 電話掛號：02-26292000\n\n目前無提供網路掛號，請至現場或來電掛號。'
  },
  // 健保卡
  {
    keywords: ['健保卡', '忘記帶', '沒帶'],
    answer: '看診需攜帶健保卡。若未攜帶，當次費用須先自費，於就醫日起7日內補送健保卡即可辦理退費。'
  },
  // 門診時間
  {
    keywords: ['門診時間', '看診時間', '幾點', '開診', '什麼時候', '診療時間'],
    answer: '門診時刻表：\n\n早診 09:00-12:00\n• 週一、五：劉盈宏醫師\n• 週三：毛琪瑛醫師\n• 週四：毛琪瑛醫師\n• 週六：江唯真醫師\n\n午診 14:00-17:00\n• 週一、三、五：劉盈宏醫師\n\n晚診 18:00-21:00\n• 週二：劉盈宏醫師\n• 週四：江唯真醫師\n\n週日全天及週六下午/晚上休診。'
  },
  // 復健治療時間
  {
    keywords: ['復健時間', '治療時間', '物理治療', '幾點開始', '幾點到幾點'],
    answer: '復健治療服務時間：\n• 週一至週五：08:30-21:00\n  （每週五 12:00-13:30 院內學術會議，復健服務休息）\n• 週六：08:30-16:30\n• 週日：休息'
  },
  // 物理治療次數
  {
    keywords: ['幾次', '治療次數', '30天', '期限', '重新掛號'],
    answer: '物理治療說明：\n一次門診最多可開立6次物理治療，需在30天內完成。超過時限需重新掛號看診。'
  },
  // 彼拉提斯
  {
    keywords: ['彼拉提斯', 'pilates'],
    answer: '診所提供專業彼拉提斯課程，適合復健及健身需求。課程詳情及報名請來電 02-26292000 詢問。'
  },
  // 早期療育
  {
    keywords: ['早期療育', '兒童', '發展遲緩', '自閉症', '過動', '腦性麻痺', '感覺統合', '語言治療'],
    answer: '診所提供完整的兒童早期療育服務，包含：\n• 腦性麻痺\n• 發展遲緩\n• 感覺統合異常\n• 過動兒、自閉症\n• 語言發展遲緩\n\n本診所為新北市衛生局指定「發展遲緩兒童早期醫療院所」。預約請來電 02-26292000。'
  },
  // 醫師
  {
    keywords: ['醫師', '醫生', '哪位醫師', '劉盈宏', '毛琪瑛', '江唯真'],
    answer: '診所醫師團隊（皆為復健專科醫師）：\n• 劉盈宏醫師\n• 毛琪瑛醫師\n• 江唯真醫師\n\n各醫師門診時間請參考門診時刻表，或來電 02-26292000 詢問。'
  },
  // 治療師
  {
    keywords: ['治療師', '物理治療師', '職能治療師', '語言治療師'],
    answer: '診所治療師團隊：\n• 物理治療師：9位\n• 職能治療師：3位\n• 語言治療師：2位\n\n如需預約特定治療，請來電 02-26292000。'
  },
  // 診療項目
  {
    keywords: ['診療項目', '治療項目', '什麼病', '可以治療', '服務項目'],
    answer: '診療項目包含：\n\n【肌肉關節疾患】\n肌腱炎、背痛、頸痛、五十肩、坐骨神經痛、骨刺、脊柱側彎、關節炎等\n\n【神經疾患】\n中風、外傷性腦傷、脊髓損傷、巴金森氏症、顏面神經麻痺等\n\n【早期療育】\n腦性麻痺、發展遲緩、感覺統合異常、自閉症等\n\n【其他】\n鞋墊製作、護具製作\n\n詳情歡迎來電 02-26292000 詢問。'
  },
  // 鞋墊
  {
    keywords: ['鞋墊', '扁平足', '拇指外翻', '膝痛'],
    answer: '診所提供客製化鞋墊製作服務，適合扁平足、拇指外翻、長期膝痛、習慣性腳扭傷等問題。詳情請來電 02-26292000 或至現場諮詢。'
  },
  // 護具
  {
    keywords: ['護具', '副木', '護腰'],
    answer: '診所提供客製化護具製作，包含中風患者副木、腕隧道症候群手部護具、下背痛護腰等。詳情請來電 02-26292000 諮詢。'
  },
  // 停車
  {
    keywords: ['停車', '停車場', '車位'],
    answer: '停車相關資訊請來電 02-26292000 詢問，我們將為您說明附近停車選擇。'
  },
  // Email
  {
    keywords: ['email', 'e-mail', '電子郵件', 'mail'],
    answer: '診所 Email：shikang.tsrc@msa.hinet.net'
  },
  // 看診進度
  {
    keywords: ['看診進度', '等待', '候診', '幾號', '排隊'],
    answer: '您可以透過網路查詢看診進度：\nhttps://www.mainpi.com/query?i=3700\n\n或來電 02-26292000 詢問目前候診狀況。'
  },
  // 課程
  {
    keywords: ['課程', '團體班', '瑜珈', '中風', '核心', '脊柱側彎'],
    answer: '診所專業課程包含：\n• 彼拉提斯\n• 治療性瑜珈\n• 中風復健團體\n• 肩頸痠痛教室\n• 核心復健教室\n• 下肢運動訓練\n• 脊柱側彎矯正運動\n• 兒童感覺統合訓練\n• 親子繪本/語言溝通\n\n課程報名及時間請來電 02-26292000 詢問。'
  },
  // 打招呼
  {
    keywords: ['你好', '哈囉', 'hello', 'hi', '嗨', '您好'],
    answer: '您好！我是實康復健科診所的 AI 客服助理，可以回答門診時間、掛號方式、診療項目等問題。請問有什麼可以幫您的嗎？'
  },
  // 謝謝
  {
    keywords: ['謝謝', '感謝', '辛苦了', 'thank'],
    answer: '不客氣！如還有其他問題歡迎繼續詢問，或來電 02-26292000，我們很樂意為您服務。'
  }
];

// 比對關鍵字函式
function findFAQ(message) {
  const msg = message.toLowerCase().trim();
  for (const item of FAQ) {
    for (const keyword of item.keywords) {
      if (msg.includes(keyword.toLowerCase())) {
        return item.answer;
      }
    }
  }
  return null;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed = !origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o));

  if (!isAllowed) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }

  // 先嘗試內建 FAQ 回答
  const faqAnswer = findFAQ(message);
  if (faqAnswer) {
    return res.status(200).json({ reply: faqAnswer });
  }

  // FAQ 找不到才呼叫 Gemini
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  const now = new Date();
  const twTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dayName = days[twTime.getUTCDay()];
  const hour = twTime.getUTCHours();
  const minute = String(twTime.getUTCMinutes()).padStart(2, '0');
  const timeContext = `【現在時間】台灣時間 ${dayName} ${hour}:${minute}`;

  const CLINIC_KNOWLEDGE = `
你是實康復健科診所的AI客服助理。請用親切、專業的繁體中文回答，回答要簡潔清楚。超出範圍的問題請引導來電 02-26292000。

【基本資訊】
- 名稱：實康復健科診所
- 地址：新北市淡水區學府路36號2樓
- 電話：02-26292000
- Email：shikang.tsrc@msa.hinet.net

【醫師門診表】（早:09-12, 午:14-17, 晚:18-21）
| 醫師 | 週一 | 週二 | 週三 | 週四 | 週五 | 週六 |
| 劉盈宏 | 早/午 | 晚 | 午 | - | 早/午 | - |
| 毛琪瑛 | - | - | 早 | 早 | - | - |
| 江唯真 | - | - | - | 晚 | - | 早 |
週日全天及週六下午/晚上休診。

【復健治療服務時間】
- 週一至週五：08:30-21:00（每週五12:00-13:30復健服務休息）
- 週六：08:30-16:30

【掛號須知】
- 初診：300元，複診：250元
- 僅限現場或電話掛號，無網路掛號
- 需攜帶健保卡；未帶者7日內補卡可退費
- 物理治療1次門診最多6次，需30天內完成

【假日休診公告】
- 如目前無特殊休診公告，依正常門診時間運作

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
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
      system_instruction: { parts: [{ text: CLINIC_KNOWLEDGE }] },
      contents: [{ role: 'user', parts: [{ text: timeContext + '\n' + message }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 400 }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.candidates && result.candidates[0]) {
      const text = result.candidates[0].content.parts[0].text;
      return res.status(200).json({ reply: text.trim() });
    } else {
      return res.status(200).json({ reply: '抱歉，目前系統忙碌中，請來電 02-26292000 或稍後再試。' });
    }
  } catch (error) {
    return res.status(200).json({ reply: '抱歉，系統發生錯誤，請來電 02-26292000 詢問。' });
  }
}

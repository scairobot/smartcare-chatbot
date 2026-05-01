export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
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

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  // 取得台灣時間
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
- 網站：www.smartcare.com.tw

【醫師門診表】（早:09-12, 午:14-17, 晚:18-21）
| 醫師 | 週一 | 週二 | 週三 | 週四 | 週五 | 週六 |
| 劉盈宏 | 早/午 | 晚 | 午 | - | 早/午 | - |
| 毛琪瑛 | - | - | 早 | 早 | - | - |
| 江唯真 | - | - | 晚 | - | - | 早 |
週日全天及週六下午/晚上休診。

【復健治療服務時間】
- 週一至週五：08:30-21:00（每週五12:00-13:30院內學術會議，復健服務休息）
- 週六：08:30-16:30

【掛號須知】
- 初診掛號費：300元（含部分負擔）
- 複診掛號費：250元（含部分負擔）
- 僅限現場或電話（02-26292000）掛號，無網路掛號
- 需攜帶健保卡；未帶者先自費，7日內補卡可退費
- 物理治療1次門診最多6次，需在30天內完成，超過需重新掛號

【診療項目】
- 肌肉關節疾患：肌腱炎、背痛、頸痛、五十肩、坐骨神經痛、骨刺、脊柱側彎、關節炎、骨折後遺症等
- 神經疾患：中風、外傷性腦傷、脊髓損傷、巴金森氏症、顏面神經麻痺等
- 早期療育：腦性麻痺、發展遲緩、感覺統合異常、過動兒、自閉症、學習障礙等
- 鞋墊製作：扁平足、拇指外翻、長期膝痛等
- 護具製作：中風患者副木、護腰等

【專業課程】
彼拉提斯、治療性瑜珈、中風復健團體、肩頸痠痛教室、核心復健教室、下肢運動訓練、脊柱側彎矯正、兒童感覺統合、兒童動作認知發展、親子繪本、親子語言溝通

【醫療團隊】
- 醫師：劉盈宏、毛琪瑛、江唯真（皆為復健專科醫師）
- 治療師：物理治療師9位、職能治療師3位、語言治療師2位

【費用說明】
具體費用依病情及療程而有所不同，建議來電 02-26292000 或至現場詢問。

【重要規則】
- 嚴禁捏造任何資訊
- 未知事項請導向電話詢問
- 回答長度適中，不要太冗長
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
      system_instruction: {
        parts: [{ text: CLINIC_KNOWLEDGE }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: timeContext + '\n' + message }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 400
      }
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

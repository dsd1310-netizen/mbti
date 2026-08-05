/**
 * Gemini API 서버리스 프록시 (Vercel Function).
 * Gemini API 키를 클라이언트 번들에 절대 포함시키지 않기 위해, 클라이언트는
 * 이 엔드포인트로만 요청을 보내고, 실제 키는 서버 환경변수(GEMINI_API_KEY,
 * VITE_ 접두어 없음 — Vite가 클라이언트 번들에 넣지 않도록)에서만 읽는다.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '서버에 GEMINI_API_KEY가 설정되지 않았습니다.' });
    return;
  }

  const modelParam = req.query?.model;
  const model = typeof modelParam === 'string' ? modelParam : Array.isArray(modelParam) ? modelParam[0] : '';
  if (!model) {
    res.status(400).json({ error: 'model 쿼리 파라미터가 필요합니다.' });
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message ?? 'Gemini 프록시 요청 실패' });
  }
}

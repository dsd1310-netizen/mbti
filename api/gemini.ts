/**
 * Gemini API 서버리스 프록시 (Vercel Function).
 * Gemini API 키를 클라이언트 번들에 절대 포함시키지 않기 위해, 클라이언트는
 * 이 엔드포인트로만 요청을 보내고, 실제 키는 서버 환경변수(GEMINI_API_KEY,
 * VITE_ 접두어 없음 — Vite가 클라이언트 번들에 넣지 않도록)에서만 읽는다.
 *
 * 이 엔드포인트는 로그인 없이도 쓰는 앱 특성상 인증을 요구하지 않으므로,
 * 무분별한 오남용(다른 모델 호출, 다른 출처에서의 스크립트성 대량 호출)을
 * 최소한으로 막기 위해 (1) 모델명 화이트리스트, (2) 같은 출처(Origin) 검사,
 * (3) IP별 하루 250회 요청 제한을 둔다. 완벽한 보호는 아니지만(Origin 헤더는
 * 스푸핑 가능), 트래픽의 절대다수를 차지하는 "브라우저가 아닌 스크립트로 직접
 * 두드리는" 시도와 "무한정 반복 호출"은 걸러낸다.
 */
import { checkAndConsumeRateLimit, extractClientIp } from './_rateLimit';

// src/utils/geminiApi.ts의 MODELS와 반드시 동일하게 유지 — 이 파일은 별도로 번들되는
// Vercel 서버리스 함수라 그 파일을 직접 import하지 않는다(불필요한 클라이언트 코드까지
// 끌려오는 것을 피하기 위함).
const ALLOWED_MODELS = new Set([
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const origin = req.headers?.origin;
  const expectedOrigin = req.headers?.host ? `https://${req.headers.host}` : null;
  if (!origin || !expectedOrigin || origin !== expectedOrigin) {
    res.status(403).json({ error: '허용되지 않은 요청입니다.' });
    return;
  }

  // 개발자 전용 우회 키 — 클라이언트 코드에는 절대 값을 심지 않고, 브라우저
  // localStorage에 직접 설정한 값만 헤더로 실려 온다(코드만 봐서는 값을 알 수 없음).
  const devKey = req.headers?.['x-dev-key'];
  const isDevBypass = Boolean(process.env.DEV_BYPASS_KEY) && devKey === process.env.DEV_BYPASS_KEY;

  if (!isDevBypass) {
    const ip = extractClientIp(req);
    const allowed = await checkAndConsumeRateLimit(ip);
    if (!allowed) {
      res.status(429).json({ error: '오늘 요청 가능한 횟수를 모두 사용했습니다. 내일 다시 시도해 주세요.' });
      return;
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '서버에 GEMINI_API_KEY가 설정되지 않았습니다.' });
    return;
  }

  const modelParam = req.query?.model;
  const model = typeof modelParam === 'string' ? modelParam : Array.isArray(modelParam) ? modelParam[0] : '';
  if (!ALLOWED_MODELS.has(model)) {
    res.status(400).json({ error: '허용되지 않은 model 파라미터입니다.' });
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

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

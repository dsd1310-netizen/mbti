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

// 네이티브 앱(Capacitor) 웹뷰는 capacitor://localhost(iOS) 등 로컬 오리진에서 로드되어
// 배포 도메인과 Origin이 다르므로 별도로 허용한다. Origin 검사는 원래도 스푸핑 가능한
// 최소 방어선이라(실질 방어는 IP별 하루 250회 제한) 이 허용리스트 추가로 보안 수준이
// 유의미하게 낮아지지는 않는다.
const NATIVE_ORIGINS = new Set(['capacitor://localhost', 'https://localhost', 'http://localhost']);

// 이 프록시 자체가 반환하는 에러는 업스트림 Gemini 에러 응답 형태({ error: { message } })와
// 동일한 모양으로 맞춘다 — 클라이언트(geminiApi.ts)가 항상 err.error.message로 메시지를 꺼내는데,
// 예전엔 이 파일이 { error: "문자열" } 형태(중첩 없음)로 응답해서 err.error.message가 항상
// undefined가 되어 "오늘 요청 횟수를 다 썼습니다" 같은 실제 안내 문구 대신 뭉뚱그린
// "API 오류 (403)" 류 메시지만 사용자에게 보였음.
function errorBody(message: string, code?: string) {
  return { error: { message, code } };
}

export default async function handler(req: any, res: any) {
  // [2026-08-06] 최상위 try/catch — 이 안의 어떤 예외든 여기서 잡히지 않으면 Vercel이
  // "FUNCTION_INVOCATION_FAILED"라는 순수 텍스트(JSON 아님) 500 페이지를 대신 반환한다.
  // 실제로 겪은 장애: checkAndConsumeRateLimit()가 예외를 던졌을 때 이 안전망이 없어서
  // 클라이언트가 매번 이 크래시 페이지를 받았고, JSON이 아니라 파싱이 실패해 결국 "API 오류
  // (500)"라는 뭉뚱그린 메시지로만 보였음(실제 원인은 서버 로그에도 남지 않아 진단이 어려웠음).
  // 이 안전망 이후로는 예상치 못한 예외도 최소한 errorBody() 형태의 JSON으로 응답하고
  // console.error로 Vercel 함수 로그에 실제 원인이 남는다.
  try {
    if (req.method !== 'POST') {
      res.status(405).json(errorBody('Method not allowed'));
      return;
    }

    const origin = req.headers?.origin;
    const expectedOrigin = req.headers?.host ? `https://${req.headers.host}` : null;
    const isAllowedOrigin = Boolean(origin) && (origin === expectedOrigin || NATIVE_ORIGINS.has(origin));
    if (!isAllowedOrigin) {
      res.status(403).json(errorBody('허용되지 않은 요청입니다.'));
      return;
    }

    // model 파라미터 검증은 rate limit 소비보다 먼저 — 잘못된 model로 오는 요청이
    // 하루 250회 할당량을 갉아먹지 않도록 함.
    const modelParam = req.query?.model;
    const model = typeof modelParam === 'string' ? modelParam : Array.isArray(modelParam) ? modelParam[0] : '';
    if (!ALLOWED_MODELS.has(model)) {
      res.status(400).json(errorBody('허용되지 않은 model 파라미터입니다.'));
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
        res.status(429).json(errorBody('오늘 요청 가능한 횟수를 모두 사용했습니다. 내일 다시 시도해 주세요.'));
        return;
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // code: 'CONFIG_MISSING' — 클라이언트가 이 코드를 보면 (업스트림 과부하와 달리) 재시도해도
      // 절대 성공할 수 없는 서버 설정 오류임을 알고 즉시 실패 처리하도록 함(geminiApi.ts 참고).
      res.status(500).json(errorBody('서버에 GEMINI_API_KEY가 설정되지 않았습니다.', 'CONFIG_MISSING'));
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
      res.status(502).json(errorBody(err?.message ?? 'Gemini 프록시 요청 실패'));
    }
  } catch (err: any) {
    console.error('[api/gemini] 처리되지 않은 예외:', err);
    if (!res.headersSent) {
      res.status(500).json(errorBody(err?.message ?? '서버에서 처리되지 않은 오류가 발생했습니다.'));
    }
  }
}

/**
 * IP별 하루 요청 횟수 제한 (api/gemini.ts 전용 헬퍼).
 * Firebase Admin SDK로 Firestore에 직접 접근 — 클라이언트 SDK와 달리 보안 규칙을
 * 우회하는 관리자 권한이라, 아무나 자기 카운트를 조작할 수 없다.
 * 파일명이 `_`로 시작해 Vercel이 이 파일 자체를 별도 엔드포인트로 노출하지 않는다.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'crypto';

const DAILY_LIMIT = 250;

// [2026-08-06] 이 함수 내부(JSON.parse/cert/initializeApp)가 예전엔 try/catch 없이 호출되어,
// FIREBASE_SERVICE_ACCOUNT_KEY 환경변수가 설정되어 있지만 값이 조금이라도 잘못되어 있으면
// (Vercel 환경변수에 JSON을 붙여넣을 때 흔한 개행/따옴표 이스케이프 문제 등) 예외가 그대로
// 던져져 api/gemini.ts 핸들러 전체가 처리 안 된 예외로 죽어(Vercel이 FUNCTION_INVOCATION_FAILED
// 플레인 텍스트 페이지를 반환) AI 기능 전체가 매번 실패하는 원인이었을 가능성이 높음 — 아래에서
// try/catch로 감싸 "키 미설정"과 마찬가지로 fail-open(rate limit 없이 통과) 처리하도록 수정.
function getAdminDb() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null; // 서비스 계정 키 미설정 시 rate limit 없이 통과(fail-open) — 서비스 중단보다 낫다.
  try {
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(JSON.parse(raw)) });
    // 이 프로젝트의 Firestore 데이터베이스 ID가 (신형 Enterprise 에디션이라) 관용적인
    // "(default)" 센티널이 아니라 문자 그대로 "default"로 되어 있어, 명시적으로 지정해야 한다.
    return getFirestore(app, 'default');
  } catch (err) {
    console.error('[rateLimit] Firebase Admin 초기화 실패 — FIREBASE_SERVICE_ACCOUNT_KEY 값을 확인하세요:', err);
    return null;
  }
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

/**
 * IP 원문을 요청 헤더에서 뽑아낸다.
 * [2026-08-06 확인] Vercel 공식 문서(vercel.com/docs/headers/request-headers)에 따르면
 * Vercel은 이 헤더를 자체적으로 덮어써서 실제 클라이언트 공인 IP만 실어 보내고, 클라이언트가
 * 보낸 x-forwarded-for 값은 그대로 통과시키지 않는다("does not forward external IPs") —
 * 즉 스푸핑으로 하루 250회 제한을 우회하는 시나리오는 (커스텀 신뢰 프록시를 쓰는 엔터프라이즈
 * 요금제가 아닌 이상) 이 프로젝트에는 해당하지 않는다. `x-real-ip`/`x-vercel-forwarded-for`도
 * 문서상 동일한 값의 별칭이라 바꿔 써도 차이가 없어, 기존 `split(',')[0]` 로직은 그대로 둠.
 */
export function extractClientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const first = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : Array.isArray(forwarded) ? forwarded[0] : '';
  return first || req.socket?.remoteAddress || 'unknown';
}

/**
 * 오늘(UTC 기준) 해당 IP가 이미 DAILY_LIMIT회를 다 썼으면 false, 아니면 카운트를 1 늘리고 true.
 * Firestore 접근 자체가 실패(권한 오류, 네트워크 문제 등)하는 경우도 fail-open — rate limit
 * 인프라 문제로 AI 기능 전체가 죽는 것보다는, 그날 제한이 느슨해지는 편이 낫다.
 */
export async function checkAndConsumeRateLimit(ip: string): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return true;

  try {
    const docRef = db.collection('rateLimits').doc(hashIp(ip));
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const data = snap.data();

      if (!data || data.date !== today) {
        tx.set(docRef, { date: today, count: 1 });
        return true;
      }
      if (data.count >= DAILY_LIMIT) {
        return false;
      }
      tx.update(docRef, { count: FieldValue.increment(1) });
      return true;
    });
  } catch (err) {
    console.error('[rateLimit] Firestore 접근 실패, rate limit 없이 통과시킴:', err);
    return true;
  }
}

/**
 * Firebase Admin SDK 공용 초기화 (api/_rateLimit.ts, api/_credits.ts 등에서 공유).
 * 파일명이 `_`로 시작해 Vercel이 이 파일 자체를 별도 엔드포인트로 노출하지 않는다.
 */
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

// [2026-08-06] 이 함수 내부(JSON.parse/cert/initializeApp)가 예전엔 try/catch 없이 호출되어,
// FIREBASE_SERVICE_ACCOUNT_KEY 환경변수가 설정되어 있지만 값이 조금이라도 잘못되어 있으면
// (Vercel 환경변수에 JSON을 붙여넣을 때 흔한 개행/따옴표 이스케이프 문제 등) 예외가 그대로
// 던져져 호출부 핸들러 전체가 처리 안 된 예외로 죽는(Vercel이 FUNCTION_INVOCATION_FAILED
// 플레인 텍스트 페이지를 반환) 원인이었을 가능성이 높음 — try/catch로 감싸 null을 반환한다.
// null일 때 호출부가 fail-open(레이트리밋)할지 fail-closed(크레딧 차감)할지는 각자 결정한다.
function getAdminApp(): App | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    return getApps().length ? getApps()[0] : initializeApp({ credential: cert(JSON.parse(raw)) });
  } catch (err) {
    console.error('[firebaseAdmin] 초기화 실패 — FIREBASE_SERVICE_ACCOUNT_KEY 값을 확인하세요:', err);
    return null;
  }
}

export function getAdminDb(): Firestore | null {
  const app = getAdminApp();
  if (!app) return null;
  // 이 프로젝트의 Firestore 데이터베이스 ID가 (신형 Enterprise 에디션이라) 관용적인
  // "(default)" 센티널이 아니라 문자 그대로 "default"로 되어 있어, 명시적으로 지정해야 한다.
  return getFirestore(app, 'default');
}

// [2026-08-22] firebase-admin/auth를 이 파일 최상단에서 정적 import하면, Auth를 전혀
// 쓰지 않는 api/gemini.ts(→ api/_rateLimit.ts → 이 파일, getAdminDb()만 사용)까지도 그
// 서브모듈이 물고 오는 jwks-rsa(→ ESM 전용 jose 패키지를 require()하려다 크래시,
// ERR_REQUIRE_ESM)를 함께 불러와 매 요청마다 FUNCTION_INVOCATION_FAILED로 죽는 실사용
// 장애가 있었음. Auth가 실제로 필요한 곳(api/_credits.ts)만 이 하위 모듈을 불러오도록
// require()를 함수 안으로 미뤄, Auth를 안 쓰는 함수는 이 문제를 아예 겪지 않게 함.
export function getAdminAuth(): Auth | null {
  const app = getAdminApp();
  if (!app) return null;
  const { getAuth } = require('firebase-admin/auth');
  return getAuth(app);
}

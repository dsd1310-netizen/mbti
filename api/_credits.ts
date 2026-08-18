/**
 * 로그인 사용자의 심화해석 크레딧 조회/차감 (api/gemini-deep.ts, api/credits.ts 전용 헬퍼).
 * api/_rateLimit.ts(레이트리밋)와 달리 이건 유료 콘텐츠를 지키는 게이트라 **fail-closed**로
 * 간다 — Firebase Admin 설정이 잘못됐거나 Firestore 접근이 실패하면 통과시키지 않는다
 * (레이트리밋이 fail-open인 이유였던 "서비스 중단보다 낫다"는 여기엔 반대로 적용됨: 인프라
 * 오류로 크레딧 차감 없이 유료 콘텐츠가 새 나가는 게 더 나쁘다).
 * 파일명이 `_`로 시작해 Vercel이 이 파일 자체를 별도 엔드포인트로 노출하지 않는다.
 */
import { getAdminDb, getAdminAuth } from './_firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const FREE_TRIAL_CREDITS = 3;

/** Authorization: Bearer <idToken> 헤더를 검증해 uid를 반환. 실패하면 null. */
export async function verifyIdToken(req: any): Promise<string | null> {
  const authHeader = req.headers?.authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;
  if (!token) return null;

  const auth = getAdminAuth();
  if (!auth) return null;

  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch (err) {
    console.error('[credits] ID 토큰 검증 실패:', err);
    return null;
  }
}

export type CreditCheckResult =
  | { ok: true; remaining: number }
  | { ok: false; reason: 'NO_CREDITS' | 'INFRA_ERROR' };

/**
 * uid의 크레딧을 확인하고 1개 차감한다(문서가 없으면 무료체험 3개를 먼저 지급한 뒤 그 중
 * 1개를 차감 — 최초 호출이 곧 첫 사용이 되는 자연스러운 흐름). 트랜잭션이라 동시 요청에도
 * 안전하다.
 */
export async function checkAndConsumeCredit(uid: string): Promise<CreditCheckResult> {
  const db = getAdminDb();
  if (!db) return { ok: false, reason: 'INFRA_ERROR' };

  try {
    const docRef = db.collection('users').doc(uid);
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const data = snap.data();

      const currentCredits = typeof data?.credits === 'number' ? data.credits : FREE_TRIAL_CREDITS;
      if (currentCredits <= 0) {
        return { ok: false, reason: 'NO_CREDITS' } as const;
      }

      const remaining = currentCredits - 1;
      if (snap.exists) {
        tx.update(docRef, { credits: remaining });
      } else {
        tx.set(docRef, { credits: remaining, freeTrialGranted: true }, { merge: true });
      }
      return { ok: true, remaining } as const;
    });
  } catch (err) {
    console.error('[credits] Firestore 접근 실패 — fail-closed로 차단:', err);
    return { ok: false, reason: 'INFRA_ERROR' };
  }
}

/** 잔액만 조회(차감 없음). 문서가 아직 없으면 무료체험 지급 예정 수량을 그대로 보여준다. */
export async function getCreditBalance(uid: string): Promise<number | null> {
  const db = getAdminDb();
  if (!db) return null;

  try {
    const snap = await db.collection('users').doc(uid).get();
    const data = snap.data();
    return typeof data?.credits === 'number' ? data.credits : FREE_TRIAL_CREDITS;
  } catch (err) {
    console.error('[credits] 잔액 조회 실패:', err);
    return null;
  }
}

/** RevenueCat/토스 결제 확정 시 크레딧을 더한다(문서 없으면 무료체험 + 구매분으로 새로 생성). */
export async function grantCredits(uid: string, amount: number): Promise<void> {
  const db = getAdminDb();
  if (!db) throw new Error('Firestore Admin이 초기화되지 않았습니다.');

  const docRef = db.collection('users').doc(uid);
  const snap = await docRef.get();
  if (snap.exists) {
    await docRef.update({ credits: FieldValue.increment(amount) });
  } else {
    await docRef.set({ credits: FREE_TRIAL_CREDITS + amount, freeTrialGranted: true }, { merge: true });
  }
}

/**
 * RevenueCat 구매완료 웹훅 수신 (네이티브 iOS/Android 인앱결제).
 * RevenueCat 대시보드에서 이 URL을 웹훅으로 등록하고, "Authorization header value"를
 * REVENUECAT_WEBHOOK_SECRET과 동일하게 설정해야 한다(2단계: 사용자가 직접 콘솔에서 설정).
 * RevenueCat 클라이언트 SDK를 초기화할 때 appUserID를 Firebase uid로 지정해두므로
 * (src/utils/purchases.ts), 여기 오는 app_user_id가 곧 우리 Firestore users/{uid}다.
 */
import { errorBody } from './_errorBody';
import { getAdminDb } from './_firebaseAdmin';
import { grantCredits } from './_credits';
import { REVENUECAT_PRODUCT_CREDITS } from './_creditProducts';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json(errorBody('Method not allowed'));
      return;
    }

    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    const authHeader = req.headers?.authorization;
    if (!secret || authHeader !== secret) {
      res.status(401).json(errorBody('허용되지 않은 요청입니다.'));
      return;
    }

    const event = req.body?.event;
    const eventId: string | undefined = event?.id;
    const uid: string | undefined = event?.app_user_id;
    const productId: string | undefined = event?.product_id;
    const eventType: string | undefined = event?.type;

    // 구매/갱신류 이벤트만 크레딧을 지급한다(취소·환불·만료 등은 소모성 크레딧 특성상
    // 이미 쓴 크레딧을 되돌리지 않음 — 구독이 아니라 소모품이라 환불 시엔 별도 CS로 처리).
    const CREDIT_GRANTING_EVENTS = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL']);
    if (!eventType || !CREDIT_GRANTING_EVENTS.has(eventType) || !uid || !productId || !eventId) {
      res.status(200).json({ received: true, skipped: true });
      return;
    }

    const credits = REVENUECAT_PRODUCT_CREDITS[productId];
    if (!credits) {
      console.error('[revenuecat-webhook] 알 수 없는 product_id:', productId);
      res.status(200).json({ received: true, skipped: true });
      return;
    }

    const db = getAdminDb();
    if (!db) {
      res.status(500).json(errorBody('서버 설정 오류입니다.'));
      return;
    }

    // 웹훅은 중복 전송될 수 있어(RevenueCat 공식 안내) 같은 이벤트를 두 번 지급하지 않도록
    // 이벤트 ID로 멱등성을 보장한다.
    const eventDocRef = db.collection('processedWebhookEvents').doc(eventId);
    const alreadyProcessed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(eventDocRef);
      if (snap.exists) return true;
      tx.set(eventDocRef, { processedAt: new Date().toISOString(), source: 'revenuecat' });
      return false;
    });

    if (!alreadyProcessed) {
      await grantCredits(uid, credits);
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[api/revenuecat-webhook] 처리되지 않은 예외:', err);
    if (!res.headersSent) {
      res.status(500).json(errorBody(err?.message ?? '서버에서 처리되지 않은 오류가 발생했습니다.'));
    }
  }
}

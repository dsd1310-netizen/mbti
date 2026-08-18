/**
 * 토스페이먼츠 결제 승인 (웹 전용 — 앱스토어/플레이스토어 IAP는 브라우저에서 쓸 수 없어
 * RevenueCat과 별도 경로로 둔다). 클라이언트가 결제위젯 완료 후 이 엔드포인트에
 * paymentKey/orderId/amount를 보내면, 서버가 토스 결제승인 API를 직접 호출해 확정하고
 * (금액 위조 방지를 위해 서버가 최종 승인 응답의 금액을 다시 검증), 그 금액에 해당하는
 * 크레딧을 지급한다.
 */
import { errorBody } from './_errorBody';
import { getAdminDb } from './_firebaseAdmin';
import { verifyIdToken, grantCredits } from './_credits';
import { TOSS_AMOUNT_TO_CREDITS } from './_creditProducts';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json(errorBody('Method not allowed'));
      return;
    }

    const uid = await verifyIdToken(req);
    if (!uid) {
      res.status(401).json(errorBody('로그인이 필요해요.', 'LOGIN_REQUIRED'));
      return;
    }

    const { paymentKey, orderId, amount } = req.body ?? {};
    if (typeof paymentKey !== 'string' || typeof orderId !== 'string' || typeof amount !== 'number') {
      res.status(400).json(errorBody('결제 정보가 올바르지 않습니다.'));
      return;
    }

    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      res.status(500).json(errorBody('서버에 TOSS_SECRET_KEY가 설정되지 않았습니다.', 'CONFIG_MISSING'));
      return;
    }

    const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
    const upstream = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json(errorBody(data?.message ?? '결제 승인에 실패했습니다.'));
      return;
    }

    // 클라이언트가 보낸 amount가 아니라, 토스가 실제로 승인 처리한 금액을 신뢰한다.
    const approvedAmount: number = data?.totalAmount ?? amount;
    const credits = TOSS_AMOUNT_TO_CREDITS[approvedAmount];
    if (!credits) {
      console.error('[toss-confirm] 알 수 없는 결제 금액:', approvedAmount);
      res.status(400).json(errorBody('알 수 없는 상품 금액입니다.'));
      return;
    }

    const db = getAdminDb();
    if (!db) {
      res.status(500).json(errorBody('서버 설정 오류입니다.'));
      return;
    }

    // orderId 기준으로 멱등성 보장 — 같은 결제를 두 번 확정 요청해도 크레딧이 중복 지급되지 않도록.
    const eventDocRef = db.collection('processedWebhookEvents').doc(`toss_${orderId}`);
    const alreadyProcessed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(eventDocRef);
      if (snap.exists) return true;
      tx.set(eventDocRef, { processedAt: new Date().toISOString(), source: 'toss', uid });
      return false;
    });

    if (!alreadyProcessed) {
      await grantCredits(uid, credits);
    }

    res.status(200).json({ ok: true, credits });
  } catch (err: any) {
    console.error('[api/toss-confirm] 처리되지 않은 예외:', err);
    if (!res.headersSent) {
      res.status(500).json(errorBody(err?.message ?? '서버에서 처리되지 않은 오류가 발생했습니다.'));
    }
  }
}

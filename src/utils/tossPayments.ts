/**
 * 웹(Vercel) 전용 결제 — 토스페이먼츠. 네이티브 앱에서는 대신 RevenueCat(purchases.ts)을 쓴다.
 * 토스 결제창(redirect 방식)을 쓴다 — 사용자가 카드 결제 후 successUrl로 돌아오면, 그 URL의
 * paymentKey/orderId/amount를 App.tsx가 읽어 api/toss-confirm.ts에 넘겨 최종 승인한다
 * (금액은 서버가 토스 응답으로 재검증하므로 URL 파라미터를 그대로 신뢰하지 않음).
 *
 * 2단계(사용자가 직접 해야 함): 토스페이먼츠 가맹점 가입·심사 통과 후 발급되는 클라이언트 키를
 * VITE_TOSS_CLIENT_KEY, 시크릿 키를 서버 환경변수 TOSS_SECRET_KEY(api/toss-confirm.ts)에 등록.
 */
import { DEPLOY_ORIGIN } from '../deployConfig';

export interface CreditPriceOption {
  amount: number;
  credits: number;
  label: string;
}

// api/_creditProducts.ts의 TOSS_AMOUNT_TO_CREDITS와 반드시 동일하게 유지.
export const CREDIT_PRICE_OPTIONS: CreditPriceOption[] = [
  { amount: 990, credits: 1, label: '1개 — 990원' },
  { amount: 2900, credits: 5, label: '5개 — 2,900원 (개당 580원)' },
  { amount: 6900, credits: 15, label: '15개 — 6,900원 (개당 460원)' },
  { amount: 9900, credits: 30, label: '30개 — 9,900원 (개당 330원)' },
];

export function isTossConfigured(): boolean {
  return Boolean(import.meta.env.VITE_TOSS_CLIENT_KEY);
}

/** 토스 결제창으로 이동(현재 페이지를 벗어남) — 결제 후 다시 이 앱의 origin으로 돌아온다. */
export async function requestTossPayment(option: CreditPriceOption): Promise<void> {
  const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY;
  if (!clientKey) throw new Error('결제 준비 중이에요. 잠시 후 다시 시도해 주세요.');

  // "결제창"(API 개별 연동 키) 방식 — 위젯 UI를 따로 마운트할 필요 없이 카드 결제창으로 바로 이동.
  const { loadTossPayments, ANONYMOUS } = await import('@tosspayments/tosspayments-sdk');
  const tossPayments = await loadTossPayments(clientKey);
  const payment = tossPayments.payment({ customerKey: ANONYMOUS });
  const orderId = `napuli_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const origin = window.location.origin || DEPLOY_ORIGIN;

  await payment.requestPayment({
    method: 'CARD',
    amount: { currency: 'KRW', value: option.amount },
    orderId,
    orderName: `나풀이 심화해석 크레딧 ${option.credits}개`,
    successUrl: `${origin}${window.location.pathname}?tossSuccess=1`,
    failUrl: `${origin}${window.location.pathname}?tossFail=1`,
  });
}

/** 결제 후 successUrl로 돌아왔을 때 URL에서 승인에 필요한 파라미터를 읽는다. */
export function readTossReturnParams(): { paymentKey: string; orderId: string; amount: number } | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get('tossSuccess') !== '1') return null;
  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  const amount = Number(params.get('amount'));
  if (!paymentKey || !orderId || !amount) return null;
  return { paymentKey, orderId, amount };
}

/** 결제 완료/실패 후 남은 토스 쿼리 파라미터를 URL에서 제거(새로고침해도 중복 처리 안 되도록). */
export function clearTossReturnParams(): void {
  const url = new URL(window.location.href);
  ['tossSuccess', 'tossFail', 'paymentKey', 'orderId', 'amount'].forEach(k => url.searchParams.delete(k));
  window.history.replaceState({}, '', url.toString());
}

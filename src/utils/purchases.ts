/**
 * 네이티브 인앱결제(RevenueCat) — 네이티브 앱(iOS/Android)에서만 동작.
 * appReview.ts와 동일한 패턴: isNativePlatform() 가드 + 지연 import로 웹 번들에서 제외.
 * 웹(Vercel)에서는 토스페이먼츠(src/utils/tossPayments.ts)를 대신 쓴다.
 *
 * RevenueCat의 appUserID를 Firebase uid로 지정해둬(initPurchases), 서버(api/revenuecat-webhook.ts)가
 * 받는 웹훅의 app_user_id가 곧 Firestore users/{uid}가 되도록 한다 — 별도 매핑 테이블 불필요.
 *
 * 2단계(사용자가 직접 해야 함): RevenueCat 계정 생성 + iOS/Android 앱 등록 + 상품(napuli_credits_5/15/30,
 * api/_creditProducts.ts와 이름 일치) 등록 + 웹훅 URL(api/revenuecat-webhook.ts)·시크릿 설정 후,
 * 발급된 공개 SDK 키를 VITE_REVENUECAT_IOS_KEY / VITE_REVENUECAT_ANDROID_KEY에 등록.
 */
import { Capacitor } from '@capacitor/core';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

function currentPlatformApiKey(): string | null {
  const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
  const key = platform === 'ios'
    ? import.meta.env.VITE_REVENUECAT_IOS_KEY
    : platform === 'android'
      ? import.meta.env.VITE_REVENUECAT_ANDROID_KEY
      : undefined;
  return key || null;
}

let configuredForUid: string | null = null;

/** 로그인 상태가 바뀔 때마다 호출 — RevenueCat의 사용자 식별자를 Firebase uid로 맞춘다. */
export async function initPurchases(uid: string): Promise<void> {
  if (!isNativePlatform() || configuredForUid === uid) return;
  const apiKey = currentPlatformApiKey();
  if (!apiKey) return; // 아직 2단계(콘솔 설정)가 안 끝난 상태 — 조용히 건너뜀

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    await Purchases.configure({ apiKey, appUserID: uid });
    configuredForUid = uid;
  } catch (err) {
    console.error('[purchases] RevenueCat 초기화 실패:', err);
  }
}

export interface CreditPackage {
  identifier: string;
  productId: string;
  priceString: string;
}

/** 구매 가능한 크레딧 상품 목록. 콘솔 설정 전이거나 오류 시 빈 배열. */
export async function getCreditPackages(): Promise<CreditPackage[]> {
  if (!isNativePlatform()) return [];
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return [];
    return current.availablePackages.map((pkg: any) => ({
      identifier: pkg.identifier,
      productId: pkg.product.identifier,
      priceString: pkg.product.priceString,
    }));
  } catch (err) {
    console.error('[purchases] 상품 목록 조회 실패:', err);
    return [];
  }
}

/**
 * 상품 구매. 성공하면 true — 단, 크레딧 반영은 RevenueCat 웹훅(api/revenuecat-webhook.ts)이
 * 비동기로 처리하므로, 호출부가 잠깐 뒤 잔액을 다시 조회(fetchCreditBalance)해야 화면에 반영된다.
 */
export async function purchaseCreditPackage(identifier: string): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find((p: any) => p.identifier === identifier);
    if (!pkg) return false;
    await Purchases.purchasePackage({ aPackage: pkg });
    return true;
  } catch (err: any) {
    if (err?.userCancelled) return false; // 사용자가 직접 취소 — 에러 취급 안 함
    console.error('[purchases] 구매 실패:', err);
    return false;
  }
}

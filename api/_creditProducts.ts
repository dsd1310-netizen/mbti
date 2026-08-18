/**
 * 크레딧 상품 카탈로그 — 실제 RevenueCat/App Store Connect/Google Play Console/토스페이먼츠에
 * 등록하는 상품과 반드시 이름·가격이 일치해야 한다(2단계: 사용자가 각 콘솔에서 직접 등록).
 * 가격은 사주도령(330~9,900원, 다건 구매 시 할인)을 참고한 초안 — 실제 결정 전 조정 가능.
 */

/** RevenueCat(App Store/Play Store) 상품 ID → 지급 크레딧 수량 */
export const REVENUECAT_PRODUCT_CREDITS: Record<string, number> = {
  napuli_credits_1: 1,    // 990원 — 무료체험 소진 직후 "딱 하나만 더" 수요를 위한 낱개 옵션
  napuli_credits_5: 5,    // 2,900원 (개당 580원)
  napuli_credits_15: 15,  // 6,900원 (개당 460원)
  napuli_credits_30: 30,  // 9,900원 (개당 330원)
};

/** 토스페이먼츠는 상품 ID 체계가 없어 결제 금액(원)으로 매칭 — 위 가격과 반드시 맞출 것. */
export const TOSS_AMOUNT_TO_CREDITS: Record<number, number> = {
  990: 1,
  2900: 5,
  6900: 15,
  9900: 30,
};

/**
 * 앱스토어 리뷰 유도 — 네이티브 앱(Capacitor)에서만 동작.
 * 결과 화면을 일정 횟수 이상 본, 즉 앱을 실제로 유용하게 쓰고 있을 가능성이 높은
 * 시점에 딱 한 번만 OS 표준 인앱 리뷰 다이얼로그(In-App Review)를 띄운다.
 * 웹 브라우저 버전에는 해당 UI/네이티브 API 자체가 없다.
 */
import { Capacitor } from '@capacitor/core';

const VIEW_COUNT_KEY = 'napuli_result_view_count';
const REQUESTED_KEY = 'napuli_review_requested';
const VIEW_COUNT_THRESHOLD = 3;

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * 결과 화면 노출 시마다 호출. 조회수를 누적하고, 임계치를 처음 넘긴 시점에
 * 한 번만 인앱 리뷰를 요청한다(이후로는 다시 요청하지 않음). 실패는 조용히 무시.
 */
export async function trackResultViewAndMaybeRequestReview(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const count = Number(localStorage.getItem(VIEW_COUNT_KEY) ?? '0') + 1;
    localStorage.setItem(VIEW_COUNT_KEY, String(count));

    const alreadyRequested = localStorage.getItem(REQUESTED_KEY) === 'true';
    if (alreadyRequested || count < VIEW_COUNT_THRESHOLD) return;

    localStorage.setItem(REQUESTED_KEY, 'true');
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
  } catch {
    // 리뷰 요청 실패는 사용자 경험에 영향이 없어야 하므로 조용히 무시
  }
}

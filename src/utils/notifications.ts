/**
 * 오늘의 나풀이/타로/트랜짓 매일 알림 — 네이티브 앱(Capacitor)에서만 동작.
 * 웹 브라우저 버전에서는 기능 자체를 노출하지 않는다(iOS Safari 등에서 신뢰성 있게
 * 동작시키려면 서비스 워커+VAPID+서버 스케줄러가 별도로 필요해 이번 범위에서는 제외 —
 * 계획안.md 참고).
 *
 * 알림은 완전히 기기 안에서 예약되며(서버 왕복 없음), 개인화된 실제 콘텐츠 대신
 * "오늘의 나풀이가 도착했어요" 같은 일반 안내 문구만 보낸다 — 실제 해석은 앱을
 * 열어야 AI 호출로 생성되기 때문.
 */
import { Capacitor } from '@capacitor/core';

const NOTIFICATION_ID = 1;
const STORAGE_KEY = 'napuli_daily_notification_enabled';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isDailyNotificationEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

/** 권한을 요청하고, 허용되면 매일 오전 9시 반복 알림을 예약한다. 실패/거부 시 false. */
export async function enableDailyNotification(): Promise<boolean> {
  if (!isNativePlatform()) return false;

  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return false;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: NOTIFICATION_ID,
        title: '🔮 오늘의 나풀이',
        body: '오늘의 운세·타로·트랜짓이 도착했어요. 지금 확인해보세요!',
        schedule: { on: { hour: 9, minute: 0 }, repeats: true, allowWhileIdle: true },
      },
    ],
  });

  localStorage.setItem(STORAGE_KEY, 'true');
  return true;
}

export async function disableDailyNotification(): Promise<void> {
  localStorage.setItem(STORAGE_KEY, 'false');
  if (!isNativePlatform()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
}

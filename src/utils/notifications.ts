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
const HOUR_STORAGE_KEY = 'napuli_daily_notification_hour';
const DEFAULT_HOUR = 9;

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isDailyNotificationEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

/** 사용자가 선택한 알림 시(0~23). 저장된 값이 없거나 범위를 벗어나면 기본값(오전 9시). */
export function getNotificationHour(): number {
  const raw = Number(localStorage.getItem(HOUR_STORAGE_KEY));
  return Number.isInteger(raw) && raw >= 0 && raw <= 23 ? raw : DEFAULT_HOUR;
}

/** 권한을 요청하고, 허용되면 지정한 시(hour)에 매일 반복 알림을 예약한다. 실패/거부 시 false. */
export async function enableDailyNotification(hour: number = getNotificationHour()): Promise<boolean> {
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
        schedule: { on: { hour, minute: 0 }, repeats: true, allowWhileIdle: true },
      },
    ],
  });

  localStorage.setItem(STORAGE_KEY, 'true');
  localStorage.setItem(HOUR_STORAGE_KEY, String(hour));
  return true;
}

export async function disableDailyNotification(): Promise<void> {
  localStorage.setItem(STORAGE_KEY, 'false');
  if (!isNativePlatform()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
}

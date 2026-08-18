/**
 * 심화해석 크레딧 — 잔액 조회/차감 클라이언트.
 * 서버(api/credits.ts)가 진짜 잔액을 관리하며, 여기는 그 얇은 래퍼다. 반드시 로그인
 * (Firebase Auth) 상태에서만 호출 가능 — 호출부(App.tsx)가 currentUser를 먼저 확인한다.
 */
import type { User } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { DEPLOY_ORIGIN } from '../deployConfig';

/**
 * 크레딧제 킬스위치. 기본값(미설정 시) false — 코드는 다 구현돼 있지만, RevenueCat/
 * App Store Connect/Google Play Console/토스페이먼츠 등 2단계 외부 설정과 네이티브 앱
 * 출시가 전부 끝나기 전까지는 기존 사용자 경험(심화해석 완전 무료, 로그인 불필요)을
 * 그대로 유지하기 위한 값 — 2026-08-18 사용자 요청("지금 당장 쓰는 건 막지 말고, 앱
 * 버전까지 다 완료되면 그때 켜자"). 켤 때는 Vercel/로컬 .env와 네이티브 빌드 환경변수에
 * VITE_CREDIT_GATE_ENABLED=true를 설정하면 된다(계획안.md 7-AW-8 참고).
 */
export const CREDIT_GATE_ENABLED = import.meta.env.VITE_CREDIT_GATE_ENABLED === 'true';

// gemini/core.ts와 동일한 이유(네이티브 웹뷰는 상대경로 fetch가 배포 서버에 안 닿음)로
// 네이티브일 때만 배포 도메인 절대경로를 쓴다.
const API_BASE = Capacitor.isNativePlatform() ? DEPLOY_ORIGIN : '';

export interface CreditResult {
  ok: boolean;
  credits: number | null;
  /** 'LOGIN_REQUIRED' | 'NO_CREDITS' | 'INFRA_ERROR' 등 — 클라이언트가 어떤 모달을 띄울지 분기 */
  reason: string | null;
}

async function callCreditsApi(user: User, method: 'GET' | 'POST'): Promise<CreditResult> {
  try {
    const idToken = await user.getIdToken();
    const res = await fetch(`${API_BASE}/api/credits`, {
      method,
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, credits: null, reason: data?.error?.code ?? 'UNKNOWN' };
    }
    return { ok: true, credits: data.credits, reason: null };
  } catch {
    return { ok: false, credits: null, reason: 'NETWORK_ERROR' };
  }
}

/** 잔액만 조회(차감 없음) — 헤더의 크레딧 뱃지 표시, 결제 완료 후 갱신 등에 사용. */
export function fetchCreditBalance(user: User): Promise<CreditResult> {
  return callCreditsApi(user, 'GET');
}

/** 심화해석 시작 직전에 딱 한 번 호출해 크레딧 1개를 차감. 이후 실제 생성 요청은 기존 api/gemini.ts로. */
export function consumeCredit(user: User): Promise<CreditResult> {
  return callCreditsApi(user, 'POST');
}

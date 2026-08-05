import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

// 클라우드 동기화는 선택 기능이므로, 환경변수가 비어 있어도(로컬 설정 누락 등)
// 앱 전체가 죽지 않도록 설정값이 모두 있을 때만 초기화한다. 일부만 빠진 상태로
// initializeApp을 호출하면(예: authDomain 누락) "동기화 기능 없음"으로 우아하게
// 넘어가지 못하고 로그인 시도 시점에 예기치 못한 런타임 에러로 튈 수 있다.
const isConfigured = Object.values(firebaseConfig).every(Boolean);

export const firebaseApp = isConfigured ? initializeApp(firebaseConfig) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;

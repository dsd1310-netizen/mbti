/**
 * 클라우드 동기화 (Firebase Auth + Firestore) — 선택 기능.
 * 로그인하지 않아도 기존처럼 localStorage만으로 완전히 동작하며,
 * 로그인 시 "나풀이 다이어리" 저장 기록만 클라우드와 동기화한다(AI 캐시 등은 동기화 대상 아님).
 */
import {
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  deleteUser,
  reauthenticateWithPopup,
  type User,
  type AuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const cloudSyncAvailable = Boolean(auth && db);

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle(): Promise<User> {
  if (!auth) throw new Error('클라우드 동기화가 설정되지 않았습니다.');
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  return result.user;
}

// [2026-08-07] iOS 앱에 구글 등 제3자 소셜 로그인이 하나라도 있으면 Apple App Store 심사
// 가이드라인 4.8에 따라 "Sign in with Apple"도 동등하게 제공해야 함(안 지키면 리젝 사유).
// 사용 전 Firebase 콘솔에서 Apple 로그인 제공자를 켜고, Apple 개발자 계정 + Xcode에서
// "Sign in with Apple" 기능(capability)을 추가해야 실제로 동작함(코드만으로는 불가 — 계획안.md 참고).
export async function signInWithApple(): Promise<User> {
  if (!auth) throw new Error('클라우드 동기화가 설정되지 않았습니다.');
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

function reauthProviderFor(user: User): AuthProvider {
  return user.providerData[0]?.providerId === 'apple.com'
    ? new OAuthProvider('apple.com')
    : new GoogleAuthProvider();
}

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

/**
 * 계정 및 클라우드에 저장된 모든 데이터를 영구 삭제한다(로컬 기기의 다이어리 기록은 그대로 남음 —
 * 로컬 저장은 계정과 무관하게 동작하는 별개의 저장소이므로).
 * Firebase는 보안상 "최근 로그인"이 아니면 계정 삭제를 거부하므로(auth/requires-recent-login),
 * 이 경우 구글 재인증 팝업을 한 번 더 띄운 뒤 삭제를 재시도한다.
 */
export async function deleteAccount(user: User): Promise<void> {
  if (!auth || !db) return;
  // Firestore 문서 삭제가 실패하면 계정(Auth) 삭제를 진행하지 않는다 — 순서를 바꾸면
  // Auth 계정이 먼저 사라져 해당 uid로 다시 로그인할 방법이 없어지고, 실패한 Firestore
  // 문서가 영원히 고아 상태로 남아 재시도조차 불가능해지기 때문.
  await deleteDoc(doc(db, 'users', user.uid));
  try {
    await deleteUser(user);
  } catch (err: any) {
    if (err?.code === 'auth/requires-recent-login') {
      // 사용자가 애초에 로그인했던 방식(구글/애플)과 동일한 제공자로 재인증해야 함 —
      // 항상 구글로 재시도하면 애플로 가입한 사용자는 계정을 영영 삭제할 수 없게 됨.
      await reauthenticateWithPopup(user, reauthProviderFor(user));
      await deleteUser(user);
    } else {
      throw err;
    }
  }
}

/** 두 다이어리 기록 배열을 id 기준으로 합침(중복 제거). 같은 id면 더 최근(id가 큰, 즉 나중에 저장된) 쪽을 유지. */
export function mergeBookmarks<T extends { id: number }>(local: T[], cloud: T[]): T[] {
  const byId = new Map<number, T>();
  for (const bm of cloud) byId.set(bm.id, bm);
  for (const bm of local) byId.set(bm.id, bm);
  return Array.from(byId.values()).sort((a, b) => b.id - a.id);
}

export async function fetchCloudBookmarks<T>(uid: string): Promise<T[]> {
  if (!db) return [];
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data();
  return Array.isArray(data?.bookmarks) ? (data!.bookmarks as T[]) : [];
}

export async function pushBookmarksToCloud<T>(uid: string, bookmarks: T[]): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'users', uid), { bookmarks, updatedAt: Date.now() }, { merge: true });
}

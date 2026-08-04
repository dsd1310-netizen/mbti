/**
 * 클라우드 동기화 (Firebase Auth + Firestore) — 선택 기능.
 * 로그인하지 않아도 기존처럼 localStorage만으로 완전히 동작하며,
 * 로그인 시 "나풀이 다이어리" 저장 기록만 클라우드와 동기화한다(AI 캐시 등은 동기화 대상 아님).
 */
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
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

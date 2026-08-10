// 나풀이 PWA 서비스워커 — "홈 화면에 추가"와 오프라인 접근을 위한 최소 캐싱.
// (2026-08-07) 계획안.md 참고. 웹 푸시 발송(서버가 알림을 실제로 보내는 것)은 별도 후속 작업.
const CACHE_NAME = 'napuli-v1';
const PRECACHE_URLS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Gemini/카카오 SDK 등 외부 요청은 그대로 통과

  // AI 응답 등은 절대 캐시하면 안 됨 — 캐시된 결과가 재사용되면 안 되는 API 호출은 그대로 통과
  if (url.pathname.startsWith('/api/')) return;

  // Vite가 콘텐츠 해시를 파일명에 넣어 빌드하는 정적 자산은 내용이 바뀌면 파일명도 바뀌므로
  // 캐시 우선(cache-first)이 안전하고 빠름 — 오래된 캐시가 새 배포와 충돌할 일이 없음.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        // 네트워크가 끊겨 fetch 자체가 reject되면(지하철 등) 캐시를 한 번 더 확인 —
        // 처리 안 된 rejection으로 남기지 않고, 그래도 없으면 정상적인 네트워크 실패로 넘김
        // (main.tsx의 vite:preloadError 자동 새로고침이 이어서 복구를 시도함).
        .catch(() => caches.match(request))
      )
    );
    return;
  }

  // HTML 등 나머지는 네트워크 우선 — 배포 직후 사용자가 옛날 index.html(다른 해시의 번들을
  // 가리킴)에 갇혀 화이트스크린이 나는 것을 방지하고, 오프라인일 때만 캐시로 대체.
  event.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});

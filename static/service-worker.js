const VERSION = 'v0.3.3';                            // ← 버전만 올리면 배포된 SW가 교체됨
const PRECACHE = `precache-${VERSION}`;          // 정적 자산
const RUNTIME = `runtime-${VERSION}`;           // 동적 캐시

// SSG 또는 adapter-static이라면 여기에 빌드 산출물을 자동 주입하도록 rollup/vite 플러그인 사용
const PRECACHE_URLS = [
    '/',                        // index.html 대체
    '/offline.html',            // 네트워크 실패 시 폴백
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', event => {
    self.skipWaiting();                            // 새 SW 바로 활성화
    event.waitUntil(
        caches.open(PRECACHE).then(cache => cache.addAll(PRECACHE_URLS))
    );
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', event => {
    clients.claim();                               // 열린 탭에 즉시 적용
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => ![PRECACHE, RUNTIME].includes(key))
                    .map(key => caches.delete(key))
            )
        )
    );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', event => {
    const { request } = event;

    // 1) 탐색 요청(HTML) → 네트워크 우선, 실패하면 offline.html
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match('/offline.html'))
        );
        return;
    }

    // 2) 정적 자산(정적 import, 폰트 등) → 캐시 우선
    if (request.destination && ['script', 'style', 'worker', 'font', 'image', 'video'].includes(request.destination)) {
        event.respondWith(
            caches.match(request).then(cached =>
                cached ||
                fetch(request).then(resp => {
                    const cloned = resp.clone();
                    caches.open(RUNTIME).then(cache => cache.put(request, cloned));
                    return resp;
                })
            )
        );
        return;
    }

    // 3) API 호출 → 네트워크 우선, 백업 캐시 5분
    if (request.url.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .then(resp => {
                    const cloned = resp.clone();
                    caches.open(RUNTIME).then(cache => cache.put(request, cloned));
                    return resp;
                })
                .catch(() => caches.match(request))
        );
    }
});

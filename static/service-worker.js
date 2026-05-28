const VERSION = 'v0.5.1';                            // ← 버전만 올리면 배포된 SW가 교체됨
const PRECACHE = `precache-${VERSION}`;          // 정적 자산
const RUNTIME = `runtime-${VERSION}`;           // 동적 캐시
const MAX_RUNTIME_ENTRIES = 200;                 // RUNTIME 캐시 최대 항목 수
const API_CACHE_TTL_MS = 5 * 60 * 1000;          // API 캐시 TTL: 5분

// SSG 또는 adapter-static이라면 여기에 빌드 산출물을 자동 주입하도록 rollup/vite 플러그인 사용
const PRECACHE_URLS = [
    '/',                        // index.html 대체
    '/offline.html',            // 네트워크 실패 시 폴백
    '/web-app-manifest-192x192.png',
    '/web-app-manifest-512x512.png'
];

/* ---------- Helpers ---------- */

// Trim RUNTIME cache to MAX_RUNTIME_ENTRIES (LRU-style: oldest first)
async function trimCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
        await Promise.all(
            keys.slice(0, keys.length - maxItems).map(key => cache.delete(key))
        );
    }
}

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
    const requestUrl = new URL(request.url);

    // Cross-origin API/font/CDN requests should stay on the browser's normal
    // CORS path. Handling them here can turn a failed fetch into an invalid
    // `undefined` respondWith response and break the page.
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    // 1) 탐색 요청(HTML) → 네트워크 우선, 실패하면 offline.html
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(async () =>
                (await caches.match('/offline.html')) ||
                new Response('Offline', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                })
            )
        );
        return;
    }

    // 2) 정적 자산(정적 import, 폰트 등) → stale-while-revalidate
    //    해시 기반 파일명이라 cache-first가 안전하지만, 비해시 자산을 위해 백그라운드 revalidate
    if (request.destination && ['script', 'style', 'worker', 'font', 'image', 'video'].includes(request.destination)) {
        event.respondWith(
            caches.match(request).then(cached => {
                const fetchPromise = fetch(request).then(resp => {
                    if (request.method === 'GET' && resp.ok) {
                        const cloned = resp.clone();
                        caches.open(RUNTIME).then(cache => {
                            cache.put(request, cloned);
                            trimCache(RUNTIME, MAX_RUNTIME_ENTRIES);
                        });
                    }
                    return resp;
                }).catch(() =>
                    cached ||
                    new Response('', {
                        status: 503,
                        statusText: 'Service Unavailable'
                    })
                );

                return cached || fetchPromise;
            })
        );
        return;
    }

    // 3) API 호출 → 네트워크 우선, 5분 TTL 캐시 폴백
    if (requestUrl.pathname.startsWith('/api/')) {
        if (request.method !== 'GET') {
            return;
        }

        event.respondWith(
            fetch(request)
                .then(resp => {
                    if (resp.ok) {
                        const cloned = resp.clone();
                        caches.open(RUNTIME).then(cache => {
                            // Store response with timestamp header for TTL
                            const headers = new Headers(cloned.headers);
                            headers.set('sw-cache-time', Date.now().toString());
                            const timedResp = new Response(cloned.body, {
                                status: cloned.status,
                                statusText: cloned.statusText,
                                headers: headers
                            });
                            cache.put(request, timedResp);
                            trimCache(RUNTIME, MAX_RUNTIME_ENTRIES);
                        });
                    }
                    return resp;
                })
                .catch(async () => {
                    // Network failed → check cached response TTL
                    const cached = await caches.match(request);
                    if (!cached) {
                        return new Response(
                            JSON.stringify({ error: 'Network unavailable' }),
                            {
                                status: 503,
                                headers: { 'Content-Type': 'application/json' }
                            }
                        );
                    }

                    const cacheTime = parseInt(cached.headers.get('sw-cache-time') || '0', 10);
                    if (Date.now() - cacheTime > API_CACHE_TTL_MS) {
                        // Stale cache — delete it but still return as last resort
                        caches.open(RUNTIME).then(cache => cache.delete(request));
                    }
                    return cached;
                })
        );
    }
});

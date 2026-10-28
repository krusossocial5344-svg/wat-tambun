// ระบบทำบุญวัด — service worker: ใช้งานได้แม้เน็ตไม่ดี และติดตั้งเป็นแอปได้
// เปลี่ยนเลขเวอร์ชันทุกครั้งที่แก้ไฟล์ เพื่อให้เครื่องผู้ใช้โหลดของใหม่
const V = 'wat-tambun-v15';
const CORE = ['./', './index.html', './style.css', './app.js', './firebase-config.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/logo.webp'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // ไฟล์ของเว็บ: ลองโหลดใหม่ก่อน ถ้าไม่มีเน็ตใช้ของที่เก็บไว้
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  } else if (/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com/.test(url.href)) {
    // ไลบรารีที่ระบุเวอร์ชันแล้ว: ใช้ของที่เก็บไว้ได้เลย
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(req, cp)); return res; })));
  }
});

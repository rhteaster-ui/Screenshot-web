# FOLIO — Web Capture Instrument

FOLIO mengambil screenshot halaman publik melalui browser Chromium milik sendiri.
UI tetap berbahasa Indonesia dengan single/batch, preview, dan download. Tidak
ada akun atau database permanen.

## Status deployment

Standalone Node menjalankan Playwright + Chromium dan bisa dipakai sebagai
aplikasi lengkap. Situs FOLIO pada Sites menjalankan frontend dan API berbasis
Worker; untuk capture nyata di sana, hubungkan server Chromium sendiri via
`CAPTURE_ENGINE_URL` dan `CAPTURE_ENGINE_TOKEN`. Sebelum server itu terhubung,
tombol capture dinonaktifkan dan UI menampilkan alasan. Jangan menyebut URL
Sites siap capture sebelum alur tersebut diuji pada deployment yang terhubung.

Adapter SSWeb lama masih ada untuk kompatibilitas, tetapi tidak menjadi default
atau fallback. SSWeb sebelumnya menolak request tanpa akses; aplikasi tidak
mencoba melewati kontrol akses tersebut.

## Arsitektur

- React 19 + TypeScript + CSS FOLIO; Vite/Vinext untuk Sites, Vite SPA untuk Node.
- API internal menerima model capture yang sama untuk mode single dan batch.
- Node menggunakan `server/capture/providers/playwright.ts`. Situs memakai
  `remote.ts` untuk menghubungi endpoint HTTPS `/api/engine` pada server Node.
- Engine mengembalikan binary; service menyimpan file sementara dan mengirim
  metadata serta URL preview/download. Base64 tidak masuk state frontend.
- Batch diproses berurutan dengan satu deadline, menghasilkan ZIP dan contact
  sheet. Jika salah satu halaman gagal, operasi mengembalikan error, bukan
  mengklaim batch lengkap.
- JPEG/PNG berasal dari Chromium. WEBP dikonversi dari PNG oleh Sharp. PDF
  dihasilkan `page.pdf()` dengan media screen dan pagination cetak Chromium.
- Scroll reveal berjalan sekali dengan opacity/transform dan dinonaktifkan
  untuk pengguna yang memilih reduced motion.

## Instalasi Node

Perlu Node 22.13+, pnpm 11 dan browser Chromium Playwright.

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
cp .env.example .env
pnpm build:node
pnpm start:node
```

Buka `http://localhost:3000`. Secara default server Node memakai Playwright.
Dev dependencies diperlukan karena `start:node` menggunakan loader TypeScript.
Saat HTTPS berhenti di reverse proxy, isi `APP_ORIGIN` dengan origin publik
tepercaya.

```bash
docker build -t folio .
docker run --init --shm-size=1g --memory=2g --cpus=2 -p 3000:3000 --env-file .env folio
```

Container memakai user `node`. Host harus mengizinkan user namespaces Chromium;
ikuti profil seccomp Playwright untuk container yang menangani URL publik.
Hindari `--privileged`. Docker build memerlukan akses registry dan distribusi
browser resmi. Storage sementara tidak memerlukan volume permanen.

## Menghubungkan Situs Sites

1. Jalankan Node/container di server milik sendiri dengan HTTPS dan
   `CAPTURE_PROVIDER=playwright`.
2. Buat secret acak untuk `CAPTURE_ENGINE_TOKEN` pada kedua lingkungan.
3. Atur Sites ke `CAPTURE_PROVIDER=remote`, `CAPTURE_ENGINE_URL` ke origin HTTPS
   server dan `CAPTURE_ENGINE_TOKEN` ke secret yang sama.
4. Uji single, batch, preview, dan download dari UI Sites sebelum publikasi.

Endpoint `/api/engine` menerima bearer token dan mengembalikan binary. Token
tidak dikirim ke browser pengguna. Pada server yang memiliki token, endpoint API
umum dibatasi sehingga mesin tidak menyediakan akses capture tanpa otorisasi.

Untuk pengembangan Worker dan cek lokal:

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

`pnpm start` menjalankan Worker lokal, bukan mesin Chromium Node. Rahasia Sites
ditetapkan pada runtime platform, tidak dimasukkan ke frontend atau Git.

## Variabel lingkungan

| Variable | Default | Fungsi |
|---|---|---|
| `PORT` | 3000 | Listener Node |
| `APP_ORIGIN` | kosong | Origin publik di balik reverse proxy |
| `CAPTURE_PROVIDER` | Node: playwright; Worker: remote | Adapter aktif |
| `CAPTURE_ENGINE_URL` | kosong | Origin HTTPS engine sendiri |
| `CAPTURE_ENGINE_TOKEN` | kosong | Secret server untuk `/api/engine` |
| `CHROMIUM_SANDBOX` | true | Sandbox Chromium |
| `CHROMIUM_EXECUTABLE_PATH` | kosong | Browser alternatif yang kompatibel |
| `CAPTURE_TIMEOUT` | 90000 | Batas operasi dalam ms |
| `CAPTURE_FILE_TTL` | 1800000 | Masa berlaku hasil dalam ms |
| `CAPTURE_BATCH_LIMIT` | 5 | Maksimal URL batch, batas keras 10 |
| `CAPTURE_MAX_OUTPUT_BYTES` | 8388608 | Batas output binary |
| `CAPTURE_RATE_LIMIT` | 10 | Anggaran URL/menit per klien/proses |
| `CAPTURE_MAX_CONCURRENT` | 2 | Capture serentak per proses |

Request JSON dibatasi 16 KiB. Ukuran custom 320–3840 × 240–2160 CSS px,
delay 0–10 detik, scale 0.5–2. Perkalian viewport dan scale dibatasi
16,6 megapiksel. Full Page dibatasi 32 megapiksel dan tinggi 30.000 px.

## Preset dan output

| Preset | Viewport CSS px |
|---|---|
| Desktop | 1920 × 1080 |
| Mobile | 390 × 844 |
| iPad | 820 × 1180 |
| iPad Pro | 1024 × 1366 |
| MacBook | 1440 × 900 |
| PC QHD | 2560 × 1440 |
| Custom | Lebar dan tinggi manual |

Preset adalah ukuran viewport, bukan emulasi hardware, Safari, atau user-agent
Apple. Semua capture memakai Chromium. Scale gambar mengubah DPR; scale PDF
mengubah skala layout cetak. PDF Viewport mengekspor halaman cetak pertama;
Full Page memakai tinggi dokumen. PDF dapat berbeda dari gambar pada pagination
dan elemen fixed. Dark Mode hanya berlaku jika halaman mendukung
`prefers-color-scheme`. Delay dimulai sesudah halaman termuat. Halaman login,
CAPTCHA, challenge, dan interaksi cookie tidak otomatis ditangani.

## API

`POST /api/capture` menerima model berikut. Untuk batch, gunakan
`POST /api/capture/batch`, `mode: "batch"` dan beberapa URL.

```json
{
  "mode":"single",
  "targets":["https://example.com"],
  "viewport":{"preset":"ipad","width":820,"height":1180,"fullPage":false,"scale":1},
  "appearance":{"darkMode":false},
  "output":{"format":"png"},
  "timing":{"delay":1}
}
```

Format `jpeg`, `png`, `webp`, `pdf`. Respons berisi `id`, `type`, `filename`,
`mimeType`, `bytes`, `previewUrl`, `downloadUrl`, `expiresAt` dan metadata
viewport. Batch juga mengembalikan `items` untuk contact sheet.
`GET /api/files/:id` memberikan preview inline dan `GET /api/download/:id`
attachment. `GET /api/health` menunjukkan konfigurasi UI, bukan jaminan bahwa
engine eksternal sedang sehat.

Errors berbentuk `{success:false,code,message,retryable?,row?}`. Contohnya
`INVALID_URL`, `PRIVATE_URL`, `ENGINE_UNAVAILABLE`, `TARGET_UNAVAILABLE`,
`REQUEST_TIMEOUT`, `OUTPUT_TOO_LARGE`, `FILE_EXPIRED`. Download mengecek MIME
dan jumlah byte, tidak menyimpan JSON error sebagai gambar.

## Storage dan keamanan

Node memakai `storage/captures` dan `storage/batches`; cleanup saat startup
dan tiap 60 detik. Berkas kedaluwarsa ditolak saat akses, meskipun sweep belum
berjalan. Unduhan yang sudah dibuka tetap dapat selesai selama cleanup.
Sites memakai R2 dengan TTL yang diperiksa saat akses. Penghapusan fisik R2
oportunistis saat capture berikutnya, sehingga saat idle byte bisa bertahan
melewati TTL meski tidak lagi dapat diunduh. Tidak ada history permanen.

- Hanya URL HTTP/HTTPS publik, tanpa credential dan port khusus. Alamat privat,
  localhost, metadata, dan hostname internal ditolak.
- Browser menggunakan proxy lokal terbatas untuk setiap request dan subresource.
  DNS diperiksa saat koneksi lalu koneksi diarahkan ke IP yang diperiksa,
  mengurangi risiko DNS rebinding. WebSockets dan service workers diblokir.
- Chromium sandbox aktif default. Gunakan firewall egress yang menolak jaringan
  privat/internal dan UDP untuk pertahanan tambahan pada server produksi.
- Jangan mengekspos port browser/CDP/proxy. HTTPS wajib untuk bridge remote.
- Rate limit bersifat per proses, belum global lintas replika. Pada Node di
  belakang reverse proxy semua klien bisa berbagi budget socket yang sama.
- Hasil memakai ID acak, `no-store`, `nosniff`, dan CSP sandbox. Hindari URL
  dengan token atau konten pribadi; tautan hasil bersifat bearer link.
- Tidak ada bypass login, CAPTCHA, paywall, atau Cloudflare.

## Troubleshooting dan verifikasi

`ENGINE_UNAVAILABLE`: aktifkan server sendiri, URL/token HTTPS pada Sites.
`Executable doesn't exist`: instal Chromium Playwright. Sandbox gagal:
jalankan dengan user non-root di host yang mendukung user namespaces. Pilihan
`CHROMIUM_SANDBOX=false` hanya untuk diagnosis lingkungan terisolasi.
`TARGET_UNAVAILABLE`: cek URL, DNS, TLS, dan apakah halaman publik.
`REQUEST_TIMEOUT`: kurangi delay atau jumlah URL. `OUTPUT_TOO_LARGE`: kurangi
viewport, scale atau Full Page. `FILE_EXPIRED`: capture ulang.

Struktur penting: `app/` desain, `src/capture/` form/preset, `src/motion/`
scroll reveal, `server/capture/providers/playwright.ts` engine,
`remote.ts` bridge, `server/utils/capture-proxy.ts` egress,
`server/index.ts` Node, `tests/` regresi. Bukti pengujian ada di `docs/QA.md`.
Fixture offline menguji transport/security dan tidak digunakan oleh produk.
Build sukses bukan bukti target publik berhasil dicapture; uji alur live pada
server produksi yang dipilih.

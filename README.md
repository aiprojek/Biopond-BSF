# Biopond BSF — Aplikasi Manajemen Budidaya Maggot Skala Rumahan

**Biopond BSF** adalah aplikasi web **Progressive Web App (PWA)** berdesain *mobile-first* yang dirancang khusus untuk membantu peternak maggot *Black Soldier Fly* (BSF) skala rumahan maupun komunitas. Aplikasi ini berjalan **100% secara lokal (offline-first)** menggunakan IndexedDB di perangkat pengguna, dengan tampilan Dark Mode kontras tinggi (nuansa slate gelap dan hijau zamrud) agar tetap nyaman dibaca di luar ruangan atau di area kandang.

---

## 1. Deskripsi Singkat & Fitur Utama

- **Local-First & 100% Offline PWA**:
  - Seluruh pustaka UI & database (**Tailwind CSS** hasil kompilasi build, **Dexie.js**, **Lucide Icons**, **qrcode-generator**) di-hosting lokal dan langsung masuk ke daftar **`precacheAndRoute` di `sw.js`** — bebas CDN eksternal sehingga tetap berjalan normal 100% offline sejak instalasi pertama.
  - Seluruh data wadah permanen (`containers`), biopond, log sampah organik harian (beserta dokumentasi foto WebP ringan), buku mutasi pakan (`feed_ledger`), hasil panen, suhu/pH, stok pakan, tim operator, serta keuangan disimpan di **Dexie.js (IndexedDB)** dan `localStorage`, dilengkapi **Export/Import Backup JSON (v7)**.
- **Dashboard, Checklist Harian, Foto Log & Peringatan Lingkungan Otomatis**:
  - Ringkasan metrik real-time: **Jumlah Biopond Aktif**, **Total Sampah Organik Terurai (kg)**, **Total Panen Maggot Segar (kg)**, **Total Air Lindi / POC (liter)**, dan panel **Peringatan Suhu / Kelembapan / pH Ekstrem & Stok Menipis**.
  - **Ergonomi Lapangan Cepat**: Tombol **Scan QR Instan** di header bar, chip **Quick-Add** (`+1`, `+2`, `+5`, `+10`, `+20 kg` / liter) di form Sampah & Panen, serta preset suhu/pH 1-ketuk.
  - **Dokumentasi Foto WebP Ringan**: Lampirkan foto media biopond pada Catat Sampah (otomatis dikompresi `<canvas>` ke WebP ≤800px), lengkap dengan lightbox preview dan kirim langsung ke Diagnosa AI.
  - **Tugas Harian Otomatis** sesuai umur masing-masing batch biopond & insektarium.
- **Master Wadah, Batch Tracker, Timeline Rotasi (Gantt), 2 Prinsip Lindi + Kustom & Analitik WRI/FCR**:
  - **Master Wadah Permanen (`containers`)**: Simpan profil nama, tipe wadah, zona, dan kode permanen (`W-001`, dst.). Mulai batch berikutnya 1-ketuk lewat dropdown **Wadah Terdaftar** atau tombol **+ Siklus Baru** tanpa mengetik ulang nama.
  - Pantau umur batch (`Hari ke-X`), badge fase otomatis, catatan **Suhu, Kelembapan & pH Media**, dan progres panen.
  - **Timeline Rotasi Siklus (Gantt View)**: Sub-tab **Timeline** memvisualisasikan jadwal seluruh batch (`Penetasan H1–5`, `Pembesaran H6+`, marka pindah media `P` & panen `★`) dengan rentang 14/21/30 hari dan garis penanda *Hari Ini*.
  - **2 Prinsip Inti Lindi + Tipe Wadah Kustom**: Pilih **Menghasilkan Air Lindi** atau **Tanpa Air Lindi** dengan preset cepat (**Ember Susun**, **Ember False Bottom**, **Ember Biasa**, **Bak / Rak**) maupun tipe **Lainnya (Kustom)** (mis. *Drum Belah*, *Box Kontainer*, *Kolam Terpal*) lengkap dengan checklist harian, hint input lindi, dan grafik analitik dinamis.
  - **Gudang Stok Pakan Berbasis Buku Mutasi (`feed_ledger`)**: Setiap stok masuk (`in`) dan pemakaian saat Catat Sampah (`out`) dicatat terpisah dan dihitung ulang otomatis (`recalculateFeedStocksFromLedger`), sehingga aman dari *lost-update* saat sinkronisasi multi-perangkat offline.
  - **Analisis Performa Siklus**: Hitung **FCR**, **Rendemen Biokonversi (%)**, **Reduksi Sampah (%)**, dan indeks **WRI** lengkap dengan grafik perbandingan seluruh tipe wadah (termasuk kustom), kategori *Hasilkan Lindi vs Tanpa Lindi*, serta antar *Zona*.
- **Laporan Bulanan PDF A4 & Ekspor Excel CSV**:
  - Di sub-tab **Keuangan & HPP**, pilih bulan lalu cetak **Laporan Bulanan A4 (PDF)** atau ekspor **CSV Excel (UTF-8 BOM)** berisi rekap sampah, panen maggot/kasgot/lindi/telur, HPP, dan seluruh transaksi bulan tersebut.
- **Tim Operator, PIN Staf Independen, Cooldown Lockout & Mode Pemulihan**:
  - **PIN Khusus per Staf & Pemilik**: Setiap staf/pekerja dan pemilik memiliki 4–6 digit PIN mandiri (di-hash SHA-256 lokal) dengan proteksi *brute-force* (**jeda 30 detik** setelah 5× salah dan **5 menit** setelah 10× salah).
  - **Mode Pemulihan (Lupa PIN)**: Pertanyaan pembantu keamanan untuk mereset PIN secara mandiri baik bagi Pemilik maupun Staf, ditambah **Master Reset Pemilik** di sub-tab **Tim & Staf**.
  - **Mode Pekerja Kandang**: Sembunyikan data Keuangan/HPP, API Key AI, kredensial Cloud Sync, dan cegah penghapusan data saat perangkat dipakai pekerja kandang tanpa mengganggu kerja offline.
- **Kalkulator Budidaya BSF (4 Mode)**:
  - **Penetasan (Nursery)**, **Daya Makan Harian**, **Kapasitas Industri (Kuintal–Ton)**, dan **Maggot Kering & BEP Harga Jual** (hitung susut bobot oven/kemas & target margin laba).
- **Diagnosa AI Multi-Provider + Vision AI (BYOK — *Bring Your Own Key*)**:
  - Pilih **Google Gemini**, **OpenRouter**, **Groq**, atau **OpenAI** (API Key tersimpan aman di `localStorage`).
  - Mendukung lampiran foto kondisi media (atau 1-ketuk **"Pakai Foto Log Terakhir"**) beserta konteks batch & pembacaan **Suhu/Kelembapan/pH** terbaru.
- **Notifikasi Lokal PWA, Google Calendar `.ICS` & Cetak Label QR / General (Spidol)**:
  - **Notifikasi Pengingat Lokal PWA**: Web Notification API 100% offline saat aplikasi aktif/dibuka di browser; dipadukan dengan **Google Calendar / `.ICS`** agar alarm OS tetap berbunyi meski aplikasi ditutup total dari latar belakang.
  - **Cetak Label QR, Barcode 1D & Label General Reusable**: Cetak label **Penetasan**, **Biopond**, maupun **Label General (Spidol + Solasi)** berisi Nama Wadah permanen, **Barcode 1D Code-39 + QR Code (`BSF-WADAH:W-001`)** yang terikat permanen ke wadah fisik, kotak isian kosong (*Tgl Tebar, Gramasi Telur, Pindah Media, Target Panen*), Hint Pengingat, serta opsi cetak **2 label/lembar A4**. Saat stiker lama di-scan di siklus baru, scanner otomatis mengarahkan ke batch aktif terbaru atau menawarkan 1-ketuk **Mulai Siklus Baru**.
- **Sinkronisasi Cloud & Kode Pairing Cepat Antar Perangkat**:
  - Gabungkan data antar HP/PC berbasis `syncUid` via **Cloudflare Pages (`/api/sync` KV/R2)**, **Dropbox (OAuth2 PKCE + Folder Sync)**, atau **WebDAV**.
  - Dilengkapi **Kode Pairing Cepat / Scan QR** (`4829-K7M9` terenkripsi AES-GCM via relay 15 menit atau QR/Token `BSFPAIR:v1:...` tanpa server) dengan opsi peran **Pemilik** atau **Pekerja Kandang** agar HP ke-2 langsung tersinkron & terkunci sesuai peran tanpa setting ulang.
- **Onboarding Ringan Berbasis Privasi**:
  - Tanpa login password. Pengiriman statistik komunitas (`/api/register`) bersifat opt-in untuk lokasi, dan koordinat otomatis dibulatkan ke 2 angka desimal (akurasi tingkat kota).

---

## 2. Struktur Folder Repositori

Jika Anda men-deploy proyek ini dengan backend ringan menggunakan **Cloudflare Pages Functions**, struktur repositori yang direkomendasikan adalah sebagai berikut:

```text
biopond-bsf/
├── index.html                  # Seluruh aplikasi PWA (UI, Dexie.js, callAI, analitik WRI/FCR & Pairing)
├── src/                        # Entry CSS Tailwind lokal & registrasi Service Worker
├── public/                     # Ikon PWA & vendor lokal (/vendor/dexie.min.js, lucide.min.js, qrcode.js)
├── functions/                  # Cloudflare Pages Functions (Serverless Backend)
│   └── api/
│       ├── register.js         # Endpoint POST /api/register -> meneruskan data ke Google Apps Script
│       ├── config.js           # Endpoint GET /api/config -> mengirim GOOGLE_CLIENT_ID ke frontend
│       └── sync.js             # Endpoint GET/PUT /api/sync -> sinkronisasi multi-device & relay Pairing KV/R2
└── README.md                   # Dokumentasi proyek
```

### Contoh Kode Cloudflare Pages Functions

> Buat folder `functions/api/` di root repositori Anda jika ingin mengaktifkan backend telemetri komunitas dan OAuth Google Calendar.

#### `functions/api/config.js`

```javascript
export async function onRequestGet({ env }) {
  return new Response(
    JSON.stringify({
      googleClientId: env.GOOGLE_CLIENT_ID || '',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
}
```

#### `functions/api/register.js`

```javascript
export async function onRequestPost({ request, env }) {
  try {
    const webhookUrl = env.GAS_WEBHOOK_URL;
    if (!webhookUrl) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const payload = {
      device_id: String(body.device_id || ''),
      nama: String(body.nama || ''),
      kota: String(body.kota || ''),
      location: String(body.location || 'none'),
      timezone: String(body.timezone || 'Asia/Jakarta'),
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

---

## 3. Panduan Setup Backend Telemetri (Khusus Pemilik Aplikasi)

Bagian ini **khusus untuk pemilik/pengelola hosting aplikasi** (bukan panduan pengguna akhir), jika Anda ingin mencatat statistik komunitas pengguna baru secara opsional ke Google Sheets.

### Langkah A: Siapkan Google Sheets
1. Buka [Google Sheets](https://sheets.google.com) dan buat **Spreadsheet baru** (misal beri nama `Telemetri Komunitas Biopond BSF`).
2. *(Opsional)* Ubah nama tab sheet pertama menjadi `Users` (jika dibiarkan `Sheet1`, script tetap otomatis memakainya). **Header kolom A–F tidak perlu diisi manual** karena akan dibuat otomatis oleh script saat data pertama masuk.

### Langkah B: Buat Google Apps Script (GAS)
1. Di dalam Google Sheets tadi, klik menu **Extensions (Ekstensi)** → **Apps Script**.
2. Hapus kode default di editor, lalu salin dan tempel kode berikut:

```javascript
function ensureHeaders_(sheet) {
  var headers = ['timestamp', 'device_id', 'nama', 'kota', 'location', 'timezone'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return;
  }

  var firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var hasHeader =
    String(firstRow[0]).trim() === 'timestamp' &&
    String(firstRow[1]).trim() === 'device_id';

  if (!hasHeader) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Users') || ss.getSheets()[0];

    ensureHeaders_(sheet);

    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var timestamp = new Date().toISOString();
    var deviceId = String(data.device_id || '');

    // Cari apakah device_id sudah ada di sheet (kolom B) untuk update data
    var values = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < values.length; i++) {
      if (values[i][1] === deviceId && deviceId !== '') {
        rowIndex = i + 1; // 1-indexed baris spreadsheet
        break;
      }
    }

    if (rowIndex > 0) {
      // Perbarui data pengguna yang ada (misal setelah isi profil di Pengaturan)
      sheet.getRange(rowIndex, 1).setValue(timestamp);
      if (data.nama && data.nama !== 'Anonim') sheet.getRange(rowIndex, 3).setValue(data.nama);
      if (data.kota && data.kota !== 'none') sheet.getRange(rowIndex, 4).setValue(data.kota);
      if (data.location && data.location !== 'none') sheet.getRange(rowIndex, 5).setValue(data.location);
      if (data.timezone) sheet.getRange(rowIndex, 6).setValue(data.timezone);
    } else {
      // Tambah baris baru (saat pertama buka / skip onboarding)
      sheet.appendRow([
        timestamp,
        deviceId,
        data.nama || 'Anonim',
        data.kota || 'none',
        data.location || 'none',
        data.timezone || ''
      ]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
```

### Langkah C: Deploy sebagai Web App
1. Klik tombol **Save (Simpan)** (ikon disket) dan beri nama proyek, misalnya `BSF Telemetry Webhook`.
2. Klik tombol **Deploy** (kanan atas) → **New deployment (Deployment baru)**.
3. Pada ikon gerigi di samping *Select type*, pilih **Web app**.
4. Isi pengaturan berikut:
   - **Description**: `Webhook pendaftaran komunitas BSF`
   - **Execute as (Jalankan sebagai)**: `Me (akun Google Anda)`
   - **Who has access (Siapa yang memiliki akses)**: **Anyone (Siapa saja)** *(penting agar Cloudflare Pages Function dapat mengirim POST request tanpa login)*.
5. Klik **Deploy**, lalu klik **Authorize access** dan izinkan akses ke Google Sheets Anda.
6. Salin **Web app URL** yang muncul (format: `https://script.google.com/macros/s/.../exec`). URL ini nantinya dimasukkan sebagai `GAS_WEBHOOK_URL` di Cloudflare Pages.

---

## 4. Panduan Setup Google Cloud Console (`GOOGLE_CLIENT_ID` untuk Google Calendar)

Agar tombol **"Hubungkan Google Calendar"** muncul di menu Pengaturan dan dapat membuat event otomatis ke kalender user, ikuti langkah berikut:

1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat project baru (klik dropdown project di kiri atas → **New Project**, misal `Biopond BSF App`) lalu pilih project tersebut.
3. **Aktifkan Google Calendar API**:
   - Buka menu **APIs & Services** → **Library**.
   - Cari **Google Calendar API**, klik lalu tekan **Enable**.
4. **Konfigurasi OAuth Consent Screen**:
   - Buka **APIs & Services** → **OAuth consent screen** (atau **Google Auth Platform** → **Branding & Audience**).
   - Pilih tipe user **External**, klik **Create**.
   - Isi **App name** (`Biopond BSF`), **User support email**, dan **Developer contact information**.
   - Pada bagian **Scopes**, tambahkan scope:
     `https://www.googleapis.com/auth/calendar.events`
   - Jika aplikasi masih berstatus *Testing*, tambahkan alamat email tester di bagian **Test users** (atau klik **Publish App** agar bisa dipakai publik).
5. **Buat OAuth 2.0 Client ID**:
   - Buka **APIs & Services** → **Credentials** → **+ CREATE CREDENTIALS** → **OAuth client ID**.
   - Pilih **Application type**: **Web application**.
   - Beri nama, misal `Biopond BSF Web`.
   - Pada **Authorized JavaScript origins**, masukkan domain tempat aplikasi Anda berjalan:
     - Untuk lokal: `http://localhost:3000` atau `http://localhost:8788`
     - Untuk Cloudflare Pages: `https://nama-proyek-anda.pages.dev` (dan custom domain jika ada).
   - *(Tidak perlu mengisi Authorized redirect URIs karena aplikasi menggunakan alur token client-side Google Identity Services).*
   - Klik **Create**, lalu salin **Client ID** (akhiran `.apps.googleusercontent.com`). Nilai ini akan disimpan sebagai `GOOGLE_CLIENT_ID`.

---

## 5. Panduan Deploy ke Cloudflare Pages & Pengaturan Secret Key

Dengan Cloudflare Pages, Anda dapat menghosting `index.html` sekaligus menjalankan `functions/api/*.js` secara gratis, tanpa menaruh kunci rahasia di kode sumber GitHub publik.

### Langkah A: Hubungkan Repositori GitHub ke Cloudflare Pages
1. Push repositori ini (`index.html`, `public/`, dan `functions/`) ke GitHub Anda.
2. Masuk ke [Cloudflare Dashboard](https://dash.cloudflare.com/) → pilih menu **Workers & Pages** → **Create** → tab **Pages** → **Connect to Git**.
3. Pilih repositori GitHub proyek Anda.
4. Pada pengaturan build:
   - **Framework preset**: `None` (jika langsung menyajikan `index.html` statis) atau `Vite` (jika memakai build script `npm run build` dengan output `dist`).
   - **Build output directory**: `.` (untuk file statis langsung) atau `dist` (jika memakai Vite build).
5. Klik **Save and Deploy**.

### Langkah B: Masukkan Secret Key ke Environment Variables
Agar `GAS_WEBHOOK_URL` dan `GOOGLE_CLIENT_ID` aman dan tidak bocor di repositori publik:

1. Buka proyek Anda di **Cloudflare Pages** → masuk ke tab **Settings** → **Environment variables**.
2. Pada bagian **Production** (dan **Preview** jika diperlukan), klik **Add variable**:
   - **Variable name**: `GAS_WEBHOOK_URL`  
     **Value**: Tempel URL Web App dari Google Apps Script (`https://script.google.com/macros/s/.../exec`)  
     *(Centang **Encrypt** agar tersimpan sebagai secret).*
   - **Variable name**: `GOOGLE_CLIENT_ID`  
     **Value**: Tempel Client ID OAuth 2.0 dari Google Cloud Console (`xxxx.apps.googleusercontent.com`).
3. Simpan perubahan, lalu buka tab **Deployments** dan klik **Retry deployment** pada deployment terakhir agar environment variables baru langsung aktif di Functions `/api/register` dan `/api/config`.

### Langkah C: Aktivasi Cloud Sync Multi-Perangkat (Cloudflare / Dropbox / WebDAV)
Di menu **Pengaturan → Sinkronisasi Antar Perangkat (Cloud)**, Anda dapat memilih salah satu dari 3 layanan:
1. **Cloudflare (`/api/sync`)**:
   - Di Cloudflare Pages → **Settings** → **Bindings**, tambahkan **KV Namespace** dengan nama variabel **`BSF_SYNC_KV`** *atau* **R2 Bucket** dengan nama variabel **`BSF_SYNC_R2`**.
   - *(Opsional)* Tambahkan Environment Variable secret **`SYNC_TOKEN`** jika ingin memproteksi endpoint `/api/sync` dengan Bearer Token.
2. **Dropbox (OAuth2 PKCE & Folder Sync)**:
   - Buat App di [Dropbox App Console](https://www.dropbox.com/developers/apps) → pilih **Scoped access** → **App folder** (disarankan agar terisolasi khusus di `/Apps/<NamaApp>`).
   - Pada tab **Permissions** app Anda, centang `files.content.write`, `files.content.read`, dan `files.metadata.read` lalu klik **Submit**.
   - Salin **App key** dari tab **Settings** (tidak perlu *App secret* karena aplikasi memakai PKCE S256; Anda juga dapat menyetel env var `DROPBOX_APP_KEY` di Cloudflare Pages agar App Key terisi otomatis).
   - Di aplikasi menu **Pengaturan → Sinkronisasi → Dropbox**, masukkan App Key, klik **"1. Buka Halaman Izin Dropbox"** → klik **Allow** → salin kode otorisasi yang muncul di layar → tempel ke kolom kode dan klik **"Hubungkan"**.
   - Refresh token tersimpan otomatis permanen, dan data disimpan terstruktur di folder `/Biopond-BSF` (`info.json` + file koleksi terpisah per tabel).
3. **WebDAV (Nextcloud / OwnCloud / NAS)**:
   - Masukkan URL lengkap file JSON WebDAV beserta Username dan App Password. Pastikan server WebDAV mengizinkan **CORS** untuk domain aplikasi Anda.
4. **Kode Pairing Cepat untuk Perangkat ke-2+**:
   - Setelah Cloud Sync aktif di perangkat utama, ketuk **"Buat Kode Pairing / QR untuk HP ke-2"** di menu Pengaturan.
   - Di HP ke-2, cukup scan QR pairing, masukkan **Kode Pendek 8 karakter** (`4829-K7M9`, terenkripsi AES-GCM di `/api/sync?pair=` dengan TTL 15 menit & sekali pakai), atau tempel token **`BSFPAIR:v1:...`** untuk langsung menyalin koneksi cloud dan menarik semua data.

---

## 6. Menjalankan Aplikasi Secara Lokal / Offline (Mode Mandiri)

Aplikasi ini dirancang **100% resilien tanpa backend**. Ketika `/api/register` atau `/api/config` tidak tersedia (misal saat dibuka secara lokal, offline di kandang, atau di-host di static server biasa), aplikasi tetap berjalan normal tanpa error:

### Opsi A: Menggunakan Server Lokal Sederhana
Jika Anda mengunduh repositori secara lokal, cukup jalankan server statis apa saja di folder proyek:

```bash
# Menggunakan Node.js (npx)
npx serve .

# Atau menggunakan Python 3
python3 -m http.server 3000
```

Lalu buka `http://localhost:3000` di browser HP atau desktop (gunakan Inspect Element → mode Device Toolbar untuk tampilan mobile, atau langsung akses dari HP dalam satu jaringan Wi-Fi).

### Opsi B: Menggunakan Vite Dev Server (Jika Menggunakan Proyek Build)
```bash
npm install
npm run dev
```

### Yang Tetap Berjalan Penuh di Mode Mandiri (Tanpa Backend):
- Seluruh pencatatan **Dashboard**, **Checklist Harian**, **Biopond Batch Tracker**, **Log Sampah**, **Panen**, dan **Air Lindi** tersimpan penuh di IndexedDB lokal.
- **Kalkulator Penetasan (Nursery)** dan **Kalkulator Daya Makan Harian** berjalan 100% offline.
- **Pengingat Kalender** tetap tersedia melalui tombol **"Pasang ke Kalender (.ICS / Link)"** pada setiap kartu biopond (unduh file `.ics` secara offline atau buka link template Google Calendar).
- **Diagnosa AI (BYOK)** tetap berjalan langsung dari browser ke API Google Gemini / OpenRouter / Groq / OpenAI selama perangkat terhubung internet dan API Key sudah diisi di menu Pengaturan.
- **Backup & Restore JSON** tetap berjalan 100% offline untuk memindahkan data antar perangkat.

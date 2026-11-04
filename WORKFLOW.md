# Project Workflow, SOP Operasional & Development Roadmap (`WORKFLOW.md`)
## Sistem Informasi Absensi, Nilai, & Dokumentasi Pembelajaran Siswa Terintegrasi Orang Tua

Dokumen ini berisi **Alur Kerja Operasional Harian (SOP Sekolah)**, **Peta Jalan Pengembangan Bertahap (Development Roadmap Phase 1–5)**, **Konfigurasi Environment Gratis**, serta **Checklist Pengujian (QA)** untuk pengembangan di masa mendatang.

---

## 1. Alur Kerja Operasional Harian di Sekolah (Daily School SOP Workflow)

Diagram dan tahapan di bawah ini menjelaskan bagaimana sistem digunakan dari pagi hingga sore hari oleh seluruh pihak di sekolah:

```mermaid
flowchart TD
    subgraph Pagi ["🌅 06:00 - 07:30 WIB: Absensi Kedatangan & Izin"]
        A1["Orang Tua mengajukan Izin/Sakit\nvia Web + Upload Surat (Jika anak sakit)"]
        A2["Siswa tiba di sekolah &\nScan Kartu QR di Gerbang / Piket"]
        A3["Sistem mencatat Jam Tiba\n(Tepat Waktu / Terlambat)"]
        A4["Notifikasi WA Terjadwal\ndikirim ke Orang Tua"]
    end

    subgraph KBM ["☀️ 07:30 - 14:30 WIB: Kegiatan Belajar Mengajar (Per Jam Mapel)"]
        B1["Guru Mapel masuk kelas &\nbuka menu Jurnal Kelas di HP"]
        B2["Status hadir siswa otomatis terisi\ndari data Scan Gerbang & Surat Izin"]
        B3["Guru memvalidasi siswa (cek jika ada yang bolos)\n& klik Badge Keaktifan Belajar"]
        B4["Guru memotret Dokumentasi Kelas\n(Otomatis dikompres ke WebP < 180KB)"]
        B5["Guru menginput Nilai Tugas / Kuis / UH\n(Jika ada pengambilan nilai)"]
        B6["Data langsung tampil Real-Time\ndi Portal Orang Tua"]
    end

    subgraph Sore ["🌇 14:30 - 16:00 WIB: Kepulangan & Rekap"]
        C1["Siswa Scan QR Pulang di Gerbang\n(Opsional sesuai kebijakan sekolah)"]
        C2["Sistem mengkalkulasi Rekap Harian &\nDeteksi Siswa Alpa / Bermasalah"]
        C3["Orang Tua melihat Timeline Lengkap:\nAbsen + Foto Dokumentasi + Nilai Anak"]
    end

    A1 --> B2
    A2 --> A3 --> A4
    A3 --> B2
    B1 --> B2 --> B3 --> B4 --> B5 --> B6 --> C1 --> C2 --> C3
```

### Penanganan Kondisi Khusus (Edge Cases di Lapangan):
1. **Bagaimana jika Kartu QR Siswa Tertinggal atau Rusak?**
   - Petugas piket di gerbang atau guru di kelas memiliki fitur **Pencarian Cepat Nama / NIS** di layar scanner untuk mencatat kehadiran manual dengan penanda *"Tanpa Kartu"*.
2. **Bagaimana jika Siswa Terlambat Datang Saat Jam Pelajaran ke-2 Sudah Dimulai?**
   - Saat siswa scan QR di gerbang pada pukul 07:45, status gerbang tercatat **Terlambat (30 menit)**, dan sistem otomatis memperbarui status siswa untuk jam pelajaran berikutnya menjadi hadir di sekolah.
3. **Bagaimana jika Koneksi Internet di Kelas Sedang Lemah Saat Guru Memotret Dokumentasi?**
   - Karena foto dikompresi terlebih dahulu di perangkat guru menjadi ukuran sangat kecil (`~140 KB`), pengunggahan tetap berhasil meskipun hanya menggunakan jaringan sinyal seluler rendah (3G/4G lemah).

---

## 2. Peta Jalan Pengembangan Bertahap (Development Roadmap)

Saat Anda siap mulai menulis kode (*coding*), ikuti urutan **5 Fase Pengembangan** ini agar pengerjaan terarah dan tidak tumpang tindih:

### Phase 1: Foundation, Database Schema & Master Data (Minggu 1)
- [ ] Inisialisasi project **Next.js (TypeScript + Tailwind CSS)** atau setup project **Google Apps Script**.
- [ ] Setup database gratis di **Supabase PostgreSQL** dan jalankan migrasi skema tabel sesuai `ARCHITECTURE.md`.
- [ ] Buat sistem **Authentication & Role-Based Access Control (RBAC)** untuk 4 role utama (`ADMIN`, `TEACHER`, `PARENT`, `SCANNER`).
- [ ] Buat halaman **Master Data Admin**:
  - CRUD Tahun Ajaran, Kelas, Mata Pelajaran, Guru, Siswa, dan Orang Tua.
  - Fitur **Import Data Siswa & Orang Tua via Excel (`.xlsx`)**.
  - Fitur **Relasi Orang Tua - Siswa (`parent_student_links`)** agar 1 akun orang tua bisa terhubung ke >1 anak.

### Phase 2: Generator Kartu QR & Modul Absensi Dual-Layer (Minggu 2)
- [ ] Buat **Generator Token QR Unik** untuk setiap siswa (`SHD.<short_id>.<hash>`).
- [ ] Buat fitur **Cetak Kartu Pelajar QR Code Massal (PDF)** per kelas.
- [ ] Bangun halaman **Gate QR Scanner (Kedatangan & Kepulangan)**:
  - Integrasi kamera web (`html5-qrcode`) + dukungan Barcode Scanner USB 2D.
  - Tampilan pop-up verifikasi foto wajah siswa + audio *beep* sukses/gagal.
  - Pencegahan *double-scan* dalam rentang 5 menit.
- [ ] Bangun fitur **Pengajuan Izin / Sakit Online** dari sisi Orang Tua beserta halaman persetujuan (*Approve/Reject*) oleh Wali Kelas.

### Phase 3: Jurnal Kelas, Nilai & Bukti Dokumentasi Terkompresi (Minggu 3)
- [ ] Bangun halaman **Jurnal Mengajar & Absensi Kelas (Guru Mapel)**:
  - Fitur *Auto Pre-fill* daftar hadir kelas berdasarkan data Scan Gerbang pagi & Izin yang disetujui.
  - Tombol **Quick Engagement Badge** (`🌟 Aktif`, `✅ Baik`, `⚠️ Kurang Fokus`, `❌ Tidak Kumpul Tugas`).
- [ ] Bangun modul **Upload Dokumentasi Pembelajaran**:
  - Integrasi *Client-Side Image Compression* (otomatis ubah foto kamera ke WebP maks `180 KB`).
  - Integrasi penyimpanan gratis ke **Cloudinary / Supabase Storage / Google Drive**.
  - Opsi visibilitas: *Publik Satu Kelas* atau *Tag Siswa Tertentu*.
- [ ] Bangun modul **Input & Rekap Nilai Akademik**:
  - Kategori penilaian (`Tugas`, `Kuis`, `UH`, `PTS`, `PAS`).
  - Input nilai cepat per kelas + indikator otomatis ketuntasan KKM.

### Phase 4: Portal Orang Tua (PWA) & Integrasi WhatsApp Gateway (Minggu 4)
- [ ] Bangun **Dashboard Mobile Orang Tua**:
  - Komponen **Child Switcher** (pindah profil anak bagi orang tua yang punya >1 anak).
  - **Timeline Kehadiran & KBM Hari Ini** secara *real-time*.
  - Halaman **Galeri Foto Dokumentasi Kelas** dan halaman **Transparansi Nilai & Keaktifan**.
- [ ] Konfigurasi **Progressive Web App (`manifest.json` & Service Worker)** agar orang tua dapat meng-install website ke layar utama HP Android/iOS.
- [ ] Integrasi **WhatsApp Gateway (Fonnte / Wablas)**:
  - Buat sistem antrean (`wa_notification_logs`) dengan jeda acak (*random delay* 4–10 detik) dan format pesan *Spintax*.

### Phase 5: Rekapitulasi, Export Laporan & Deployment Gratis (Minggu 5)
- [ ] Bangun halaman **Matriks Rekap Absensi Bulanan & Semester** (Tabel tanggal 1–31 + perhitungan otomatis `H, S, I, A, T` dan `% Kehadiran`).
- [ ] Tambahkan panel **Early Warning System** (deteksi otomatis siswa sering Alpa/Terlambat/Nilai di bawah KKM).
- [ ] Buat fitur **Export Rekap ke Excel (`.xlsx`)** dan **Cetak Laporan PDF Resmi Sekolah**.
- [ ] Lakukan pengujian menyeluruh dan deploy ke **Vercel (Production)**.

---

## 3. Panduan Konfigurasi Layanan Gratis (Zero-Cost Setup Guide)

Berikut adalah daftar variabel lingkungan (`.env.example`) yang dibutuhkan saat memulai tahap coding:

```env
# 1. DATABASE GRATIS (Supabase PostgreSQL - Free Tier 500MB)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# 2. AUTHENTICATION & QR SECURITY
NEXTAUTH_SECRET="rahasia-panjang-acak-untuk-session-jwt"
QR_SIGNING_SECRET="kunci-rahasia-penandatangan-kartu-qr-siswa"

# 3. PENYIMPANAN FOTO DOKUMENTASI GRATIS (Pilih Salah Satu: Cloudinary 25GB atau Supabase Storage 1GB)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="nama-cloud-sekolah"
CLOUDINARY_API_KEY="1234567890"
CLOUDINARY_API_SECRET="abcdefg-secret"

# 4. WHATSAPP GATEWAY (Fonnte / Wablas)
WA_GATEWAY_PROVIDER="FONNTE"
WA_GATEWAY_API_URL="https://api.fonnte.com/send"
WA_GATEWAY_TOKEN="token-device-whatsapp-sekolah"
WA_ENABLE_INSTANT_NORMAL_ATTENDANCE="false" # Set true jika hadir biasa juga kirim WA, false jika hanya Terlambat/Alpa/Sakit

# 5. PENGATURAN JAM SEKOLAH DEFAULT
SCHOOL_NAME="SMA Harapan Bangsa"
GATE_LATE_THRESHOLD="07:15" # Lewat dari jam ini otomatis berstatus TERLAMBAT
GATE_CHECKOUT_START="14:00" # Mulai jam scan pulang
```

---

## 4. Standar Git Workflow & Konvensi Kode

Jika proyek ini dikerjakan secara bertahap atau bersama tim di masa depan:
- **Branching Strategy:**
  - `main`: Branch produksi yang terhubung otomatis ke Vercel.
  - `dev`: Branch integrasi pengembangan.
  - `feat/<nama-fitur>`: Contoh `feat/qr-scanner`, `feat/parent-dashboard`, `feat/grade-recap`.
- **Format Commit Message (Conventional Commits):**
  - `feat(attendance): add gate QR scanner with face verification popup`
  - `feat(documentation): implement client-side WebP compression under 180KB`
  - `feat(grades): add daily engagement badges and KKM indicator`
  - `fix(wa-gateway): add random delay queue to prevent number ban`

---

## 5. Checklist Pengujian (Quality Assurance / Verification Checklist)

Sebelum sistem diluncurkan ke guru dan orang tua siswa, pastikan seluruh poin pengujian berikut terpenuhi:

1. **Uji Kecepatan & Keamanan QR Scanner:**
   - [ ] Kartu QR dapat terbaca kamera HP/Laptop dalam waktu `< 1 detik`.
   - [ ] Scan kartu yang sama dua kali dalam 1 menit tidak menghasilkan data ganda di rekap.
   - [ ] Layar menampilkan foto profil siswa dengan jelas untuk mencegah titip absen.
2. **Uji Kompresi Dokumentasi:**
   - [ ] Unggah foto ukuran `5 MB` dari kamera HP, pastikan file yang tersimpan di server berukuran `< 200 KB` dengan format `.webp`.
   - [ ] Foto dokumentasi kelas hanya bisa dilihat oleh orang tua yang anaknya berada di kelas tersebut.
3. **Uji Akurasi Rekapitulasi:**
   - [ ] Rumus persentase kehadiran bulanan menghitung `(Total Hadir / Hari Efektif) * 100%` dengan akurat.
   - [ ] File hasil export Excel (`.xlsx`) dan PDF menampilkan jumlah `H, S, I, A, T` dan rata-rata nilai yang sama persis dengan tampilan di layar web.
4. **Uji Keamanan Hak Akses Orang Tua:**
   - [ ] Orang tua Siswa A **tidak dapat** mengakses URL detail nilai atau absensi Siswa B meskipun mengganti parameter ID di browser.
   - [ ] Orang tua yang memiliki 2 anak (kakak-adik) dapat berpindah tampilan anak melalui fitur *Child Switcher* tanpa perlu logout.


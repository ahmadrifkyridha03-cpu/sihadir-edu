# System Architecture & Technical Specification (`ARCHITECTURE.md`)
## Sistem Informasi Absensi, Nilai, & Dokumentasi Pembelajaran Siswa Terintegrasi Orang Tua

Dokumen ini menjabarkan arsitektur sistem, perbandingan *Tech Stack* gratis (**Vercel** vs **Google Apps Script**), desain skema database (**ERD**), alur data (*Sequence Diagram*), mekanisme kompresi dokumentasi, serta arsitektur antrean **WhatsApp Gateway**.

---

## 1. Perbandingan & Pemilihan Tech Stack Gratis (Free Tier)

Sesuai kebutuhan proyek untuk di-deploy secara **gratis** di **Vercel** atau **Google Apps Script (GAS)**, berikut adalah analisis teknis kedua arsitektur beserta rekomendasi utamanya:

### 1.1 Tabel Perbandingan Arsitektur

| Komponen / Aspek | **Opsi A (REKOMENDASI UTAMA): Modern Cloud Stack (Vercel + Supabase + Cloudinary)** | **Opsi B (ALTERNATIF): Google Workspace Stack (Google Apps Script + Sheets + Drive)** |
| :--- | :--- | :--- |
| **Frontend & Hosting** | **Next.js (App Router) + Tailwind CSS** di-deploy di **Vercel (Free Hobby Plan)** | **HTML/CSS/JS (React via Vite SingleFile)** di-deploy di **Google Apps Script Web App** |
| **Backend / API** | Next.js Server Actions & Route Handlers (Serverless Functions di Vercel) | Fungsi `google.script.run` & `doGet/doPost` pada Google Apps Script |
| **Database Utama** | **Supabase PostgreSQL (Free Tier: 500 MB)** – Sanggup menyimpan >1.500.000 baris data absensi & nilai | **Google Sheets** (Batas maks: 10 juta sel, mulai lambat ketika >5.000 baris) |
| **Penyimpanan Foto Dokumentasi** | **Cloudinary Free Tier (25 GB)** atau **Supabase Storage (1 GB)** + Kompresi WebP (<180 KB/foto) | **Google Drive Folder** (Kuota 15 GB per akun Google gratis) |
| **Kecepatan Scan QR** | **Sangat Cepat (< 300 ms)** – Koneksi langsung ke database indeks PostgreSQL + Local Cache | **Lambat (2 – 4 detik per scan)** – Karena overhead eksekusi Apps Script & pembacaan baris Spreadsheet |
| **Dukungan PWA & Kamera** | **Penuh** (Bisa di-install ke layar utama HP Orang Tua & Guru, akses kamera tanpa kendala iframe) | **Terbatas** (Berjalan di dalam sandboxed `<iframe>` milik `script.googleusercontent.com`) |
| **Batas Kuota Harian** | Bandwidth 100 GB/bulan di Vercel (Sangat lega untuk sekolah menengah/besar) | Eksekusi skrip maksimal **90 menit/hari** & maksimal **30 pengguna bersamaan** |
| **Kesimpulan Penggunaan** | **Paling Optimal** untuk sekolah umum (100 – 1.500 siswa), cepat, profesional, dan tetap 100% gratis. | Cocok jika sekolah hanya memiliki <150 siswa atau ingin seluruh datanya langsung berbentuk Spreadsheet. |

> [!TIP]
> **Rekomendasi Arsitektur Hybrid Terbaik:**  
> Gunakan **Opsi A (Next.js di Vercel + Supabase PostgreSQL + Cloudinary)** sebagai sistem utama agar aplikasi sangat cepat saat Scan QR dan nyaman dibuka oleh Orang Tua, lalu tambahkan **Fitur Export / Sinkronisasi 1-Klik ke Google Sheets / Excel** untuk staf TU yang gemar mengolah data di Spreadsheet.
> *(Catatan: Di bagian bawah dokumen ini juga disertakan panduan struktur jika Anda tetap ingin mengeksekusi Opsi B di Google Apps Script).*

---

## 2. Diagram Arsitektur Tingkat Tinggi (High-Level Architecture)

```mermaid
flowchart TB
    subgraph Client_Layer ["Client Layer (Mobile & Desktop Browser / PWA)"]
        GateKiosk["📱/💻 Gate QR Scanner\n(Petugas Piket / Kiosk)"]
        TeacherApp["📱 Web App Guru\n(Jurnal, Absen Kelas, Nilai, Kamera Dokumentasi)"]
        ParentApp["📱 Portal Orang Tua (PWA)\n(Monitoring Hadir, Nilai, Galeri Foto, Izin)"]
        AdminApp["💻 Dashboard Admin / Wali Kelas\n(Master Data, Cetak QR, Rekap Excel/PDF)"]
    end

    subgraph Edge_Frontend ["Application Layer (Vercel Free Tier)"]
        NextApp["Next.js Fullstack App\n(App Router + React + Tailwind CSS)"]
        ImgCompressor["Client-Side Image Compressor\n(Canvas WebP < 180KB)"]
        QRScannerEngine["HTML5-QRCode + Local Cache\n(Anti-Lag Scanner)"]
        API_Routes["Server Actions & REST API\n(/api/attendance, /api/grades, /api/wa-webhook)"]
    end

    subgraph Data_Storage ["Data & Media Layer (Free Tier Cloud)"]
        SupabaseDB[("Supabase PostgreSQL\n(Data Siswa, Absen, Nilai, Jurnal)")]
        CloudStorage[("Cloudinary / Supabase Storage\n(Foto Dokumentasi & Surat Izin)")]
    end

    subgraph External_Services ["External Notification Layer"]
        WAGateway["WhatsApp Gateway API\n(Fonnte / Wablas)"]
        ParentWA["💬 WhatsApp Orang Tua"]
    end

    GateKiosk --> QRScannerEngine
    TeacherApp --> ImgCompressor
    TeacherApp --> NextApp
    ParentApp --> NextApp
    AdminApp --> NextApp
    QRScannerEngine --> API_Routes
    ImgCompressor --> CloudStorage
    NextApp --> API_Routes
    API_Routes --> SupabaseDB
    API_Routes --> CloudStorage
    API_Routes -->|"Queue + Delay"| WAGateway
    WAGateway --> ParentWA
```

---

## 3. Alur Sistem Utama (Sequence Diagrams)

### 3.1 Alur Scan QR Code Siswa & Notifikasi WhatsApp Anti-Banned
Diagram berikut menjelaskan bagaimana proses Scan QR bekerja dalam hitungan milidetik sekaligus mencegah pemblokiran nomor WhatsApp sekolah:

```mermaid
sequenceDiagram
    autonumber
    actor Siswa as Siswa (Kartu QR)
    participant Scanner as Perangkat Scanner (Gerbang/Guru)
    participant Server as Vercel API / Backend
    participant DB as Database (PostgreSQL)
    participant Queue as WA Notification Queue
    participant WA as Fonnte / Wablas API
    actor Ortu as Orang Tua (WA & Web)

    Siswa->>Scanner: Tunjukkan Kartu QR Code (Token Unik)
    Scanner->>Scanner: Validasi format token & bunyi Beep
    Scanner->>Server: POST /api/attendance/scan { qr_token, scan_type: "GATE_IN" }
    Server->>DB: Cek data Siswa & Jadwal Jam Masuk
    DB-->>Server: Data Siswa + Foto + Status (Tepat Waktu / Terlambat)
    Server->>DB: Simpan ke tabel gate_attendances
    Server-->>Scanner: Return 200 OK (Tampilkan Foto Wajah Siswa + Nama + Status)
    
    alt Status == Terlambat ATAU Mode WA Instan Aktif
        Server->>DB: Insert ke tabel wa_notification_logs (status: PENDING)
        Note over Server,Queue: Background Worker / Cron dengan Jeda Acak 4-8 detik
        Queue->>WA: POST /send (Pesan Dinamis Spintax ke No WA Ortu)
        WA-->>Ortu: Terima Pesan WA Kehadiran Anak
        WA-->>Queue: Callback Status SENT
        Queue->>DB: Update wa_notification_logs (status: SENT)
    end

    Ortu->>Server: Buka Dashboard Web Orang Tua
    Server-->>Ortu: Tampilkan Timeline Real-Time (Jam Tiba, Mapel, Dokumentasi, Nilai)
```

### 3.2 Alur Input Jurnal, Nilai, & Kompresi Foto Dokumentasi oleh Guru

```mermaid
sequenceDiagram
    autonumber
    actor Guru as Guru Mapel (HP)
    participant Browser as Browser Client (Canvas WebP)
    participant Storage as Cloud Storage (Cloudinary/Supabase)
    participant API as Backend Server
    participant DB as Database
    actor Ortu as Dashboard Orang Tua

    Guru->>Browser: Buka Kelas & Mapel (Misal: Matematika X-1)
    Browser->>API: GET /api/classroom/pre-fill?class_id=X1&date=today
    API->>DB: Ambil daftar siswa + status Scan Gerbang pagi + Izin/Sakit
    DB-->>Browser: Daftar 35 siswa otomatis berstatus "Hadir" (sesuai gerbang)
    Guru->>Browser: Ubah status jika ada yang bolos + klik Badge Keaktifan
    Guru->>Browser: Ambil Foto Dokumentasi Kelas (Ukuran asli: 4.2 MB)
    Browser->>Browser: Kompresi otomatis ke WebP 1280px (Ukuran baru: 145 KB)
    Browser->>Storage: Upload file WebP (145 KB)
    Storage-->>Browser: Return image_url
    Guru->>Browser: Klik "Simpan Jurnal & Dokumentasi" (Opsional: Input Nilai Tugas)
    Browser->>API: POST /api/journals/create { attendance_list, grades, image_url, topic }
    API->>DB: Simpan ke class_journals, subject_attendances, grades, documentations
    DB-->>Ortu: Tampil instan di Feed Dokumentasi & Rekap Nilai Orang Tua
```

---

## 4. Desain Skema Database & Entity Relationship Diagram (ERD)

Skema database dirancang menggunakan **Relasi Many-to-Many** antara Orang Tua dan Siswa (mendukung orang tua yang memiliki >1 anak di sekolah yang sama), serta memisahkan **Absensi Gerbang Harian** dengan **Absensi Jurnal Mata Pelajaran**.

```mermaid
erDiagram
    USERS ||--o| TEACHERS : "has profile"
    USERS ||--o| PARENTS : "has profile"
    USERS ||--o| STUDENTS : "has profile"
    
    PARENTS ||--o{ PARENT_STUDENT_LINKS : "links to"
    STUDENTS ||--o{ PARENT_STUDENT_LINKS : "linked with"
    
    ACADEMIC_YEARS ||--o{ CLASSES : "contains"
    TEACHERS ||--o{ CLASSES : "wali kelas (homeroom)"
    CLASSES ||--o{ STUDENTS : "enrolled in"
    
    CLASSES ||--o{ SCHEDULES : "has schedule"
    SUBJECTS ||--o{ SCHEDULES : "taught in"
    TEACHERS ||--o{ SCHEDULES : "teaches"
    
    STUDENTS ||--o{ GATE_ATTENDANCES : "scans at gate"
    STUDENTS ||--o{ LEAVE_REQUESTS : "requests leave"
    PARENTS ||--o{ LEAVE_REQUESTS : "submits"
    
    SCHEDULES ||--o{ CLASS_JOURNALS : "generates session"
    CLASS_JOURNALS ||--o{ SUBJECT_ATTENDANCES : "records"
    STUDENTS ||--o{ SUBJECT_ATTENDANCES : "attends"
    
    CLASS_JOURNALS ||--o{ DOCUMENTATIONS : "has photo proof"
    SUBJECTS ||--o{ ASSESSMENTS : "has exam/task"
    ASSESSMENTS ||--o{ STUDENT_GRADES : "scores"
    STUDENTS ||--o{ STUDENT_GRADES : "receives"

    USERS {
        uuid id PK
        string name
        string phone_wa UK "Nomor WA untuk Login/Notifikasi"
        string email UK
        string password_hash
        enum role "ADMIN, TEACHER, PARENT, STUDENT, SCANNER"
        boolean is_active
        timestamp created_at
    }

    STUDENTS {
        uuid id PK
        uuid user_id FK
        uuid class_id FK
        string nis UK
        string nisn UK
        string full_name
        enum gender "L, P"
        string photo_url
        string qr_token UK "Token Hash Unik Kartu QR"
        enum status "ACTIVE, GRADUATED, MOVED"
    }

    PARENTS {
        uuid id PK
        uuid user_id FK
        string full_name
        string phone_wa UK
        string occupation
    }

    PARENT_STUDENT_LINKS {
        uuid id PK
        uuid parent_id FK
        uuid student_id FK
        enum relation "AYAH, IBU, WALI"
        boolean receive_wa_notif
    }

    CLASSES {
        uuid id PK
        uuid academic_year_id FK
        uuid homeroom_teacher_id FK "Wali Kelas"
        string class_name "Contoh: X-IPA-1"
        int grade_level "7,8,9 atau 10,11,12"
    }

    SUBJECTS {
        uuid id PK
        string subject_code UK "MTK, BIN, IPA"
        string subject_name
        int kkm_score "Kriteria Ketuntasan Minimal (misal 75)"
    }

    GATE_ATTENDANCES {
        uuid id PK
        uuid student_id FK
        date attendance_date
        timestamp check_in_time
        timestamp check_out_time
        enum status "HADIR, TERLAMBAT, IZIN, SAKIT, ALPA"
        int late_minutes "Menit terlambat"
        string scanned_by "ID Petugas / Kiosk"
    }

    CLASS_JOURNALS {
        uuid id PK
        uuid schedule_id FK
        uuid class_id FK
        uuid subject_id FK
        uuid teacher_id FK
        date journal_date
        int period_start "Jam ke-"
        int period_end "Sampai jam ke-"
        string topic_material "Materi yang diajarkan"
        text teacher_notes
        timestamp created_at
    }

    SUBJECT_ATTENDANCES {
        uuid id PK
        uuid journal_id FK
        uuid student_id FK
        enum status "HADIR, SAKIT, IZIN, ALPA_BOLOS"
        enum engagement_badge "ACTIVE_STAR, GOOD, LESS_FOCUS, NO_TASK"
        string note "Catatan keaktifan per siswa"
    }

    DOCUMENTATIONS {
        uuid id PK
        uuid journal_id FK
        string image_url "URL Foto WebP (<180KB)"
        string caption "Keterangan kegiatan"
        enum visibility "CLASS_PUBLIC, TAGGED_STUDENTS_ONLY"
        jsonb tagged_student_ids "Array UUID siswa jika spesifik"
        int file_size_kb
        timestamp created_at
    }

    ASSESSMENTS {
        uuid id PK
        uuid class_id FK
        uuid subject_id FK
        uuid teacher_id FK
        uuid journal_id FK "Opsional: terhubung ke sesi pertemuan"
        string title "Contoh: UH Bab 1 Aljabar"
        enum category "TUGAS, KUIS, PRAKTIKUM, UH, PTS, PAS"
        date assessment_date
        int max_score "Default 100"
    }

    STUDENT_GRADES {
        uuid id PK
        uuid assessment_id FK
        uuid student_id FK
        decimal score "Nilai 0.00 - 100.00"
        string teacher_feedback "Komentar guru"
        timestamp updated_at
    }

    LEAVE_REQUESTS {
        uuid id PK
        uuid student_id FK
        uuid parent_id FK
        date start_date
        date end_date
        enum leave_type "SAKIT, IZIN"
        text reason
        string attachment_url "Foto Surat Dokter / Bukti"
        enum approval_status "PENDING, APPROVED, REJECTED"
        uuid approved_by FK "Wali Kelas / Piket"
        timestamp created_at
    }

    WA_NOTIFICATION_LOGS {
        uuid id PK
        uuid student_id FK
        string target_phone
        enum notif_type "GATE_LATE, GATE_IN, ABSENT_ALERT, GRADE_UPDATE, DAILY_DIGEST"
        text message_body
        enum status "QUEUED, SENT, FAILED"
        timestamp scheduled_at
        timestamp sent_at
    }
```

---

## 5. Detail Teknis Modul Krusial

### 5.1 Spesifikasi Teknis QR Code & Anti-Titip Absen
1. **Struktur Payload QR Code:**
   - Jangan gunakan NIS mentah (misal `2026001`) karena siswa mudah membuat barcode palsu menggunakan generator online untuk menjahili temannya.
   - Gunakan format **Signed Token Pendek**: `SHD.<student_short_id>.<hmac_signature_8char>` (contoh: `SHD.8f92a1.c49b01e2`).
   - Panjang karakter sekitar 20 karakter membuat matriks QR Code memiliki kerapatan rendah (*Low Density*), sehingga **sangat cepat terbaca oleh kamera HP murah sekalipun** dari jarak 20–30 cm.
2. **Alur Cooldown & Duplikasi Scan:**
   - Jika siswa yang sama men-scan kartu 2 kali berturut-turut dalam waktu `< 5 menit`, sistem mengabaikan scan kedua dan menampilkan pesan *"Sudah tercatat hadir pada pukul 06:54"*.
   - Scan di bawah jam `11:00` otomatis masuk sebagai `check_in_time` (Kedatangan), sedangkan scan di atas jam `13:00` (atau sesuai pengaturan jam pulang sekolah) otomatis mengisi `check_out_time` (Kepulangan).

### 5.2 Spesifikasi Kompresi Dokumentasi (Client-Side Image Compression)
Agar penyimpanan gratis tidak pernah penuh, pengunggahan foto pada form Guru maupun form Surat Izin Orang Tua wajib melewati pipeline berikut di sisi browser:
```typescript
// Spesifikasi Parameter Kompresi Gambar di Browser sebelum Upload
const compressionOptions = {
  maxSizeMB: 0.18,          // Maksimal 180 KB per foto
  maxWidthOrHeight: 1280,   // Resolusi HD 1280px (sangat tajam di layar HP & Laptop)
  useWebWorker: true,       // Tidak membuat UI browser macet/freeze
  fileType: 'image/webp',   // Format WebP hemat ukuran 70% dibanding JPEG
  initialQuality: 0.78      // Kualitas visual optimal
};
```
**Perhitungan Kapasitas Gratis:**
- Dengan rata-rata `150 KB` per foto:
  - **Supabase Storage Gratis (1 GB):** Muat sekitar **~6.800 foto dokumentasi**.
  - **Cloudinary Gratis (25 GB):** Muat sekitar **~160.000 foto dokumentasi** (cukup untuk >5 tahun operasional sekolah tanpa biaya sepeser pun).

### 5.3 Integrasi WhatsApp Gateway & Mekanisme Anti-Banned
Menggunakan penyedia gateway lokal ramah kantong/gratis trial seperti **Fonnte** atau **Wablas**:
- **Payload Pengiriman Webhook:**
  - Mendukung pengiriman pesan dengan parameter `delay: "4-10"` (Fonnte memiliki fitur bawaan jeda acak di sisi server mereka jika dikirim sekaligus).
- **Template Pesan Spintax (Variasi Otomatis):**
  ```text
  {Assalamu'alaikum|Selamat Pagi|Halo} Bapak/Ibu {nama_ortu},
  Kami menginformasikan bahwa putra/putri Anda:
  👤 Nama: *{nama_siswa}* ({kelas})
  🕒 Waktu Scan: {jam_scan} WIB
  📌 Status: *{status_kehadiran}*
  
  Pantau foto dokumentasi belajar & nilai harian melalui portal orang tua:
  🔗 {link_portal_ortu}
  ```

---

## 6. Struktur Direktori Project (Project Directory Structure)

### 6.1 Struktur Project untuk Opsi A (Next.js App Router - Deploy di Vercel)
```text
d:\WEBSITE ABSENSI\
├── prisma/
│   ├── schema.prisma              # Skema Database PostgreSQL (Supabase)
│   └── seed.ts                    # Data awal (Admin, Contoh Kelas, Siswa, Ortu)
├── public/
│   ├── manifest.json              # Konfigurasi PWA (Agar bisa di-install di HP)
│   ├── sounds/
│   │   ├── beep-success.mp3       # Efek suara scan QR berhasil
│   │   └── beep-error.mp3         # Efek suara scan QR gagal / tidak dikenal
│   └── icons/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/             # Login Guru, Admin, & Orang Tua (No WA + PIN)
│   │   ├── (scanner)/
│   │   │   └── gate-scanner/      # Layar Kiosk/Piket Scan QR Code Gerbang
│   │   ├── (teacher)/
│   │   │   ├── dashboard/         # Jadwal mengajar hari ini
│   │   │   ├── journal/[id]/      # Absen kelas + Keaktifan + Upload Dokumentasi
│   │   │   └── grades/            # Input & rekap nilai (Tugas, UH, PTS, PAS)
│   │   ├── (parent)/
│   │   │   ├── parent-dashboard/  # Timeline anak hari ini + Child Switcher
│   │   │   ├── documentations/    # Feed galeri foto kegiatan kelas anak
│   │   │   ├── grades-report/     # Riwayat nilai & keaktifan belajar anak
│   │   │   └── leave-request/     # Form pengajuan Izin / Sakit + upload surat
│   │   ├── (admin)/
│   │   │   ├── master-data/       # CRUD Siswa, Ortu, Guru, Kelas, Mapel, Import Excel
│   │   │   ├── qr-cards/          # Generator cetak kartu QR siswa massal (PDF)
│   │   │   ├── recap-attendance/  # Matriks rekap absensi bulanan & export Excel/PDF
│   │   │   └── wa-settings/       # Konfigurasi WhatsApp Gateway & log pesan
│   │   └── api/
│   │       ├── attendance/scan/   # Endpoint super cepat pencatatan QR Code
│   │       ├── upload/            # Endpoint tanda tangan upload foto dokumentasi
│   │       └── cron/wa-digest/    # Endpoint pengiriman rangkuman WA harian
│   ├── components/
│   │   ├── qr/                    # Komponen Kamera QR Scanner & Kartu QR Cetak
│   │   ├── media/                 # Komponen Camera Capture + WebP Compressor
│   │   ├── charts/                # Grafik tren kehadiran & nilai siswa
│   │   └── ui/                    # Komponen dasar (Button, Badge, Modal, Table)
│   └── lib/
│       ├── db.ts                  # Koneksi Prisma Client
│       ├── auth.ts                # Manajemen Sesi & Role-Based Access Control
│       ├── image-compression.ts   # Utilitas kompresi foto <180KB
│       ├── whatsapp.ts            # Integrasi Fonnte/Wablas + Spintax Formatter
│       └── export-excel-pdf.ts    # Generator laporan Excel (.xlsx) & PDF
├── PRD.md
├── ARCHITECTURE.md
├── DESIGN.md
└── WORKFLOW.md
```

### 6.2 Catatan Arsitektur Jika Menggunakan Opsi B (Google Apps Script)
Apabila di masa depan Anda ingin membuat versi ringan khusus untuk **Google Apps Script + Google Sheets**, struktur datanya disederhanakan menjadi:
- **1 File Google Spreadsheet** dengan 9 Sheet: `Users`, `Students`, `Parents`, `Classes_Subjects`, `Gate_Attendances`, `Class_Journals`, `Subject_Attendances`, `Grades`, dan `Documentations`.
- **1 Folder Google Drive** khusus untuk menampung file WebP hasil kompresi (disimpan menggunakan `DriveApp.getFolderById(FOLDER_ID).createFile(blob)` dan diambil URL thumbnail-nya `https://drive.google.com/thumbnail?id=FILE_ID&sz=w1000`).
- **Optimasi Wajib di GAS:** Gunakan `CacheService.getScriptCache()` untuk menyimpan daftar siswa dan token QR selama 6 jam agar saat scan QR tidak perlu membaca seluruh baris Google Sheets berulang kali.


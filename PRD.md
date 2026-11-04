# Product Requirements Document (PRD)
## Sistem Informasi Absensi, Nilai, & Dokumentasi Pembelajaran Siswa Terintegrasi Orang Tua (SiHadir-Edu)

**Versi Dokumen:** 1.0.0  
**Target Institusi:** Sekolah Umum (SD / SMP / SMA / SMK)  
**Metode Absensi Utama:** Scan QR Code / Barcode Kartu Siswa + Validasi Jurnal Kelas Guru  
**Target Deployment:** 100% Free-Tier Cloud (Vercel + Supabase / Google Apps Script)  
**Saluran Notifikasi:** Dashboard Web (PWA) Orang Tua + WhatsApp Gateway (Fonnte / Wablas)

---

## 1. Ringkasan Eksekutif (Executive Summary)

### 1.1 Latar Belakang Masalah
Banyak sekolah masih menghadapi kesenjangan komunikasi dengan orang tua terkait kehadiran dan aktivitas belajar siswa di sekolah:
1. **Ketidakpastian Kehadiran:** Orang tua mengira anaknya berada di sekolah, padahal siswa terlambat, membolos sebelum sampai gerbang, atau hadir pagi hari tetapi kabur pada jam pelajaran tertentu (*bolos jam pelajaran*).
2. **Kurangnya Bukti Mengikuti Pembelajaran:** Kehadiran fisik di kelas belum tentu berarti siswa benar-benar mengikuti kegiatan belajar mengajar (KBM). Orang tua baru mengetahui masalah nilai saat pembagian rapor di akhir semester.
3. **Minimnya Transparansi Visual:** Orang tua tidak memiliki gambaran nyata mengenai aktivitas pembelajaran di kelas (apakah ada praktikum, diskusi, atau penugasan).
4. **Beban Administrasi Guru:** Rekapitulasi absensi manual di buku absen memakan waktu lama saat harus dihitung persentasenya setiap akhir bulan dan semester.

### 1.2 Solusi yang Ditawarkan
Membangun **Website Absensi Siswa Terintegrasi Orang Tua** yang menggabungkan **3 Pilar Transparansi Siswa**:
1. **Kehadiran (Absensi QR Code + Rekapitulasi Otomatis):** Memastikan siswa hadir di sekolah dan di dalam kelas pada setiap mata pelajaran.
2. **Keterlibatan Akademik (Nilai & Keaktifan Harian):** Menjadi indikator terukur bagi orang tua bahwa anaknya benar-benar mengikuti pembelajaran, mengumpulkan tugas, dan memahami materi.
3. **Bukti Visual (Dokumentasi Kelas & Kegiatan):** Foto kegiatan belajar mengajar di kelas yang diunggah oleh guru sebagai bukti autentik dan transparan kepada orang tua.

---

## 2. Analisis Mendalam: Kekurangan Ide Awal & Solusi Sistem (Gap Analysis)

Bagian ini mendokumentasikan hasil analisis kritis terhadap ide awal beserta solusi arsitektural dan operasional yang wajib diterapkan saat pengembangan:

### 2.1 Celah "Titip Absen" Kartu QR & Bolos Jam Pelajaran
* **Kekurangan pada Ide Awal:**
  Jika absensi hanya mengandalkan Scan QR Code satu kali di gerbang sekolah, siswa dapat menitipkan kartu QR miliknya kepada teman (*titip absen*). Selain itu, siswa yang sudah scan hadir di pagi hari bisa saja membolos pada jam pelajaran ke-3 atau ke-4 tanpa diketahui orang tua.
* **Solusi Sistem:**
  1. **Dual-Layer Attendance (Absen Gerbang + Absen Jurnal Mapel):**
     - **Layer 1 (Absen Gerbang - Kedatangan & Kepulangan):** Dilakukan via Scan QR Code di gerbang/kiosk sekolah untuk mencatat jam tiba dan jam pulang secara presisi.
     - **Layer 2 (Absen Kelas per Mata Pelajaran):** Saat Guru Mapel membuka kelas di aplikasi, daftar siswa otomatis terisi **"Hadir"** bagi yang sudah scan di gerbang pagi. Guru cukup melakukan pengecekan cepat (mengubah status 1–2 siswa jika ada yang membolos di jamnya) atau melakukan scan ulang dengan HP guru.
  2. **Pop-up Verifikasi Wajah & Audio Feedback:**
     Saat QR di-scan di gerbang/kelas, layar wajib menampilkan **Foto Profil Siswa berukuran besar**, Nama, Kelas, dan suara *beep* berbeda antara berhasil dan gagal, sehingga petugas/guru langsung menyadari jika wajah pembawa kartu tidak sesuai.

### 2.2 Keterbatasan Kuota Penyimpanan Gratis (Free Tier) Akibat Foto Dokumentasi
* **Kekurangan pada Ide Awal:**
  Fitur dokumentasi foto sebagai bukti ke orang tua sangat boros penyimpanan. Jika 20 kelas mengunggah masing-masing 4 foto per hari dari kamera HP modern (ukuran 3–5 MB/foto), maka dalam 1 hari dibutuhkan ~320 MB (~6,4 GB per bulan). Layanan gratis seperti Supabase Storage (limit 1 GB) atau Google Drive (limit 15 GB) akan cepat penuh.
* **Solusi Sistem:**
  1. **Mandatory Client-Side Image Compression:** Sebelum foto dikirim ke server, browser (HP Guru) wajib melakukan kompresi otomatis menggunakan HTML5 Canvas (`browser-image-compression`) mengubah resolusi ke maks `1280px` dengan format **WebP** (kualitas 0.75) sehingga ukuran file menyusut drastis menjadi **80 KB – 180 KB per foto** tanpa mengurangi kejelasan visual di layar HP orang tua.
  2. **Dokumentasi Berbasis Sesi Jurnal Kelas (1-to-Many) + Tagging Opsional:**
     Guru tidak perlu memfoto 35 siswa satu per satu. Guru cukup mengambil **1–2 foto suasana belajar kelas** saat mengisi Jurnal Mengajar. Foto tersebut otomatis muncul di beranda seluruh orang tua yang anaknya berstatus **Hadir** di sesi kelas tersebut. Jika ada kejadian khusus (misal siswa tidur di kelas, prestasi, atau melanggar), guru dapat menambahkan **Dokumentasi Spesifik Siswa (Student Tagging)**.
  3. **Auto-Cleanup / Retention Policy:** Fitur bagi Admin untuk mengarsipkan atau menghapus foto dokumentasi yang sudah berusia >1 semester setelah rapor dibagikan.

### 2.3 Risiko Guru Kewalahan Menginput Nilai Setiap Hari
* **Kekurangan pada Ide Awal:**
  Menjadikan fitur "Nilai" sebagai bukti anak mengikuti pembelajaran harian akan gagal di lapangan apabila guru dipaksa menginput angka `0–100` untuk 35 siswa setiap kali selesai mengajar. Guru akan merasa terbebani dan akhirnya mengosongkan kolom nilai.
* **Solusi Sistem:**
  Memisahkan penilaian menjadi **2 Tingkat (Two-Tier Assessment)**:
  1. **Partisipasi / Keaktifan Harian (Quick Engagement Badge):**
     Pada setiap pertemuan kelas, secara *default* semua siswa yang hadir mendapat status partisipasi **"Mengikuti dengan Baik"**. Guru hanya perlu menekan tombol *badge* pada siswa tertentu yang menonjol atau bermasalah:
     - `🌟 Sangat Aktif / Bertanya / Maju ke Depan`
     - `✅ Mengikuti Pembelajaran (Default)`
     - `⚠️ Kurang Fokus / Mengantuk / Mengobrol`
     - `❌ Tidak Mengumpulkan Tugas Harian`
  2. **Nilai Akademik Formal (Angka 0–100):**
     Digunakan khusus ketika ada pengambilan nilai resmi: **Tugas/PR, Kuis, Ulangan Harian (UH), PTS/UTS, dan PAS/UAS**. Dilengkapi fitur **Import Nilai dari Excel/Copy-Paste Spreadsheet** agar guru bisa memasukkan nilai satu kelas dalam hitungan detik.

### 2.4 Risiko Pemblokiran (Banned) Nomor WhatsApp Sekolah
* **Kekurangan pada Ide Awal:**
  Mengirim pesan WhatsApp otomatis ke ratusan orang tua secara serentak pada jam 07.00 pagi saat antrean scan QR berlangsung akan terdeteksi sebagai *spam* oleh algoritma Meta/WhatsApp dan menyebabkan nomor WhatsApp sekolah terblokir permanen.
* **Solusi Sistem:**
  1. **Smart Notification Filtering (Prioritas Anomali):**
     - **Kirim WA Instan (High Priority):** Saat siswa **Terlambat**, **Alpa (Tanpa Keterangan)**, **Bolos Jam Pelajaran**, **Sakit di UKS**, atau mendapat **Catatan Khusus/Nilai di Bawah KKM**.
     - **Mode Rangkuman / Opsional untuk Hadir Normal:** Kehadiran normal bisa diatur apakah tetap dikirim via WA dengan antrean berjeda, atau cukup tampil *real-time* di Dashboard Web/PWA Orang Tua + 1 pesan WA Rangkuman Harian di sore hari (berisi jam datang, jam pulang, ringkasan mapel yang diikuti, nilai hari itu, dan tautan foto dokumentasi).
  2. **Queue, Random Delay & Spintax Message:**
     Setiap pesan WA yang keluar dimasukkan ke tabel antrean (`wa_notification_logs`) dan dikirim dengan jeda acak (*random delay* 4–10 detik antar pesan) serta variasi sapaan otomatis (`Assalamu'alaikum`, `Selamat Pagi Bapak/Ibu`, `Yth. Orang Tua/Wali dari...`).

### 2.5 Kompleksitas Relasi Orang Tua & Siswa (Kakak-Beradik & Kemudahan Akses)
* **Kekurangan pada Ide Awal:**
  Sering kali developer mengasumsikan 1 Siswa = 1 Akun Orang Tua, padahal di sekolah umum banyak orang tua yang menyekolahkan 2 atau 3 anak sekaligus (kakak-adik). Selain itu, orang tua sering lupa password.
* **Solusi Sistem:**
  - **Relasi Many-to-Many (`parent_student_links`):** Satu akun orang tua (berdasarkan Nomor WhatsApp unik) dapat terhubung ke banyak siswa. Di bagian atas Dashboard Orang Tua terdapat **Child Switcher** (dropdown/tab pilih nama anak).
  - **Login Ramah Orang Tua:** Login cukup menggunakan **Nomor HP/WhatsApp + PIN 6 Digit** (atau *Magic Link / OTP* yang dikirim ke WhatsApp mereka).

---

## 3. Daftar Peran Pengguna (User Roles & Permissions)

| Role | Deskripsi Pengguna | Hak Akses Utama |
| :--- | :--- | :--- |
| **1. Super Admin / Operator TU** | Staf Tata Usaha / IT Sekolah | Mengelola master data (tahun ajaran, kelas, mapel, guru, siswa, ortu), cetak kartu QR siswa massal, kelola WhatsApp Gateway, lihat & export seluruh rekap absensi dan nilai sekolah. |
| **2. Guru Mata Pelajaran** | Guru yang mengajar di kelas sesuai jadwal | Membuka sesi jurnal kelas, melakukan scan/validasi absensi mapel, memberi badge keaktifan harian, input nilai (Tugas/UH/UTS/UAS), dan unggah foto dokumentasi pembelajaran. |
| **3. Wali Kelas** | Guru yang bertanggung jawab atas 1 rombel kelas | Seluruh akses Guru Mapel + memverifikasi pengajuan izin/sakit dari orang tua, memantau rekap kehadiran harian/bulanan kelasnya, dan mencetak rekap absensi/nilai untuk rapor. |
| **4. Petugas Piket / Scanner Kiosk** | Guru piket atau perangkat layar di gerbang sekolah | Membuka halaman *Gate QR Scanner* untuk scan kartu siswa saat datang (pagi) dan pulang (sore), serta mencatat siswa yang terlambat di gerbang. |
| **5. Orang Tua / Wali Siswa** | Ayah / Ibu / Wali resmi siswa | Melihat status kehadiran anak secara *real-time*, melihat galeri foto dokumentasi kelas, memantau nilai & keaktifan belajar anak, serta mengajukan permohonan Izin/Sakit secara online. |
| **6. Siswa (Opsional)** | Peserta didik | Melihat kartu pelajar QR digital (jika kartu fisik tertinggal, bisa ditampilkan dari HP bila diizinkan sekolah), melihat jadwal, riwayat hadir, dan nilai pribadi. |

---

## 4. Spesifikasi Fitur Inti (Core Features Specification)

### Modul 1: Master Data & Generator Kartu QR (Admin)
- **F1.1 Manajemen Akademik:** CRUD Tahun Ajaran (misal: 2026/2027 Ganjil/Genap), Tingkat Kelas (X, XI, XII atau 7, 8, 9), Rombongan Belajar (misal: X-IPA-1), dan Mata Pelajaran (beserta nilai KKM).
- **F1.2 Manajemen Siswa & Koneksi Orang Tua:**
  - Input data siswa (NIS, NISN, Nama, Jenis Kelamin, Kelas, Foto Profil, Kode Unik QR).
  - Input data orang tua (Nama Ayah/Ibu/Wali, Nomor WhatsApp Aktif) dan tautkan ke satu atau lebih siswa.
  - **Bulk Import via Excel/CSV:** Admin dapat mengunggah 1 file Excel untuk membuat ratusan data siswa beserta akun orang tuanya sekaligus.
- **F1.3 Generator Kartu Absensi QR Code (PDF Siap Cetak):**
  - Sistem men-generate QR Code unik berbasis token terenkripsi (`STD-<UUID/Hash>`) untuk setiap siswa.
  - Fitur **Cetak Kartu Massal per Kelas** dalam format PDF ukuran kartu ID (`CR80` / 85.6mm × 54mm) lengkap dengan Logo Sekolah, Foto Siswa, Nama, NISN, dan QR Code.

### Modul 2: Absensi Dual-Layer (Gerbang & Kelas)
- **F2.1 Absensi Gerbang (Gate Attendance via QR Scanner):**
  - Mendukung pemindaian melalui **Kamera Web (HP/Tablet/Laptop)** menggunakan library `html5-qrcode` maupun **Alat Barcode/QR Scanner USB 2D** (mode keyboard wedge otomatis tanpa klik).
  - Otomatis menentukan status **Hadir Tepat Waktu** atau **Terlambat** berdasarkan jam batas masuk sekolah (misal: >07:15 otomatis berstatus Terlambat dan menghitung menit keterlambatan).
  - Menyimpan waktu `check_in_time` (datang) dan `check_out_time` (pulang).
- **F2.2 Absensi Jurnal Kelas per Mata Pelajaran (Classroom Attendance):**
  - Guru memilih Jadwal Mengajar hari itu (Kelas & Mata Pelajaran) lalu mengisi topik materi singkat.
  - Daftar seluruh siswa di kelas tampil dengan status *pre-filled* dari hasil Scan Gerbang pagi (dan pengajuan Izin/Sakit yang sudah disetujui).
  - Guru dapat mengubah status dengan 1-klik (`Hadir`, `Sakit`, `Izin`, `Alpa/Bolos`) atau melakukan scan QR ulang di kelas.
- **F2.3 Pengajuan Izin / Sakit Online oleh Orang Tua:**
  - Orang tua dapat mengisi formulir Izin/Sakit dari Dashboard Orang Tua (pilih tanggal, alasan Sakit/Izin, keterangan, dan unggah foto surat dokter/bukti).
  - Wali Kelas dan Guru Piket menerima notifikasi untuk melakukan **Approve / Reject**. Jika di-approve, status absensi siswa pada tanggal tersebut otomatis tercatat `Sakit` atau `Izin`.

### Modul 3: Fitur Nilai & Bukti Mengikuti Pembelajaran (Academic & Engagement)
- **F3.1 Penilaian Keaktifan Harian (Daily Learning Engagement):**
  - Terintegrasi langsung di halaman absensi jurnal kelas guru.
  - Setiap siswa yang hadir memiliki indikator keterlibatan belajar:
    - `🌟 Aktif / Berprestasi di Kelas`
    - `✅ Mengikuti Pembelajaran dengan Baik` *(Default)*
    - `⚠️ Kurang Fokus / Perlu Perhatian`
    - `❌ Tidak Mengerjakan Tugas / PR`
  - Guru dapat menambahkan catatan singkat per siswa (contoh: *"Sangat aktif menjawab soal pecahan"* atau *"Mengobrol saat penjelasan materi"*).
- **F3.2 Manajemen Nilai Akademik (Tugas, UH, PTS, PAS):**
  - Guru dapat membuat sesi penilaian untuk mata pelajarannya:
    - Kategori: `Tugas Harian`, `Kuis`, `Praktikum`, `Ulangan Harian (UH)`, `PTS (UTS)`, `PAS (UAS)`.
    - Judul Penilaian & Tanggal (contoh: *"UH Bab 1 - Aljabar"*).
    - Input nilai `0 - 100` beserta komentar opsional.
  - Indikator otomatis **Tuntas (>= KKM)** atau **Perlu Remedial (< KKM)**.
  - Riwayat perkembangan nilai disajikan dalam bentuk tabel dan grafik sederhana di akun Orang Tua.

### Modul 4: Fitur Dokumentasi Pembelajaran (Proof of Activity)
- **F4.1 Unggah Dokumentasi Jurnal Kelas:**
  - Pada setiap sesi pembelajaran, guru wajib/dapat mengunggah **1 hingga 3 foto kegiatan kelas** langsung dari kamera HP atau galeri.
  - Dilengkapi keterangan singkat (*caption*), misal: *"Praktikum rangkaian listrik seri dan paralel di laboratorium"*.
- **F4.2 Kompresi Otomatis di Sisi Klien (Client-Side WebP Compression):**
  - Sistem secara transparan mereduksi ukuran foto dari 4MB menjadi <200KB dalam waktu <1 detik di perangkat guru sebelum diunggah ke cloud storage.
- **F4.3 Tagging Siswa Spesifik (Opsional):**
  - Guru dapat memilih apakah foto dokumentasi bersifat **Publik Satu Kelas** (dilihat semua orang tua siswa yang hadir di kelas itu) atau **Privat Siswa Tertentu** (hanya dilihat oleh orang tua siswa yang di-tag, misalnya bukti lembar jawaban ujian anak atau bukti anak tidur di kelas).

### Modul 5: Rekapitulasi & Pelaporan Komprehensif (Recap & Analytics)
- **F5.1 Matriks Rekap Absensi Harian, Bulanan, dan Semester:**
  - Tabel matriks tanggal `1 s/d 31` dengan kode warna (`H`, `S`, `I`, `A`, `T` untuk Terlambat).
  - Perhitungan otomatis:
    - Total Hadir, Sakit, Izin, Alpa, dan Frekuensi Terlambat.
    - **Persentase Kehadiran (%)**: $\frac{\text{Jumlah Hadir}}{\text{Total Hari Efektif}} \times 100\%$.
- **F5.2 Rekap Nilai & Keaktifan per Mata Pelajaran:**
  - Rata-rata nilai Tugas, UH, PTS, PAS, serta Nilai Akhir per mata pelajaran.
  - Rekap jumlah badge keaktifan (`🌟`, `✅`, `⚠️`, `❌`) selama satu semester.
- **F5.3 Early Warning System (Deteksi Siswa Bermasalah):**
  - Dashboard Wali Kelas & Admin otomatis menyorot (*highlight merah*) daftar siswa yang memiliki:
    - Alpa $\ge 3$ kali dalam sebulan, atau
    - Terlambat $\ge 5$ kali dalam sebulan, atau
    - Nilai di bawah KKM berturut-turut.
- **F5.4 Export Multi-Format:**
  - Unduh rekap absensi dan rekap nilai ke dalam format **Microsoft Excel (`.xlsx`)** dan **PDF Siap Cetak** (dilengkapi kop surat sekolah dan kolom tanda tangan Wali Kelas / Kepala Sekolah).

### Modul 6: Portal Orang Tua & Notifikasi WhatsApp
- **F6.1 Dashboard Timeline Harian Anak:**
  - Menampilkan ringkasan hari ini secara kronologis:
    1. Jam Tiba di Gerbang Sekolah (beserta status Tepat Waktu/Terlambat).
    2. Daftar Mata Pelajaran hari ini yang diikuti anak (lengkap dengan status hadir di kelas, nama guru, materi, badge keaktifan, dan foto dokumentasi kelas).
    3. Nilai baru yang diinput guru hari ini.
    4. Jam Pulang dari Gerbang Sekolah.
- **F6.2 Integrasi WhatsApp Gateway Otomatis:**
  - Terhubung via Webhook/REST API ke layanan WhatsApp Gateway (seperti Fonnte, Wablas, atau WhatsApp Cloud API).
  - Template pesan dinamis yang dapat diatur oleh Admin Sekolah.

---

## 5. Kebutuhan Non-Fungsional (Non-Functional Requirements)

1. **Zero-Cost Infrastructure (100% Free Tier Friendly):**
   - Seluruh komponen sistem harus dapat berjalan di atas layanan gratis tanpa kartu kredit berbayar (Vercel Free + Supabase Free + Cloudinary Free, atau Google Apps Script + Google Sheets + Google Drive).
2. **Mobile-First & Progressive Web App (PWA):**
   - Karena 90% Orang Tua dan Guru di kelas mengakses sistem menggunakan smartphone, antarmuka wajib responsif seperti aplikasi mobile dan mendukung fitur **"Add to Home Screen" (PWA)**.
3. **Kecepatan Pemindaian QR (< 1 Detik):**
   - Proses pencocokan kode QR di gerbang harus merespons kurang dari 1 detik (menggunakan *local caching* daftar siswa kelas aktif di perangkat scanner agar tidak terhambat koneksi internet lambat).
4. **Privasi & Keamanan Data:**
   - Orang tua **hanya** dapat melihat data nilai, absensi, dan dokumentasi milik anaknya sendiri (dibatasi dengan *Row-Level Security / Session Authorization*).
   - Kode QR siswa tidak boleh hanya berisi NIS mentah (seperti `12345`) yang mudah ditebak/dipalsukan, melainkan kombinasi `UUID/Hash Token` unik.

---

## 6. Metrik Keberhasilan Produk (Success Metrics)

- **Kecepatan Operasional:** Waktu rata-rata scan QR per siswa di gerbang $\le 2$ detik; waktu guru mengisi jurnal + absensi + foto dokumentasi di kelas $\le 2$ menit per sesi pelajaran.
- **Efisiensi Penyimpanan:** Rata-rata ukuran file foto dokumentasi yang tersimpan di server $\le 180\text{ KB}$, memungkinkan penyimpanan $> 5.000$ foto dokumentasi dalam kuota gratis 1 GB.
- **Transparansi Orang Tua:** Tingkat keterbacaan informasi kehadiran dan nilai oleh orang tua meningkat, serta penurunan angka membolos jam pelajaran berkat sinkronisasi absen gerbang dan jurnal kelas.
- **Otomasi Administrasi:** Waktu pembuatan laporan rekap absensi bulanan dan rapor oleh Wali Kelas berkurang dari berjam-jam menjadi $< 30$ detik (1 klik export Excel/PDF).


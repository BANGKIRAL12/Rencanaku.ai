# Product Requirements Document (PRD)

# Rencanaku.ai

**Jenis dokumen:** Product Requirements Document\
**Nama produk:** Rencanaku.ai\
**Versi dokumen:** 1.0\
**Status:** Baseline kebutuhan produk untuk perencanaan implementasi\
**Bahasa:** Indonesia\
**Tujuan utama:** Menjadi sumber acuan bagi pemilik produk, arsitek
perangkat lunak, pengembang, penguji, dan coding agent eksternal.

------------------------------------------------------------------------

## 1. Ringkasan Eksekutif

Rencanaku.ai adalah aplikasi pendamping perencanaan proyek berbasis AI.
Aplikasi membantu pengguna mengembangkan gagasan menjadi persyaratan
yang terstruktur, dokumen konteks proyek, keputusan teknis, arsitektur,
rencana implementasi, tugas, prompt coding agent, serta siklus perbaikan
prompt berdasarkan hasil dan kesalahan yang dilaporkan dari coding agent
eksternal.

Rencanaku.ai **bukan** alat yang secara langsung menulis atau mengubah
kode sumber proyek target. Tanggung jawab aplikasi adalah membantu
merencanakan, mengatur konteks, menghasilkan instruksi, memvalidasi
artefak perencanaan, merekam hasil percobaan, dan memperbaiki instruksi.
Pengguna meneruskan prompt dan konteks yang dihasilkan kepada coding
agent atau alat pengembangan lain. Hasil coding agent kemudian
dilaporkan kembali ke Rencanaku.ai untuk evaluasi dan tindak lanjut.

Aplikasi ditujukan untuk penggunaan pribadi maupun penggunaan oleh
beberapa anggota melalui server. Produk menggunakan satu codebase dengan
modul yang terpisah secara logis dalam **arsitektur modular monolith**,
bukan microservices. Antarmuka utama berupa aplikasi web server-rendered
yang responsif. Penyimpanan utama menggunakan SQLite untuk metadata dan
relasi, serta sistem berkas untuk dokumen dan lampiran. Model AI diakses
melalui adapter provider yang dapat dikonfigurasi.

Produk harus mendukung alur kerja yang bertahap, dapat dipulihkan, dapat
diaudit, dan tidak mengubah keputusan yang telah disetujui secara
diam-diam. Pengguna tetap menjadi otoritas untuk keputusan resmi,
persetujuan rencana, penerapan perubahan dokumen, status penyelesaian
tugas, dan penutupan proyek.

## 2. Visi, Tujuan, dan Prinsip Produk

### 2.1 Visi

Menyediakan ruang kerja perencanaan proyek yang membantu pengguna
berpikir, membuat keputusan, menyusun dokumen, dan mengarahkan coding
agent secara konsisten dari gagasan awal hingga proyek selesai.

### 2.2 Tujuan produk

1.  Membantu pengguna mengembangkan ide menjadi persyaratan yang jelas
    dan dapat diuji.
2.  Memelihara konteks proyek yang terstruktur agar percakapan panjang
    tidak menjadi satu-satunya sumber pengetahuan.
3.  Menghasilkan paket dokumen konteks yang dipilih sesuai kebutuhan
    proyek.
4.  Membuat rencana implementasi yang mempertimbangkan dependensi,
    risiko, kriteria penerimaan, dan kompleksitas.
5.  Menghasilkan prompt terpisah untuk setiap tugas, dengan konteks dan
    format yang sesuai coding agent target.
6.  Mengelola siklus percobaan coding agent, laporan hasil, validasi,
    dan perbaikan prompt.
7.  Memelihara versi dokumen, rencana, tugas, prompt, dan keputusan agar
    perubahan dapat ditelusuri.
8.  Mendukung berbagai provider dan model AI tanpa mengunci produk pada
    satu penyedia.
9.  Menyediakan operasi lokal dan server multi-pengguna dengan pemisahan
    data dan keamanan yang sesuai.
10. Memungkinkan pemulihan data dan operasi setelah gangguan secara
    terkontrol.

### 2.3 Bukan tujuan produk

1.  Menggantikan coding agent yang mengubah kode sumber proyek target.
2.  Menjalankan kode yang diimpor sebagai bagian dari analisis proyek.
3.  Mengharuskan pengguna menggunakan satu provider AI atau satu model
    tertentu.
4.  Menjadikan ekspor ZIP seluruh proyek sebagai fitur ekspor standar.
5.  Menganggap hasil AI atau coding agent benar tanpa validasi.
6.  Menandai tugas selesai atau menutup proyek secara otomatis tanpa
    tindakan pengguna.
7.  Memberi admin akses otomatis terhadap isi proyek privat milik
    anggota.
8.  Menyimpan seluruh konteks proyek ke setiap permintaan AI tanpa
    seleksi relevansi.

### 2.4 Prinsip desain

-   **Human approval untuk keputusan resmi:** keputusan yang telah
    dikunci tidak dapat diganti diam-diam.
-   **Konteks minimum yang relevan:** kirim hanya konteks yang
    dibutuhkan untuk pekerjaan terkait.
-   **Transparansi:** tampilkan model, provider, status, durasi, biaya
    yang diketahui atau diperkirakan, serta sumber bila digunakan.
-   **Pemulihan:** pekerjaan panjang harus menyimpan hasil tahap yang
    telah berhasil.
-   **Keterlacakan:** setiap artefak penting memiliki identitas, versi,
    sumber, dan hubungan dengan artefak lain.
-   **Keamanan secara default:** file impor tidak dieksekusi; rahasia
    tidak ditampilkan di log; data pengguna dipisahkan.
-   **Modularitas tanpa kompleksitas berlebih:** satu aplikasi modular,
    bukan sistem microservices.
-   **Pembangunan bertahap:** tugas fondasi dan berisiko tinggi harus
    divalidasi sebelum pekerjaan yang bergantung padanya dilanjutkan.

## 3. Pengguna, Peran, dan Hak Akses

### 3.1 Peran

#### Administrator

Administrator dapat: - Membuat akun anggota. - Menetapkan kata sandi
awal. - Mengaktifkan atau menonaktifkan akun. - Mengatur ulang kata
sandi anggota. - Memaksa perubahan kata sandi sementara pada login
berikutnya. - Mengelola pengaturan sistem. - Mengelola provider AI
bersama. - Mengelola pengaturan penyimpanan, backup, dan pemulihan. -
Melihat status kesehatan sistem, metrik operasional, dan log
administratif yang diizinkan. - Mengelola batas penggunaan AI dan
konfigurasi terkait. - Mengakses informasi teknis yang diperlukan untuk
operasi.

Administrator **tidak otomatis memperoleh hak baca terhadap isi proyek
privat**, termasuk chat, dokumen, memori, lampiran, rencana, dan prompt
anggota.

#### Anggota

Anggota dapat: - Mengelola akun dan kata sandinya sendiri sesuai
kebijakan aplikasi. - Membuat dan mengelola proyek pribadi. -
Menggunakan provider bersama yang diizinkan. - Mengonfigurasi kunci API
pribadi bila fitur tersebut diizinkan. - Mengelola chat, memori,
dokumen, rencana, tugas, prompt, lampiran, laporan, dan percobaan coding
agent dalam proyek miliknya. - Melakukan backup atau ekspor yang
diizinkan. - Mengelola notifikasi dan preferensi tampilan.

### 3.2 Pembuatan akun dan autentikasi

-   Pembuatan akun awal dilakukan melalui wizard penyiapan pertama.
-   Wizard pembuatan administrator hanya boleh berjalan sekali setelah
    inisialisasi berhasil.
-   Pendaftaran publik nonaktif secara default.
-   Administrator membuat akun anggota dan menetapkan kata sandi awal.
-   Kata sandi harus disimpan dalam bentuk hash yang sesuai untuk kata
    sandi, bukan teks biasa.
-   Kata sandi sementara harus diganti pada login berikutnya.
-   Pengaturan ulang kata sandi oleh administrator harus menggunakan
    alur yang aman dan dapat membatalkan sesi lama.
-   Sesi harus memiliki masa berlaku, mekanisme logout, perlindungan
    cookie, dan invalidasi yang sesuai.
-   Upaya login perlu dibatasi dan dicatat untuk mengurangi risiko brute
    force.
-   Aplikasi web harus melindungi operasi yang mengubah data dari CSRF
    dan memvalidasi otorisasi di sisi server.

### 3.3 Pemisahan data dan kunci AI

-   Proyek bersifat privat secara default.
-   Anggota hanya dapat melihat proyek dan artefak miliknya.
-   Hak akses harus diperiksa pada setiap operasi yang membaca atau
    mengubah data.
-   Kunci AI dapat berasal dari konfigurasi bersama yang dikelola
    administrator atau dari kunci pribadi anggota.
-   Izin provider dan sumber kunci harus jelas bagi pengguna.
-   Penggunaan kunci bersama sebaiknya dapat dibatasi dan dicatat per
    anggota.
-   Kunci API disimpan dalam file konfigurasi lokal sesuai keputusan
    produk, dengan mitigasi keamanan: izin file dibatasi, file tidak
    disajikan oleh web server, nilai disamarkan di UI dan log, serta
    dikecualikan dari ekspor biasa.
-   Dalam mode multi-pengguna/server, akses ke file konfigurasi harus
    dibatasi pada proses dan administrator sistem yang memang berwenang.
-   Data proyek yang dikirim ke provider eksternal harus mengikuti
    pemilihan konteks dan penjelasan privasi aplikasi.

## 4. Mode Operasi dan Deployment

### 4.1 Mode operasi

Satu codebase harus mendukung: 1. **Mode lokal/pribadi:** digunakan oleh
satu pengguna pada perangkat atau lingkungan lokal. 2. **Mode
server/multi-pengguna:** digunakan melalui jaringan dengan autentikasi
dan pemisahan data antaranggota. 3. **Mode Docker:** deployment melalui
image dan volume persisten yang dikonfigurasi dengan benar.

Perbedaan mode tidak boleh menghasilkan dua implementasi aplikasi yang
terpisah. Perilaku keamanan dan fitur yang tersedia harus ditentukan
oleh konfigurasi dan kemampuan lingkungan.

### 4.2 Instalasi dan operasi CLI

CLI merupakan jalur utama untuk instalasi dan pengelolaan aplikasi. CLI
harus mendukung: - Menjalankan aplikasi. - Menghentikan aplikasi jika
dijalankan sebagai proses yang dikelola CLI. - Memeriksa status proses
dan kesehatan dasar. - Melihat log. - Memvalidasi konfigurasi. -
Memeriksa versi aplikasi dan memberi tahu jika pembaruan tersedia. -
Membantu membuat backup sebelum operasi berisiko. - Memvalidasi kesiapan
migrasi dan pemulihan.

Pembaruan aplikasi **tetap diunduh dan dipasang secara manual**. CLI
tidak boleh memasang versi baru secara otomatis. CLI dapat membantu
persiapan backup dan migrasi; migrasi dijalankan melalui prosedur aman
yang terkait versi aplikasi.

### 4.3 Penyimpanan deployment

-   Data pengguna harus berada di luar direktori kode aplikasi.
-   Deployment Docker harus menggunakan volume persisten untuk database,
    dokumen, lampiran, backup, dan konfigurasi yang diperlukan.
-   Pembaruan kode tidak boleh mengganti atau menghapus volume data.
-   Petunjuk deployment harus menjelaskan direktori data, izin akses,
    backup, pemulihan, dan prosedur pembaruan.

## 5. Stack Teknologi

Stack berikut menjadi baseline teknis yang disepakati dan dapat
diperinci pada dokumen arsitektur. Versi runtime dan dependensi harus
dipilih sebagai versi yang masih didukung dan saling kompatibel pada
saat implementasi; versi konkret perlu dikunci dalam file manifest dan
lockfile saat proyek dimulai.

### 5.1 Backend

-   **Node.js LTS yang masih didukung** sebagai runtime.
-   **Express** sebagai framework HTTP dan routing.
-   **EJS** untuk rendering halaman di server.
-   **SQLite** sebagai database utama.
-   **better-sqlite3** sebagai salah satu pilihan akses SQLite.
-   **Zod** untuk validasi input, konfigurasi, dan struktur data.
-   **Commander** untuk CLI.
-   **Vitest** untuk pengujian.
-   **Supertest** untuk pengujian endpoint HTTP.

Aplikasi harus menggunakan runtime Node.js yang didukung, bukan
membatasi implementasi baru pada Node.js 12.

### 5.2 Frontend

-   HTML server-rendered melalui EJS.
-   Tailwind CSS yang dibangun secara lokal, bukan mengandalkan CDN
    untuk aplikasi produksi.
-   JavaScript vanilla untuk interaksi antarmuka.
-   Fetch API untuk komunikasi asinkron.
-   CodeMirror 6 untuk penyuntingan kode atau teks teknis bila
    diperlukan.
-   `marked` untuk rendering Markdown dengan sanitasi yang sesuai.

Antarmuka tidak perlu dibangun sebagai SPA. Navigasi dan interaksi harus
mempertahankan pengalaman responsif tanpa memperkenalkan kompleksitas
framework frontend yang tidak diperlukan.

### 5.3 Integrasi AI

-   Lapisan adapter provider terpisah.
-   Dukungan provider resmi dan gateway, termasuk provider dengan
    endpoint atau format API yang kompatibel.
-   Konfigurasi base URL, format API, nama provider, nama model,
    parameter model, dan header kustom yang aman.
-   Penanganan kesalahan provider yang seragam.
-   Dukungan pemilihan model per tugas dan default model per jenis
    pekerjaan.

### 5.4 Penyimpanan file

-   SQLite untuk metadata, relasi, status, versi, dan indeks yang
    diperlukan.
-   Sistem berkas untuk dokumen, lampiran, backup, dan berkas berukuran
    besar.
-   Identitas dan metadata file disimpan di database.
-   Penulisan file dan perubahan database harus dirancang untuk
    menangani kegagalan parsial.
-   Pemeriksaan hash atau versi diperlukan untuk mencegah penimpaan file
    yang telah berubah di luar aplikasi.

### 5.5 Prinsip dependensi

-   Dependensi harus memiliki versi yang dipatok melalui manifest dan
    lockfile.
-   Dependensi yang tidak diperlukan tidak boleh ditambahkan tanpa
    alasan.
-   Pembaruan dependensi harus melalui pengujian regresi.
-   Versi runtime, framework, database driver, editor, dan parser
    Markdown harus diperiksa kompatibilitasnya sebelum dirilis.
-   Tidak boleh menyimpan kredensial produksi dalam repositori.

## 6. Arsitektur Tingkat Tinggi

### 6.1 Pola arsitektur

Gunakan **modular monolith** dengan pemisahan modul berdasarkan tanggung
jawab. Semua modul berada dalam satu aplikasi dan satu proses deployment
utama, tetapi memiliki batas antarmuka yang jelas. Jangan menggunakan
microservices pada versi awal.

### 6.2 Modul utama

1.  **Web Application:** routing, middleware, rendering EJS, sesi, dan
    respons HTTP.
2.  **Authentication & Authorization:** akun, sesi, peran, izin, dan
    isolasi data.
3.  **Project Management:** pembuatan, pengubahan, duplikasi, arsip,
    pemulihan, dan penghapusan proyek.
4.  **Conversation:** chat, riwayat percakapan, lampiran, status
    permintaan, dan mode diskusi/hasil cepat.
5.  **Project Memory:** memori terstruktur, keputusan, sumber,
    persetujuan, versi, dan pemilihan memori relevan.
6.  **AI Provider Registry:** konfigurasi provider, model, kredensial,
    kemampuan, dan pengujian koneksi.
7.  **AI Orchestration:** pemilihan model, perakitan konteks, antrean,
    retry, pembatalan, pemantauan, dan pemulihan proses.
8.  **Context Documents:** katalog dokumen, pembuatan, penyuntingan,
    validasi, versi, dan diff.
9.  **Planning:** pemeriksaan kesiapan, rencana, dependensi, kriteria
    penerimaan, dan persetujuan.
10. **Task & Prompt Management:** tugas, prompt, format coding agent,
    versi, status, dan riwayat perbaikan.
11. **External Agent Trials:** percobaan, laporan hasil, bukti,
    validasi, dan relasi antarpercobaan.
12. **File & Attachment Storage:** unggah, validasi, penyimpanan,
    metadata, pemakaian ulang, dan pembersihan.
13. **Backup & Recovery:** backup terjadwal/manual, retensi, validasi,
    pemulihan, dan prosedur konsistensi.
14. **Notifications:** notifikasi aktivitas, kesalahan, tugas panjang,
    dan hasil proses.
15. **Settings & Preferences:** pengaturan tampilan, bahasa, provider,
    keyboard shortcut, penyimpanan, dan konfigurasi lanjutan.
16. **Administration:** anggota, status akun, provider bersama, batas
    penggunaan, dan operasi sistem.
17. **Search:** pencarian berdasarkan metadata pada proyek, percakapan,
    dokumen, prompt, dan lampiran.
18. **Diagnostics & Health:** status kesehatan, log, metrik, pemeriksaan
    konfigurasi, dan laporan diagnostik.
19. **CLI & Deployment:** perintah operasional, validasi konfigurasi,
    pemeriksaan versi, dan bantuan pembaruan.

### 6.3 Prinsip dependensi modul

-   Modul tidak boleh mengakses tabel atau berkas modul lain secara
    sembarang; gunakan layanan internal atau antarmuka yang
    terdokumentasi.
-   Aturan otorisasi harus diterapkan di lapisan layanan/server, bukan
    hanya dengan menyembunyikan kontrol UI.
-   Orkestrasi AI tidak boleh langsung menerapkan hasil ke dokumen resmi
    tanpa melewati validasi dan alur persetujuan yang sesuai.
-   Modul backup harus mengetahui relasi database dan file untuk
    menghasilkan pemulihan yang konsisten.
-   Modul memori harus membedakan percakapan mentah, informasi penting,
    keputusan yang disetujui, dan ringkasan.
-   Modul tugas harus mempertahankan relasi tugas, dependensi, prompt,
    percobaan, laporan, dan bukti.

## 7. Navigasi dan Antarmuka Pengguna

### 7.1 Tata letak utama

-   Sidebar kiri yang dapat diciutkan.
-   Navbar bagian atas.
-   Area konten utama yang terpusat.
-   Workspace adaptif yang dapat menampilkan chat dan panel artefak.
-   Panel dokumen atau tugas dapat dibuka, diubah lebarnya, dan disusun
    dalam tab.
-   Antarmuka responsif untuk desktop, tablet, dan ponsel; desktop
    menjadi prioritas utama.
-   Bahasa antarmuka default Bahasa Indonesia, dengan opsi bahasa
    Inggris.
-   Bahasa UI dipisahkan dari bahasa respons AI.
-   Tema terang dan gelap dipilih secara manual.

### 7.2 Gaya visual dan aksesibilitas

-   Tampilan profesional, minimal, jelas, dan interaktif tanpa terlalu
    ramai.
-   Navigasi keyboard menyeluruh.
-   Fokus keyboard terlihat jelas.
-   Kontras teks dan kontrol memadai.
-   Struktur semantik dan dukungan screen reader.
-   Menghormati preferensi sistem untuk mengurangi animasi.
-   Shortcut keyboard dapat dikustomisasi dan memiliki halaman
    referensi.
-   Pengaturan lanjutan, termasuk shortcut kustom, berada di halaman
    pengaturan.

### 7.3 Dashboard

Dashboard harus menampilkan: - Daftar proyek. - Pencarian proyek. -
Status proyek. - Aktivitas terbaru. - Kemajuan perencanaan. - Tugas yang
membutuhkan tindakan. - Dokumen terbaru. - Akses cepat ke proyek. - Aksi
untuk membuat proyek baru.

### 7.4 Pembuatan proyek pertama

-   Setelah onboarding, pengguna dapat langsung masuk ke chat kosong
    tanpa formulir pembuatan proyek yang wajib.
-   Pengguna dapat memulai dengan ide bebas, daftar fitur, spesifikasi
    awal, lampiran, atau pertanyaan.
-   Aplikasi harus menyediakan cara yang jelas untuk mengubah sesi awal
    menjadi proyek resmi dan memberi nama proyek.
-   Aturan kapan proyek resmi dibuat harus konsisten agar chat tidak
    hilang atau tersimpan tanpa hubungan proyek yang jelas.

### 7.5 Workspace proyek

Workspace memiliki: - Navigasi proyek. - Riwayat chat. - Panel
dokumen. - Panel rencana dan tugas. - Tab untuk artefak yang sedang
dibuka. - Pemilih model dan provider. - Tombol lampiran. - Indikator
status, model/provider, durasi, dan kesalahan. - Informasi konteks
proyek yang digunakan. - Aksi AI yang sesuai tahap saat ini.

Saat dokumen konteks pertama kali dihasilkan, tab atau panel dokumen
harus terbuka secara otomatis di sisi kanan bila tata letak
memungkinkan.

### 7.6 Chat

Chat harus mendukung: - Mode diskusi dan mode hasil cepat; mode diskusi
menjadi default. - Pemilih model yang menampilkan provider dan nama
model. - Pencarian model/provider. - Lampiran file dan gambar. - Riwayat
percakapan. - Indikator status proses. - Informasi konteks proyek yang
relevan. - Aksi sesuai tahap, seperti menyempurnakan persyaratan,
menghasilkan dokumen, meninjau rencana, membuat prompt, atau memperbaiki
prompt. - Penampilan metadata proses seperti model/provider, durasi,
status, dan kesalahan. - Pengiriman pesan yang tidak kehilangan data
jika proses AI gagal.

### 7.7 Notifikasi

Pusat notifikasi dalam aplikasi harus mencakup: - Aktivitas AI yang
selesai. - Kesalahan AI. - Penyelesaian dokumen. - Penyelesaian atau
kegagalan pembuatan rencana. - Pekerjaan panjang yang selesai, gagal,
atau dibatalkan. - Tugas yang membutuhkan tindakan pengguna.

Notifikasi dapat ditandai telah dibaca dan difilter. Notifikasi harus
dapat mengarahkan pengguna ke proyek atau artefak terkait.

## 8. Siklus Kerja Proyek

### 8.1 Alur utama

1.  Pengguna membuka dashboard atau memulai chat kosong.
2.  Pengguna menjelaskan ide atau kebutuhan proyek.
3.  AI membantu mengklarifikasi tujuan, pengguna sasaran, persyaratan,
    batasan, alur, dan kriteria keberhasilan.
4.  Aplikasi mencatat informasi penting dan keputusan dalam memori
    terstruktur.
5.  Pengguna memilih dokumen konteks yang ingin dihasilkan.
6.  AI menghasilkan draft dokumen; pengguna dapat meninjau, mengubah,
    atau meminta revisi.
7.  Aplikasi memvalidasi konsistensi antar dokumen dan mencatat versi.
8.  Pengguna memulai pembuatan rencana melalui modal instruksi singkat
    dan pemilihan model perencana.
9.  AI memeriksa kesiapan rencana, persyaratan, dependensi, risiko, dan
    keputusan yang belum selesai.
10. Aplikasi menampilkan rencana lengkap dalam modal atau workspace
    untuk ditinjau.
11. Pengguna merevisi dan menyetujui rencana.
12. AI membuat tugas dengan dependensi, kriteria penerimaan, konteks,
    dan prompt terpisah.
13. Aplikasi menyarankan coding agent/model eksternal yang sesuai
    berdasarkan kemampuan dan efisiensi biaya yang diketahui.
14. Pengguna mengirim prompt ke coding agent eksternal.
15. Pengguna melaporkan hasil, kesalahan, ketidaksesuaian, atau bukti
    hasil ke tugas terkait.
16. AI membandingkan bukti dengan kriteria penerimaan, menandai bagian
    yang terpenuhi dan belum terverifikasi, serta menyusun instruksi
    tindak lanjut.
17. Prompt revisi disimpan sebagai versi baru yang terhubung dengan
    prompt awal dan tugas yang sama.
18. Siklus berulang sampai pengguna memutuskan tugas selesai.
19. Setelah seluruh pekerjaan relevan ditinjau, AI membantu pemeriksaan
    penutupan proyek.
20. Pengguna mengonfirmasi penutupan proyek.

### 8.2 Pembagian tahap AI

-   Tahap percakapan dan klarifikasi.
-   Tahap pembuatan dokumen konteks.
-   Tahap pemeriksaan kesiapan rencana.
-   Tahap pembuatan dan revisi rencana.
-   Tahap pembuatan prompt per tugas.
-   Tahap pelaporan dan perbaikan prompt.
-   Tahap validasi hasil.
-   Tahap pemeriksaan penutupan proyek.

Setiap tahap harus menyimpan status dan hasil yang berhasil agar proses
dapat dipulihkan setelah gangguan.

## 9. Model AI dan Provider

### 9.1 Pemilihan model

-   Pemilih model harus menampilkan provider dan model.
-   Daftar model harus dapat dicari.
-   Daftar model dapat disinkronkan dari provider bila kemampuan
    tersebut tersedia.
-   Model juga dapat ditambahkan secara manual.
-   Default model ditetapkan per jenis tugas.
-   Ketika pengguna berpindah tahap, aplikasi memilih default untuk
    tahap tersebut.
-   Pengguna boleh mengganti model secara manual.
-   Pemilihan model untuk proses internal Rencanaku.ai terpisah dari
    rekomendasi coding agent eksternal.

### 9.2 Konfigurasi provider

Pengaturan provider harus mendukung: - Provider bawaan. - Provider
kustom. - Nama provider. - Base URL. - Format API yang didukung. - Nama
model dan nama tampilan. - Parameter model. - Header kustom dengan
validasi dan perlindungan rahasia. - Sumber kredensial bersama atau
pribadi. - Pengujian koneksi. - Pesan kesalahan yang menjelaskan
kemungkinan penyebab dan langkah pemulihan. - Kemampuan untuk melewati
konfigurasi AI saat penyiapan pertama.

### 9.3 Orkestrasi dan antrean

-   Permintaan AI harus memiliki status.
-   Aplikasi harus menangani batas laju provider, antrean, penundaan,
    dan kuota habis.
-   Batas konkurensi harus dapat dikonfigurasi sesuai kapasitas server
    dan provider.
-   Antrean dapat memiliki prioritas yang dapat dikonfigurasi.
-   Pengguna harus mengetahui ketika permintaan menunggu, gagal, atau
    dibatalkan.
-   Kebijakan retry harus membedakan kegagalan sementara, batas laju,
    kesalahan konfigurasi, konteks terlalu besar, dan keluaran tidak
    valid.
-   Retry tidak boleh menggandakan penerapan perubahan atau membuat
    artefak ganda.
-   Ketika input berubah, sistem harus menentukan apakah hasil tahap
    sebelumnya masih dapat digunakan atau harus dihitung ulang.
-   Proses panjang harus menyimpan hasil sukses per tahap.
-   Pembatalan lokal dan pembatalan pada provider dilakukan bila
    didukung.
-   Jika provider tidak mendukung pembatalan, aplikasi harus menjelaskan
    bahwa proses eksternal mungkin tetap berjalan dan dapat menimbulkan
    biaya.
-   Hasil parsial tidak boleh diterapkan ke dokumen resmi tanpa
    validasi.

### 9.4 Transparansi penggunaan

Untuk setiap proses yang relevan, tampilkan: - Provider dan model yang
digunakan. - Status proses. - Durasi. - Token jika provider
melaporkannya. - Biaya aktual jika tersedia. - Estimasi biaya jika biaya
aktual tidak tersedia. - Alternatif model yang lebih hemat jika
informasi kemampuan dan biaya yang diperlukan tersedia. - Kesalahan dan
saran perbaikan.

Aplikasi tidak boleh menyatakan estimasi sebagai biaya aktual atau
mengarang harga model.

### 9.5 Kegagalan dan pemulihan

Jika AI gagal, aplikasi harus: 1. Mengidentifikasi kategori kegagalan.
2. Menampilkan bagian yang bermasalah bila dapat diketahui. 3.
Menawarkan retry, penggantian model, perbaikan pengaturan, atau
penyesuaian konteks. 4. Memvalidasi keluaran setelah perbaikan. 5.
Mempertahankan keluaran tahap sebelumnya yang telah berhasil. 6.
Mencegah keluaran gagal mengganti artefak resmi.

## 10. Memori Proyek dan Pengelolaan Keputusan

### 10.1 Pemisahan percakapan dan memori

Aplikasi menyimpan: - Riwayat percakapan lengkap. - Memori proyek
terstruktur. - Keputusan proyek. - Status proyek saat ini. - Ringkasan
percakapan. - Ringkasan keputusan penting. - Ringkasan tugas dan detail
artefak.

Memori bukan pengganti chat. Chat adalah rekaman interaksi, sedangkan
memori adalah informasi terstruktur yang dipilih agar relevan untuk
pekerjaan berikutnya.

### 10.2 Penyimpanan memori

-   AI secara otomatis menyimpan informasi yang dianggap penting.
-   Tidak diperlukan persetujuan per fakta untuk setiap penyimpanan
    memori.
-   Memori dikelola oleh sistem dan tidak membutuhkan halaman manajemen
    memori khusus.
-   Pengguna dapat memperbaiki memori melalui chat.
-   Memori menyimpan sumber, waktu, status, versi, dan hubungan dengan
    keputusan atau artefak terkait.
-   Memori yang tidak lagi relevan harus dapat ditandai usang tanpa
    menghilangkan jejak historis yang dibutuhkan.

### 10.3 Konflik dan keputusan terkunci

-   AI harus mendeteksi konflik antara informasi baru dan informasi
    lama.
-   Konflik dengan keputusan yang telah dikunci harus diajukan kepada
    pengguna.
-   AI boleh menyarankan alternatif dan menjelaskan dampak, tetapi tidak
    boleh mengganti keputusan terkunci tanpa persetujuan.
-   Perubahan penting harus memiliki riwayat.
-   AI harus membedakan ide baru dari persyaratan yang telah disetujui.
-   Asumsi kecil yang aman dapat dinyatakan secara eksplisit; keputusan
    penting yang belum jelas harus ditanyakan.

### 10.4 Pemilihan konteks memori

-   Memori dipilih secara dinamis sesuai tugas, tahap, artefak terkait,
    dan konteks terbaru.
-   Pengguna dapat melihat konteks yang akan dikirim ke model dan
    mengeditnya.
-   Konteks yang tidak relevan tidak boleh disertakan hanya karena
    tersedia.
-   Jika konteks diringkas atau sebagian dihilangkan, aplikasi harus
    memberi tahu pengguna.
-   Ringkasan bertingkat harus memuat ringkasan percakapan, keputusan
    penting, status proyek, dan detail tugas.
-   Ringkasan harus divalidasi terhadap memori terstruktur dan keputusan
    yang telah disetujui.

## 11. Dokumen Konteks Proyek

### 11.1 Katalog dokumen

Saat membuat dokumen konteks, aplikasi menampilkan katalog dokumen yang
komprehensif dengan checkbox. Setiap entri menjelaskan: - Nama
dokumen. - Tujuan. - Isi yang diharapkan. - Kapan dokumen dibutuhkan. -
Ketergantungan pada dokumen atau keputusan lain.

AI boleh menyarankan dokumen tambahan, dan pengguna dapat meminta
dokumen kapan saja. Katalog harus dapat diperluas tanpa mengubah seluruh
alur aplikasi.

### 11.2 Siklus pembuatan dokumen

-   AI membuat draft sesuai konteks proyek.
-   Pengguna meninjau draft sebelum menetapkannya sebagai versi resmi.
-   Pengguna dapat meminta revisi seluruh dokumen atau bagian terpilih.
-   Editor mendukung Markdown dan pratinjau.
-   Pengguna dapat melakukan penyuntingan langsung.
-   Revisi AI harus menunjukkan diff.
-   Untuk perubahan teks atau kode, baris yang dihapus dan ditambahkan
    ditandai dengan jelas.
-   Pengguna dapat menerima atau menolak kelompok perubahan atau seluruh
    perubahan.
-   Perubahan tidak diterapkan sebelum validasi dan persetujuan yang
    sesuai.

### 11.3 Edit terarah dan validasi

-   Pengguna dapat memilih bagian tertentu dari dokumen untuk direvisi.
-   AI hanya membaca bagian terpilih dan konteks minimum yang
    diperlukan.
-   Pengguna dapat memilih file tertentu atau rentang baris.
-   Jika file berubah setelah dibaca, sistem harus memeriksa versi atau
    hash sebelum menerapkan hasil.
-   Jika versi sudah usang, diff harus dihitung ulang dan tidak boleh
    menimpa perubahan terbaru secara membabi buta.
-   Perubahan diperiksa terhadap konsistensi dokumen lain, keputusan
    terkunci, rencana, tugas, dan prompt terkait.
-   Aplikasi menampilkan dampak sebelum menerapkan perubahan.

### 11.4 Versi dan keterlacakan

-   Setiap dokumen memiliki identitas dan riwayat versi.
-   Diff antarversi dapat dilihat.
-   Hubungan dokumen dengan keputusan, rencana, tugas, dan prompt
    disimpan.
-   Perubahan dokumen setelah rencana dibuat memicu analisis dampak.
-   Aplikasi mengidentifikasi tugas yang terpengaruh dan menawarkan
    pembaruan rencana.
-   Aplikasi tidak mengubah rencana atau prompt terkait secara
    diam-diam.

## 12. Perencanaan Implementasi

### 12.1 Pemeriksaan kesiapan rencana

Sebelum membuat rencana, AI memeriksa: - Kelengkapan persyaratan. -
Kejelasan tujuan dan ruang lingkup. - Dependensi. - Risiko. - Keputusan
yang belum terselesaikan. - Ketersediaan konteks dan dokumen penting. -
Kriteria penerimaan. - Konflik antardokumen. - Urutan implementasi yang
masuk akal.

AI harus menjelaskan celah dan memberi tahu pengguna jika ada informasi
yang perlu diperjelas. Pengguna tetap dapat memilih melanjutkan dengan
asumsi yang dinyatakan jelas.

### 12.2 Pembuatan rencana

-   Pembuatan rencana diawali modal untuk instruksi singkat dan
    pemilihan model perencana.
-   Rencana lengkap ditampilkan dalam modal atau workspace untuk
    ditinjau.
-   Pengguna dapat meminta revisi.
-   Rencana tidak boleh digunakan untuk membuat prompt final sebelum
    disetujui.
-   Rencana memiliki versi dan identitas.
-   Rencana harus mempertimbangkan kompleksitas proyek; proyek sederhana
    tidak dipaksa memiliki struktur yang terlalu besar.
-   Struktur tugas disesuaikan dengan jenis pekerjaan.

### 12.3 Dependensi dan urutan

-   Dependensi tugas dinyatakan secara eksplisit.
-   Pengguna dapat mengubah urutan tugas dan relasi dependensi.
-   Aplikasi memvalidasi dependensi untuk mencegah siklus atau urutan
    yang tidak valid.
-   Perubahan urutan harus mempertimbangkan tugas yang sudah dimulai
    atau selesai.
-   Perubahan rencana harus menampilkan dampak terhadap tugas,
    dependensi, dokumen, prompt, urutan, dan kriteria penerimaan.

### 12.4 Kriteria penerimaan

-   AI membuat kriteria penerimaan sesuai jenis tugas.
-   Pengguna dapat mengedit kriteria sebelum rencana disetujui.
-   Kriteria yang disetujui disimpan bersama rencana dan tugas terkait.
-   Validasi hasil harus membedakan kriteria yang terpenuhi, tidak
    terpenuhi, dan belum dapat diverifikasi.

## 13. Tugas dan Prompt Coding Agent

### 13.1 Tugas

Setiap tugas dapat memuat: - ID unik. - Nama dan tujuan. - Deskripsi. -
Jenis tugas. - Dependensi. - Konteks terkait. - Dokumen yang relevan. -
Kriteria penerimaan. - Status. - Prompt awal dan revisi. - Riwayat
percobaan. - Laporan hasil coding agent. - Lampiran dan bukti. - Hasil
validasi. - Waktu pembuatan dan perubahan.

Status tugas: - Belum dimulai. - Sedang dikerjakan. - Selesai. -
Terblokir.

Hanya pengguna yang dapat mengubah status menjadi selesai. AI dapat
merekomendasikan perubahan status dan menjelaskan bukti, tetapi tidak
boleh menandai selesai secara otomatis.

### 13.2 Prompt per tugas

-   Satu prompt dibuat untuk setiap tugas.
-   Prompt menyertakan konteks yang relevan, instruksi, batasan, dan
    kriteria penerimaan.
-   Format prompt direkomendasikan sesuai coding agent target.
-   AI menjelaskan alasan pemilihan format.
-   Pengguna dapat memilih format lain secara manual.
-   Prompt memiliki ID, versi, dan hubungan ke tugas serta rencana.
-   Perubahan rencana memicu identifikasi prompt yang sudah usang.
-   Prompt dan dokumen diunduh satu per satu; paket file tidak menjadi
    fitur versi awal.

### 13.3 Rekomendasi coding agent eksternal

-   Rekomendasi mempertimbangkan kemampuan yang dibutuhkan tugas dan
    efisiensi biaya.
-   Rekomendasi harus menjelaskan alasan dan keterbatasan.
-   Harga hanya boleh ditampilkan sebagai nilai aktual atau estimasi
    dengan sumber dan waktu yang jelas.
-   Rekomendasi tidak boleh mengarang kemampuan, ketersediaan, atau
    harga.
-   Model yang digunakan di dalam Rencanaku.ai tidak otomatis menjadi
    model yang direkomendasikan untuk coding agent eksternal.

### 13.4 Perbaikan prompt

-   Setiap tugas memiliki input khusus untuk instruksi perbaikan.
-   Pengguna dapat mengirim teks, file, gambar, atau screenshot yang
    relevan.
-   AI menganalisis hasil atau kesalahan dan membuat prompt tindak
    lanjut.
-   Prompt revisi tetap terhubung dengan prompt awal dan tugas yang
    sama.
-   Riwayat semua versi dipertahankan.
-   Kegagalan percobaan tidak otomatis membuat tugas baru.
-   Siklus berlanjut sampai pengguna memutuskan tugas selesai.
-   Pengguna dapat memilih bagian file atau rentang baris yang relevan
    agar konteks tidak membesar secara tidak perlu.

## 14. Percobaan Coding Agent, Laporan, dan Validasi

### 14.1 Riwayat percobaan

Sistem menyimpan riwayat lengkap setiap percobaan, termasuk: - Prompt
yang digunakan. - Versi prompt. - Hasil atau laporan dari coding
agent. - File dan screenshot pendukung. - Waktu dan status. - Kesimpulan
validasi. - Hubungan dengan percobaan sebelumnya. - Perbandingan
antarversi bila tersedia. - Tindak lanjut yang diusulkan.

### 14.2 Pelaporan hasil

Pengguna dapat melaporkan hasil melalui: - Chat bebas. - Formulir
laporan yang terhubung ke tugas.

Laporan harus terkait dengan tugas dan prompt yang digunakan. AI dapat
menyarankan langkah berikutnya, membuat prompt revisi, atau meminta
bukti tambahan.

### 14.3 Validasi

-   AI membandingkan bukti yang disediakan dengan kriteria penerimaan.
-   Status kriteria harus dibedakan menjadi terpenuhi, tidak terpenuhi,
    atau belum terverifikasi.
-   AI tidak boleh mengklaim pengujian telah dilakukan jika tidak ada
    bukti.
-   Jika bukti tidak cukup, aplikasi meminta informasi tambahan atau
    menandai hasil sebagai belum terverifikasi.
-   Validasi dan kesimpulan disimpan pada riwayat percobaan.

### 14.4 Perubahan rencana setelah implementasi dimulai

Ketika rencana berubah, sistem harus: - Mengidentifikasi tugas yang
terpengaruh. - Mengidentifikasi dependensi yang perlu diubah. -
Mengidentifikasi dokumen dan prompt yang usang. - Menilai perubahan
kriteria penerimaan. - Mengusulkan rekonsiliasi. - Menampilkan dampak
kepada pengguna. - Meminta persetujuan sebelum menerapkan perubahan
resmi.

### 14.5 Penutupan proyek

Sebelum penutupan, AI memeriksa: - Status semua tugas. - Kriteria
penerimaan. - Masalah yang belum terselesaikan. - Dokumen final. - Bukti
validasi. - Prompt atau percobaan yang masih memerlukan tindak lanjut.

AI memberi ringkasan dan rekomendasi. Pengguna mengonfirmasi penutupan
proyek secara eksplisit.

## 15. Manajemen Proyek

### 15.1 Operasi proyek

Pengguna dapat: - Membuat proyek. - Mengganti nama. - Menggandakan. -
Mengarsipkan. - Memulihkan proyek dari menu arsip dengan konfirmasi. -
Menghapus dengan konfirmasi. - Mencari proyek. - Melihat status dan
aktivitas.

Status proyek: - Aktif. - Selesai. - Diarsipkan.

### 15.2 Duplikasi

Duplikasi proyek menyalin: - Informasi dasar proyek. - Dokumen
konteks. - Rencana. - Tugas. - Lampiran. - Memori proyek.

Duplikasi **tidak menyalin riwayat chat**. Salinan memori harus
konsisten dengan dokumen dan keputusan yang ikut disalin. Identitas
artefak yang baru harus dibedakan dari artefak sumber agar perubahan
berikutnya tidak saling memengaruhi.

### 15.3 Arsip dan pemulihan

-   Proyek yang diarsipkan dapat dipulihkan melalui menu arsip dengan
    konfirmasi.
-   Pemulihan mengembalikan proyek ke status kerja sebelumnya jika dapat
    ditentukan.
-   Pemulihan tidak boleh mengubah isi proyek diam-diam.
-   Dependensi dan status artefak diperiksa setelah pemulihan.
-   Konflik atau perubahan yang terdeteksi harus dijelaskan kepada
    pengguna.

### 15.4 Penghapusan dan retensi

-   Penghapusan memerlukan konfirmasi.
-   Proyek masuk ke tempat sampah atau status penghapusan tertunda.
-   Retensi dapat dikonfigurasi.
-   Penghapusan permanen dilakukan secara terkendali.
-   UI harus menjelaskan dampak terhadap dokumen, lampiran, memori,
    riwayat percobaan, dan backup.
-   Backup lama mungkin masih berisi data yang sudah dihapus dari
    penyimpanan aktif.
-   Kebijakan penghapusan harus membedakan penghapusan aktif,
    penghapusan permanen, dan berakhirnya retensi backup.

### 15.5 Pencarian

Pencarian versi awal berbasis metadata untuk: - Proyek. - Percakapan. -
Dokumen. - Prompt. - Lampiran.

Pencarian teks penuh tidak menjadi persyaratan versi awal. Hasil
pencarian harus mengikuti izin akses pengguna.

## 16. Lampiran dan Impor File

### 16.1 Format

Aplikasi dapat menerima dokumen, PDF, JSON, YAML, source code, gambar,
screenshot, dan format lain yang aman diproses serta didukung oleh
model/provider yang digunakan.

### 16.2 Pengelolaan lampiran

-   Lampiran menjadi bagian dari alur percakapan seperti aplikasi AI
    pada umumnya.
-   Lampiran dapat digunakan kembali pada percakapan, dokumen, rencana,
    dan tugas yang relevan.
-   Pengguna dapat memberi label dan mencari lampiran.
-   Metadata mencatat nama, jenis, ukuran, hash, pemilik, relasi proyek,
    dan lokasi penyimpanan.
-   Hak akses lampiran mengikuti hak akses proyek.

### 16.3 Impor proyek

-   Pengguna memilih dan mengunggah file secara manual.
-   File sumber kode diperlakukan sebagai teks/data untuk analisis.
-   File yang diimpor tidak boleh dieksekusi.
-   Jenis dan ukuran file harus divalidasi.
-   Nama file dan jalur harus dinormalisasi.
-   File yang tidak didukung harus ditolak atau ditangani sebagai file
    tidak dapat diproses, dengan penjelasan.
-   Pemindaian folder lokal langsung dan impor ZIP tidak menjadi
    persyaratan versi awal.

## 17. Penyimpanan, Backup, Pemulihan, dan Ruang Disk

### 17.1 Struktur penyimpanan

-   Database utama: SQLite.
-   Dokumen dan lampiran besar: sistem berkas.
-   Metadata dan relasi: database.
-   Data utama disimpan di direktori terpisah dari kode aplikasi.
-   Lokasi penyimpanan dapat dikonfigurasi.
-   Perubahan lokasi penyimpanan harus melalui prosedur tervalidasi.

### 17.2 Autosave

Perubahan proyek disimpan otomatis, termasuk: - Pesan pengguna. -
Jawaban AI. - Memori. - Dokumen. - Rencana. - Tugas. - Prompt. - Laporan
hasil. - Riwayat percobaan. - Pengaturan proyek yang relevan.

Autosave bukan pengganti backup.

### 17.3 Backup

-   Backup manual tersedia.
-   Backup terjadwal tersedia.
-   Retensi backup dapat dikonfigurasi.
-   Backup harus mencakup database dan file yang terkait secara
    konsisten.
-   Backup harus memiliki metadata waktu, versi aplikasi, dan status
    validasi.
-   Proses backup harus menangani perubahan data yang terjadi selama
    proses berjalan.
-   Log backup tidak boleh mengandung rahasia.

### 17.4 Pemulihan

-   Prosedur pemulihan harus memeriksa integritas backup.
-   Database dan file harus dipulihkan sebagai satu kesatuan yang
    konsisten.
-   Pemulihan tidak boleh menimpa data aktif tanpa konfirmasi yang
    sesuai.
-   Sebelum operasi pemulihan berisiko, buat backup keadaan saat ini
    bila memungkinkan.
-   Prosedur pemulihan harus diuji.
-   Kegagalan pemulihan harus memberi pesan dan langkah pemulihan yang
    jelas.

### 17.5 Pemantauan penyimpanan

Sistem harus: - Menampilkan penggunaan penyimpanan total. - Menampilkan
penggunaan per proyek. - Mengidentifikasi file berukuran besar. -
Menampilkan ukuran backup. - Memberi peringatan ketika ruang disk
rendah. - Mengidentifikasi file yang berpotensi aman dibersihkan. -
Menjelaskan dampak penghapusan file. - Melindungi file aktif atau yang
masih dibutuhkan dari penghapusan otomatis. - Tidak menghapus file aktif
secara otomatis hanya untuk membebaskan ruang.

### 17.6 Ekspor dan impor data

-   Ekspor standar dilakukan per dokumen.
-   Ekspor ZIP seluruh proyek tidak menjadi fitur standar versi awal.
-   Backup adalah mekanisme pemulihan, bukan format pertukaran proyek.
-   Impor/ekspor proyek portabel dapat dipertimbangkan sebagai fitur
    terpisah di masa mendatang, bukan persyaratan MVP.

## 18. Keamanan, Privasi, dan Audit

### 18.1 Keamanan aplikasi

-   Validasi input di server.
-   Otorisasi pada setiap akses proyek dan file.
-   Perlindungan CSRF pada operasi yang mengubah data.
-   Cookie sesi dengan atribut keamanan yang sesuai.
-   Pembatasan upaya login.
-   Hash kata sandi.
-   Perlindungan terhadap path traversal pada nama dan jalur file.
-   Validasi MIME/type, ukuran, dan isi file bila memungkinkan.
-   File unggahan tidak dieksekusi.
-   Sanitasi Markdown/HTML sebelum ditampilkan.
-   Pencegahan kebocoran rahasia pada log, error, dan respons API.
-   Pengaturan keamanan untuk deployment server dan reverse proxy harus
    didokumentasikan.

### 18.2 Kunci API

Keputusan produk menetapkan kunci API dalam file konfigurasi lokal.
Karena itu: - Izin file dibatasi. - File tidak boleh disimpan di
direktori publik. - Nilai kunci disamarkan di UI. - Nilai kunci tidak
ditulis ke log. - Ekspor biasa tidak menyertakan kunci. - Contoh
konfigurasi harus menggunakan nilai dummy. - Akses terhadap konfigurasi
dibatasi, terutama pada server multi-pengguna. - Dokumentasi harus
menjelaskan bahwa akses administrator sistem terhadap mesin dapat
memiliki konsekuensi keamanan terhadap file konfigurasi.

### 18.3 Privasi provider

-   Pada penggunaan awal provider, jelaskan jenis data yang dapat
    dikirim ke provider tersebut.
-   Konteks yang dikirim dipilih sesuai kebutuhan tugas.
-   Pengguna dapat melihat dan mengedit konteks sebelum permintaan
    dikirim.
-   Pengiriman otomatis tidak meminta konfirmasi setiap kali, sesuai
    keputusan produk.
-   Aplikasi harus memberi peringatan saat provider baru digunakan atau
    jenis pengiriman berubah secara material.
-   Aplikasi tidak boleh menyatakan data tetap lokal jika data dikirim
    ke provider eksternal.

### 18.4 Log dan audit

-   Log standar mencatat metadata proses.
-   Log terperinci dapat diaktifkan secara opsional.
-   Rahasia dan isi sensitif harus disamarkan atau dikecualikan.
-   Tindakan administratif penting perlu dicatat.
-   Log audit tidak boleh memberikan akses baca ke isi proyek privat.
-   Log teknis yang diekspor harus menghapus kunci, token, dan rahasia.
-   Kebijakan retensi log harus dapat dikonfigurasi atau ditetapkan
    secara eksplisit dalam konfigurasi produk.

## 19. Penanganan Kesalahan dan Pekerjaan Panjang

### 19.1 Kategori kesalahan

Sistem perlu membedakan: - Kesalahan koneksi. - Provider tidak
tersedia. - Kredensial tidak valid. - Model tidak tersedia. - Batas
laju. - Kuota habis. - Konteks terlalu besar. - Keluaran tidak sesuai
format. - Validasi keluaran gagal. - Kegagalan penyimpanan. - Konflik
versi file. - Kesalahan izin. - Kegagalan backup atau pemulihan. -
Gangguan proses atau server.

### 19.2 Perilaku kegagalan

Untuk setiap kesalahan yang relevan, tampilkan: - Ringkasan masalah. -
Kode atau kategori kesalahan. - Tahap yang gagal. - Dampak terhadap
pekerjaan. - Apakah hasil sebelumnya masih tersedia. - Opsi retry, ganti
model, perbaiki pengaturan, atau sesuaikan konteks. - Langkah diagnostik
bila relevan.

### 19.3 Pekerjaan panjang

-   Tampilkan status dan progres per tahap.
-   Pengguna dapat membatalkan.
-   Hasil tahap yang sukses disimpan.
-   Proses dapat dipulihkan setelah gangguan.
-   Pembatalan eksternal dilakukan bila didukung.
-   Jika provider masih dapat memproses setelah pembatalan lokal, beri
    tahu pengguna tentang kemungkinan proses dan biaya yang berlanjut.
-   Hasil parsial tidak diterapkan ke artefak resmi tanpa validasi.

## 20. Pengaturan dan Onboarding

### 20.1 Wizard penyiapan pertama

Wizard singkat mencakup: - Pembuatan akun awal. - Konfigurasi lokasi
penyimpanan. - Pilihan mode operasi sesuai deployment. - Konfigurasi
provider AI. - Validasi koneksi provider. - Opsi melewati konfigurasi AI
untuk diselesaikan nanti.

Wizard administrator hanya boleh digunakan sekali pada inisialisasi
awal.

### 20.2 Onboarding

-   Panduan singkat penggunaan.
-   Proyek contoh opsional.
-   Tips kontekstual yang dapat ditutup.
-   Akses bantuan dari setiap area aplikasi.
-   Tips tidak boleh menghalangi alur kerja.
-   Pengguna dapat mengakses bantuan lagi setelah onboarding ditutup.

### 20.3 Pengaturan

Pengaturan dibagi menjadi: - Pengaturan dasar. - Pengaturan lanjutan
pada halaman terpisah.

Pengaturan mencakup: - Tema. - Bahasa UI. - Shortcut keyboard. -
Preferensi chat. - Default model per jenis tugas. - Provider dan
model. - Lokasi penyimpanan. - Backup dan retensi. - Pengaturan
notifikasi. - Pengaturan penggunaan AI. - Pengaturan keamanan yang dapat
diubah pengguna sesuai haknya. - Pengaturan diagnostik. - Pengaturan
server sesuai izin administrator.

## 21. Diagnostik, Kesehatan Sistem, dan Pembaruan

### 21.1 Health monitoring

-   Pemeriksaan kesehatan dapat dijadwalkan.
-   Ambang peringatan dapat dikonfigurasi.
-   Metrik harus sesuai mode lokal atau server.
-   Pemantauan tidak boleh membebani mode lokal secara berlebihan.
-   Status provider dan penyimpanan ditampilkan secara jelas.
-   Peringatan ruang disk rendah harus tersedia.

### 21.2 Diagnostik

-   Menampilkan status kesehatan.
-   Menggunakan kode kesalahan.
-   Memberikan saran perbaikan.
-   Mengizinkan ekspor log teknis yang telah disamarkan.
-   Mencatat kegagalan backup, migrasi, dan proses AI.
-   Tidak mengekspos isi proyek privat dalam laporan diagnostik secara
    otomatis.

### 21.3 Pembaruan aplikasi

-   Pengguna dapat memeriksa pembaruan secara manual.
-   Pemeriksaan ringan saat startup dapat disediakan dan dapat
    dinonaktifkan.
-   Aplikasi memberi tahu jika versi baru tersedia.
-   Unduh dan instalasi dilakukan manual.
-   CLI membantu backup dan validasi kesiapan migrasi.
-   Migrasi harus memiliki versi, validasi, dan prosedur pemulihan.
-   Versi aplikasi yang lebih baru tidak boleh menggunakan skema
    database tanpa memeriksa kebutuhan migrasi.
-   Pembaruan tidak boleh merusak data atau mengganti konfigurasi
    rahasia secara diam-diam.

### 21.4 Pelaporan bug

Pada versi awal, pengguna melaporkan bug secara manual melalui chat atau
kanal komunikasi yang ditentukan. Sistem tiket khusus bukan persyaratan
awal. Informasi diagnostik yang dibagikan harus disamarkan.

## 22. Kebutuhan Fungsional

ID di bawah digunakan sebagai rujukan kebutuhan dan kriteria pengujian.

### 22.1 Proyek

-   **FR-PROJ-001:** Pengguna dapat membuat proyek dari alur chat atau
    aksi dashboard.
-   **FR-PROJ-002:** Pengguna dapat mengganti nama, menggandakan,
    mengarsipkan, memulihkan, dan menghapus proyek.
-   **FR-PROJ-003:** Status proyek mendukung aktif, selesai, dan
    diarsipkan.
-   **FR-PROJ-004:** Duplikasi menyalin dokumen konteks, rencana, tugas,
    lampiran, dan memori, tetapi tidak menyalin riwayat chat.
-   **FR-PROJ-005:** Pemulihan arsip memerlukan konfirmasi dan
    pemeriksaan dependensi.
-   **FR-PROJ-006:** Penghapusan memiliki konfirmasi, retensi, dan
    penghapusan permanen terkendali.
-   **FR-PROJ-007:** Pencarian proyek berbasis metadata mengikuti izin
    akses.

### 22.2 Percakapan dan AI

-   **FR-AI-001:** Chat mendukung mode diskusi dan hasil cepat.
-   **FR-AI-002:** Pemilih model menampilkan provider dan model serta
    mendukung pencarian.
-   **FR-AI-003:** Default model dapat ditetapkan per jenis tugas.
-   **FR-AI-004:** Pengguna dapat mengganti model.
-   **FR-AI-005:** Aplikasi menampilkan status, durasi, model/provider,
    dan kesalahan.
-   **FR-AI-006:** Aplikasi menangani antrean, batas laju, retry,
    pembatalan, dan pemulihan proses.
-   **FR-AI-007:** Aplikasi menampilkan token dan biaya bila diketahui
    serta menandai estimasi.
-   **FR-AI-008:** Keluaran AI harus divalidasi sebelum diterapkan pada
    artefak resmi.
-   **FR-AI-009:** Konteks yang dikirim dapat diperiksa dan diedit oleh
    pengguna.
-   **FR-AI-010:** Kegagalan AI tidak boleh menghilangkan hasil tahap
    sebelumnya yang berhasil.

### 22.3 Memori

-   **FR-MEM-001:** Sistem menyimpan memori proyek terstruktur secara
    otomatis.
-   **FR-MEM-002:** Riwayat chat dan memori terstruktur disimpan
    terpisah.
-   **FR-MEM-003:** Memori memiliki sumber dan riwayat.
-   **FR-MEM-004:** Konflik terhadap keputusan terkunci memerlukan
    keputusan pengguna.
-   **FR-MEM-005:** Pengguna dapat memperbaiki memori melalui chat.
-   **FR-MEM-006:** Konteks memori dipilih secara dinamis sesuai tugas.

### 22.4 Dokumen

-   **FR-DOC-001:** Pengguna memilih dokumen dari katalog menggunakan
    checkbox.
-   **FR-DOC-002:** AI dapat menyarankan dokumen tambahan.
-   **FR-DOC-003:** Editor mendukung Markdown, pratinjau, dan
    penyuntingan langsung.
-   **FR-DOC-004:** Revisi AI menghasilkan diff.
-   **FR-DOC-005:** Perubahan dapat diterima atau ditolak.
-   **FR-DOC-006:** Versi dokumen dipertahankan.
-   **FR-DOC-007:** Perubahan diperiksa terhadap konsistensi dan dampak
    pada rencana serta prompt.
-   **FR-DOC-008:** Konflik versi file dicegah melalui pemeriksaan
    versi/hash.

### 22.5 Rencana dan tugas

-   **FR-PLAN-001:** Rencana diawali modal instruksi dan pemilihan
    model.
-   **FR-PLAN-002:** Kesiapan rencana diperiksa sebelum prompt dibuat.
-   **FR-PLAN-003:** Rencana dapat direvisi dan harus disetujui
    pengguna.
-   **FR-PLAN-004:** Dependensi tugas dinyatakan eksplisit dan
    divalidasi.
-   **FR-PLAN-005:** Kriteria penerimaan disimpan bersama tugas.
-   **FR-TASK-001:** Status tugas mendukung belum dimulai, sedang
    dikerjakan, selesai, dan terblokir.
-   **FR-TASK-002:** Hanya pengguna yang dapat menetapkan status
    selesai.
-   **FR-TASK-003:** Perubahan rencana memicu analisis dampak.
-   **FR-TASK-004:** Prompt dibuat terpisah untuk setiap tugas.
-   **FR-TASK-005:** Prompt memiliki versi dan hubungan ke rencana serta
    tugas.
-   **FR-TASK-006:** Perbaikan prompt tetap terhubung dengan tugas dan
    prompt awal.
-   **FR-TASK-007:** Riwayat percobaan dan laporan hasil disimpan.
-   **FR-TASK-008:** Validasi membedakan terpenuhi, tidak terpenuhi, dan
    belum terverifikasi.

### 22.6 File dan penyimpanan

-   **FR-FILE-001:** Pengguna dapat mengunggah format yang didukung.
-   **FR-FILE-002:** File divalidasi berdasarkan jenis dan ukuran.
-   **FR-FILE-003:** File tidak dieksekusi.
-   **FR-FILE-004:** Lampiran dapat digunakan kembali pada artefak yang
    relevan.
-   **FR-FILE-005:** Data disimpan di lokasi yang dapat dikonfigurasi.
-   **FR-FILE-006:** Autosave mencakup semua perubahan proyek yang
    relevan.
-   **FR-FILE-007:** Backup manual dan terjadwal tersedia.
-   **FR-FILE-008:** Pemulihan memvalidasi konsistensi database dan
    file.
-   **FR-FILE-009:** Pemantauan penyimpanan menampilkan penggunaan, file
    besar, backup, dan peringatan ruang rendah.
-   **FR-FILE-010:** File aktif tidak dihapus otomatis untuk membebaskan
    ruang.
-   **FR-FILE-011:** Ekspor standar dilakukan per dokumen.

### 22.7 Akun dan administrasi

-   **FR-AUTH-001:** Setup awal membuat administrator satu kali.
-   **FR-AUTH-002:** Pendaftaran publik nonaktif secara default.
-   **FR-AUTH-003:** Administrator dapat membuat, mengaktifkan,
    menonaktifkan, dan mengatur ulang akun anggota.
-   **FR-AUTH-004:** Kata sandi disimpan sebagai hash.
-   **FR-AUTH-005:** Kata sandi sementara harus diganti.
-   **FR-AUTH-006:** Proyek privat tidak dapat diakses anggota lain.
-   **FR-AUTH-007:** Admin tidak otomatis memiliki akses ke isi proyek
    privat.
-   **FR-AUTH-008:** Provider bersama dan kunci pribadi didukung sesuai
    izin.
-   **FR-AUTH-009:** Penggunaan AI dapat dicatat dan dibatasi per
    anggota.

### 22.8 Operasi

-   **FR-OPS-001:** CLI dapat menjalankan, menghentikan, memeriksa
    status, dan melihat log.
-   **FR-OPS-002:** CLI memvalidasi konfigurasi.
-   **FR-OPS-003:** CLI memeriksa versi dan memberi tahu pembaruan.
-   **FR-OPS-004:** Pembaruan dipasang secara manual.
-   **FR-OPS-005:** Backup dan pemulihan diuji.
-   **FR-OPS-006:** Diagnostik dapat diekspor dengan rahasia disamarkan.
-   **FR-OPS-007:** Aplikasi mendukung mode lokal, server, dan Docker
    melalui satu codebase.

## 23. Kebutuhan Nonfungsional

### 23.1 Keamanan

-   Isolasi data harus ditegakkan di server.
-   Semua input eksternal divalidasi.
-   Rahasia tidak boleh muncul dalam log atau ekspor biasa.
-   Sesi dan autentikasi harus memiliki perlindungan yang sesuai.
-   File impor tidak boleh dieksekusi.
-   Data sensitif hanya dikirim ke provider sesuai konteks yang dipilih.
-   Operasi berisiko harus memiliki konfirmasi, validasi, dan mekanisme
    pemulihan.

### 23.2 Keandalan

-   Kegagalan AI tidak boleh merusak artefak resmi.
-   Pekerjaan panjang menyimpan hasil sukses per tahap.
-   Backup mencakup database dan file secara konsisten.
-   Migrasi database memiliki versi dan strategi pemulihan.
-   Penulisan file memeriksa konflik versi.
-   Proses pemulihan harus diuji.

### 23.3 Kinerja dan skalabilitas

-   Antarmuka harus responsif untuk desktop, tablet, dan ponsel.
-   Proses AI panjang dijalankan secara asinkron dengan status yang
    jelas.
-   Batas konkurensi dapat dikonfigurasi.
-   Operasi pencarian metadata harus menggunakan indeks yang sesuai
    ketika volume data memerlukannya.
-   Pemantauan lokal tidak boleh menghasilkan overhead yang tidak
    proporsional.
-   Struktur modular memungkinkan penambahan fitur tanpa memindahkan
    aplikasi ke microservices.

### 23.4 Pemeliharaan

-   Modul memiliki tanggung jawab dan antarmuka yang jelas.
-   Konfigurasi divalidasi saat startup.
-   Migrasi database terdokumentasi.
-   Log memiliki kategori dan kode kesalahan.
-   Dependensi dipatok.
-   Pengujian otomatis dijalankan pada perubahan yang relevan.
-   Dokumentasi arsitektur dan operasi diperbarui bersama perubahan.

### 23.5 Aksesibilitas dan kegunaan

-   Navigasi keyboard.
-   Fokus terlihat.
-   Kontras memadai.
-   Struktur semantik.
-   Dukungan screen reader.
-   Pengurangan animasi sesuai preferensi sistem.
-   Tampilan responsif.
-   Bahasa Indonesia sebagai default dan bahasa Inggris sebagai opsi.
-   Pesan kesalahan dapat dipahami dan menyertakan langkah pemulihan
    yang relevan.

## 24. Pengujian dan Jaminan Kualitas

### 24.1 Pengujian otomatis

Gunakan Vitest dan Supertest untuk pengujian yang sesuai, meliputi: -
Unit test fungsi dan layanan. - Integration test antar-modul. -
API/route test. - Regression test. - Validasi konfigurasi. - Otorisasi
dan isolasi data. - Validasi unggahan file. - Pengelolaan versi dan
diff. - Validasi dependensi rencana. - Alur persetujuan dokumen. -
Penanganan kegagalan AI. - Retry dan batas laju. - Pembatalan proses. -
Backup dan pemulihan. - Migrasi database. - Pencatatan log dan
penyamaran rahasia.

### 24.2 Pengujian manual

Pengujian manual harus meliputi: - Setup awal. - Konfigurasi provider. -
Membuat proyek dari chat. - Membuat dan mengubah dokumen konteks. -
Meninjau rencana dan menyetujui rencana. - Membuat prompt tugas. -
Melaporkan hasil coding agent. - Memperbaiki prompt. - Mengubah status
tugas. - Mengarsipkan dan memulihkan proyek. - Menghapus proyek dan
memeriksa retensi. - Backup dan pemulihan. - Penggunaan dari perangkat
mobile. - Mode lokal. - Mode server multi-pengguna. - Deployment
Docker. - Prosedur pembaruan manual.

### 24.3 Kriteria validasi

-   Tidak ada data proyek yang dapat diakses anggota tanpa izin.
-   Tidak ada kunci API yang muncul pada log, UI yang tidak berwenang,
    atau ekspor biasa.
-   Perubahan dokumen tidak menimpa versi yang lebih baru secara
    diam-diam.
-   Kegagalan proses AI tidak menghapus hasil sebelumnya.
-   Backup dapat dipulihkan ke keadaan yang konsisten.
-   Tugas tidak ditandai selesai oleh AI secara otomatis.
-   Perubahan rencana tidak memperbarui prompt resmi tanpa pemeriksaan
    dampak dan persetujuan.
-   Hasil validasi tidak mengklaim pengujian yang tidak dilakukan.
-   Proses penghapusan menjelaskan dampaknya terhadap backup.

## 25. Roadmap Pengembangan

Roadmap ini adalah urutan kerja tingkat tinggi. Rincian tugas,
dependensi, estimasi, dan kriteria penerimaan per modul perlu dibuat
pada rencana implementasi setelah PRD disetujui.

### Fase 1 --- Fondasi dan infrastruktur

1.  Inisialisasi proyek Node.js dan struktur modular monolith.
2.  Konfigurasi Express, EJS, Tailwind lokal, JavaScript, dan proses
    build CSS.
3.  Validasi konfigurasi menggunakan Zod.
4.  SQLite dan sistem migrasi.
5.  Lapisan akses data dan penyimpanan file.
6.  CLI dasar untuk start, stop, status, dan log.
7.  Pengujian unit dan integrasi awal.
8.  Direktori data terpisah dari kode.

**Gerbang fase:** aplikasi dapat dijalankan, konfigurasi divalidasi,
database dibuat dan dimigrasikan, serta operasi dasar teruji.

### Fase 2 --- Autentikasi dan keamanan dasar

1.  Wizard administrator awal.
2.  Login/logout dan sesi aman.
3.  Manajemen anggota.
4.  Hash kata sandi dan perubahan kata sandi sementara.
5.  Otorisasi server dan isolasi proyek.
6.  Perlindungan CSRF, pembatasan login, dan sanitasi input.
7.  Konfigurasi rahasia dan penyamaran log.

**Gerbang fase:** pengujian autentikasi dan isolasi akses lulus sebelum
mode server dianggap siap.

### Fase 3 --- Proyek dan workspace

1.  Dashboard.
2.  Sidebar dan navbar.
3.  Pembuatan proyek dari chat.
4.  Pengelolaan status proyek.
5.  Workspace chat dan panel artefak.
6.  Tema terang/gelap dan bahasa.
7.  Responsivitas dan aksesibilitas awal.
8.  Pencarian metadata.

**Gerbang fase:** pengguna dapat membuat dan mengelola proyek dengan
akses yang benar.

### Fase 4 --- Provider AI dan percakapan

1.  Registry provider/model.
2.  Provider bawaan dan kustom.
3.  Pengelolaan kunci bersama dan pribadi.
4.  Pengujian koneksi.
5.  Pemilih model dan default per tugas.
6.  Adapter AI.
7.  Chat, lampiran, dan status proses.
8.  Mode diskusi dan hasil cepat.
9.  Logging metadata dan penanganan kesalahan.
10. Transparansi konteks dan privasi.

**Gerbang fase:** permintaan AI dapat berjalan, gagal, dicoba ulang, dan
dipulihkan tanpa kehilangan data.

### Fase 5 --- Memori proyek

1.  Penyimpanan memori terstruktur.
2.  Rekaman keputusan.
3.  Sumber dan versi memori.
4.  Deteksi konflik.
5.  Perlindungan keputusan terkunci.
6.  Ringkasan bertingkat.
7.  Pemilihan konteks dinamis.
8.  Koreksi memori melalui chat.

**Gerbang fase:** keputusan lama tidak tertimpa diam-diam dan konteks
yang dipilih dapat ditinjau.

### Fase 6 --- Dokumen konteks

1.  Katalog dokumen.
2.  Pemilihan dokumen.
3.  Pembuatan draft.
4.  Editor Markdown dan pratinjau.
5.  Revisi AI terarah.
6.  Diff dan persetujuan.
7.  Versi dan keterlacakan.
8.  Validasi konsistensi.
9.  Deteksi konflik versi file.

**Gerbang fase:** dokumen dapat dibuat, ditinjau, diubah, dan dipulihkan
ke versi sebelumnya.

### Fase 7 --- Rencana, tugas, dan prompt

1.  Pemeriksaan kesiapan rencana.
2.  Modal pembuatan rencana.
3.  Revisi dan persetujuan.
4.  Dependensi tugas.
5.  Kriteria penerimaan.
6.  Pembuatan prompt per tugas.
7.  Rekomendasi coding agent.
8.  Riwayat versi prompt.
9.  Identifikasi prompt usang.

**Gerbang fase:** rencana harus disetujui sebelum prompt tugas resmi
dihasilkan.

### Fase 8 --- Percobaan dan perbaikan prompt

1.  Formulir atau chat laporan hasil.
2.  Lampiran bukti.
3.  Riwayat percobaan.
4.  Validasi kriteria penerimaan.
5.  Prompt tindak lanjut.
6.  Hubungan percobaan dan versi prompt.
7.  Analisis dampak perubahan rencana.
8.  Pemeriksaan penutupan proyek.

**Gerbang fase:** hasil dan status verifikasi dapat ditelusuri, dan AI
tidak mengubah status selesai secara otomatis.

### Fase 9 --- Operasi data dan administrasi

1.  Backup manual.
2.  Backup terjadwal.
3.  Retensi.
4.  Pemulihan dan uji integritas.
5.  Pemantauan ruang disk.
6.  Tempat sampah dan penghapusan permanen.
7.  Pengaturan provider bersama.
8.  Kuota dan pencatatan penggunaan.
9.  Notifikasi.
10. Diagnostik dan health monitoring.

**Gerbang fase:** backup dan pemulihan diuji, serta tindakan
administratif tidak membocorkan isi proyek privat.

### Fase 10 --- Deployment, kesiapan rilis, dan dokumentasi

1.  Docker dan volume persisten.
2.  Panduan deployment lokal dan server.
3.  Pemeriksaan pembaruan melalui CLI.
4.  Prosedur pembaruan manual dan migrasi.
5.  Pengujian regresi, keamanan, dan pemulihan.
6.  Audit aksesibilitas.
7.  Dokumentasi teknis.
8.  Panduan troubleshooting.
9.  Pengujian penerimaan lokal.
10. Pengujian penerimaan server multi-pengguna.

**Gerbang fase:** setiap mode operasi hanya dinyatakan siap setelah
kriteria khusus mode tersebut terpenuhi.

## 26. Dokumentasi Teknis yang Wajib Diserahkan

Paket dokumentasi harus mencakup: 1. PRD. 2. Dokumen arsitektur sistem.
3. Struktur direktori dan penjelasan modul. 4. Skema database dan
diagram relasi. 5. Deskripsi adapter dan konfigurasi provider AI. 6.
Kontrak API internal dan endpoint yang relevan. 7. Model data proyek,
dokumen, rencana, tugas, prompt, memori, dan percobaan. 8. Panduan setup
dan instalasi. 9. Panduan CLI. 10. Panduan konfigurasi provider. 11.
Panduan deployment lokal. 12. Panduan deployment server. 13. Panduan
Docker dan volume persisten. 14. Panduan backup dan pemulihan. 15.
Panduan migrasi database. 16. Panduan keamanan dan privasi. 17. Panduan
troubleshooting. 18. Strategi pengujian dan cara menjalankannya. 19.
Daftar kebutuhan fungsional dan status implementasi. 20. Catatan
keputusan teknis. 21. Daftar asumsi yang masih dapat ditinjau. 22.
Panduan pengembangan dan kontribusi. 23. Daftar dependensi beserta versi
yang digunakan. 24. Contoh konfigurasi tanpa rahasia. 25. Prosedur
pembaruan manual.

## 27. Aturan Kerja Coding Agent

Coding agent yang membantu membangun Rencanaku.ai harus mengikuti aturan
berikut:

1.  Membaca PRD dan dokumen arsitektur sebelum mengubah kode.
2.  Tidak mengubah persyaratan yang telah dikunci tanpa persetujuan
    pengguna.
3.  Mengidentifikasi file dan modul yang sudah ada sebelum membuat file
    baru.
4.  Jika pengguna meminta memperbarui file yang sudah ada, edit file
    tersebut; jangan membuat file duplikat tanpa alasan.
5.  Membaca hanya file atau rentang baris yang relevan jika konteks yang
    diperlukan dapat dibatasi.
6.  Menjelaskan asumsi ketika informasi tidak lengkap.
7.  Tidak mengarang hasil pengujian.
8.  Menjalankan pengujian yang relevan dan melaporkan hasil sebenarnya.
9.  Memeriksa dampak perubahan pada modul, database, dokumen, dan
    kontrak yang terkait.
10. Tidak mengubah keputusan resmi atau menerapkan perubahan dokumen
    tanpa alur persetujuan yang sesuai.
11. Tidak menandai tugas selesai secara otomatis.
12. Tidak melanjutkan tugas yang bergantung pada fondasi gagal.
13. Membuat atau memperbarui dokumentasi bersama perubahan.
14. Menyediakan ringkasan file yang berubah, alasan perubahan,
    pengujian, risiko, dan pekerjaan yang belum selesai.
15. Tidak menyimpan kunci API atau rahasia dalam kode, contoh
    konfigurasi, log, atau repositori.
16. Menjaga perubahan tetap terarah dan menghindari refaktor luas yang
    tidak diperlukan untuk tugas.
17. Menggunakan migrasi database yang aman dan dapat diuji.
18. Menjaga kompatibilitas antar-modul serta satu codebase modular
    monolith.
19. Mempertahankan riwayat perubahan yang relevan.
20. Menghentikan dan meminta persetujuan ketika menemukan konflik nyata
    dengan keputusan produk yang terkunci.

## 28. Kriteria Penerimaan Produk

Rencanaku.ai dapat dinyatakan memenuhi baseline produk ketika:

1.  Pengguna dapat membuat proyek dari chat dan mengelolanya melalui
    dashboard.
2.  Pengguna dapat mengonfigurasi provider dan memilih model untuk
    tugas.
3.  Percakapan dan memori terstruktur disimpan secara terpisah.
4.  Keputusan terkunci tidak dapat ditimpa oleh AI tanpa persetujuan.
5.  Pengguna dapat memilih, membuat, mengedit, memvalidasi, dan
    memversikan dokumen konteks.
6.  Rencana diperiksa kesiapannya, dapat direvisi, dan memerlukan
    persetujuan.
7.  Tugas memiliki dependensi, kriteria penerimaan, status, dan prompt.
8.  Prompt revisi dan percobaan coding agent terhubung ke tugas yang
    benar.
9.  Validasi hasil membedakan terpenuhi, tidak terpenuhi, dan belum
    terverifikasi.
10. Hanya pengguna yang dapat menandai tugas selesai dan mengonfirmasi
    penutupan proyek.
11. Pengelolaan file, autosave, backup, pemulihan, retensi, dan
    pemantauan penyimpanan berjalan.
12. Isolasi proyek dan file antaranggota teruji.
13. Kunci API dilindungi dan tidak muncul dalam log atau ekspor biasa.
14. Pekerjaan AI panjang dapat dipantau, dibatalkan, dan dipulihkan.
15. CLI menyediakan operasi dasar dan pemeriksaan pembaruan, sedangkan
    pemasangan versi baru tetap manual.
16. Mode lokal memenuhi kriteria keamanan, backup, pemulihan, dan
    pengujian lokal.
17. Mode server memenuhi kriteria tambahan untuk autentikasi, isolasi
    data, konfigurasi jaringan, dan keamanan.
18. Dokumentasi teknis dan panduan operasi wajib tersedia.
19. Pengujian unit, integrasi, API, regresi, keamanan, migrasi, backup,
    dan pemulihan yang relevan telah dijalankan.
20. Tidak ada hasil pengujian, kemampuan, biaya, atau dukungan provider
    yang dinyatakan sebagai fakta tanpa dasar yang dapat diperiksa.

## 29. Risiko dan Mitigasi

### 29.1 Ketergantungan provider AI

**Risiko:** API, model, batas laju, biaya, dan kemampuan provider
berubah.

**Mitigasi:** adapter provider, konfigurasi fleksibel, penanganan
kesalahan, pemeriksaan koneksi, dan transparansi biaya.

### 29.2 Konteks terlalu besar

**Risiko:** prompt gagal, biaya meningkat, atau informasi penting
hilang.

**Mitigasi:** pemilihan konteks relevan, batas model, ringkasan
bertingkat, pemberitahuan konteks yang diringkas atau dihilangkan, serta
kontrol pengguna.

### 29.3 Ketidakkonsistenan artefak

**Risiko:** perubahan dokumen membuat rencana dan prompt usang.

**Mitigasi:** versi, relasi artefak, diff, analisis dampak, dan
persetujuan rekonsiliasi.

### 29.4 Kehilangan atau kerusakan data

**Risiko:** database dan file tidak konsisten setelah gangguan.

**Mitigasi:** backup konsisten, pemeriksaan integritas, migrasi
terversi, uji pemulihan, dan penyimpanan data terpisah dari kode.

### 29.5 Kebocoran data multi-pengguna

**Risiko:** akses proyek lintas pengguna atau kebocoran kunci API.

**Mitigasi:** otorisasi server, pengujian isolasi, hash kata sandi,
pembatasan sesi, penyamaran rahasia, dan pengaturan izin file.

### 29.6 Kesalahan hasil AI

**Risiko:** persyaratan, dokumen, atau prompt yang keliru diterapkan
sebagai keputusan resmi.

**Mitigasi:** validasi adaptif, diff, persetujuan pengguna, riwayat
versi, dan pemisahan antara rekomendasi dengan keputusan terkunci.

### 29.7 Kompleksitas implementasi

**Risiko:** seluruh fitur dikerjakan sekaligus dan sulit diuji.

**Mitigasi:** roadmap berfase, dependensi eksplisit, checkpoint,
kriteria penerimaan, dan penghentian progres jika fondasi gagal.

## 30. Asumsi Teknis yang Harus Dikunci Saat Implementasi

Bagian ini berisi keputusan teknis yang memang belum ditentukan sebagai
nilai final. Bagian ini bukan persyaratan produk baru, melainkan daftar
implementasi yang harus dipilih dan didokumentasikan sebelum komponen
terkait dibuat.

1.  Versi Node.js LTS dan versi dependensi yang masih didukung.
2.  Skema dan versi migrasi SQLite.
3.  Algoritme hashing kata sandi dan konfigurasi parameter yang aman.
4.  Strategi sesi dan penyimpanan sesi untuk mode lokal/server.
5.  Batas ukuran file per jenis dan batas total penyimpanan unggahan.
6.  Nilai default retensi backup dan masa penyimpanan item di tempat
    sampah.
7.  Frekuensi backup terjadwal default.
8.  Ambang peringatan ruang disk.
9.  Kebijakan retry per kategori kegagalan AI.
10. Batas konkurensi dan prioritas antrean default.
11. Perilaku ketika input berubah di tengah pekerjaan panjang.
12. Mekanisme pembatalan per provider.
13. Aturan penyimpanan dan retensi log.
14. Mekanisme sinkronisasi katalog model provider.
15. Daftar provider bawaan yang akan tersedia saat rilis.
16. Ambang dan jadwal health check.
17. Mekanisme serta format diagnostik yang diekspor.
18. Kebijakan retensi notifikasi dan riwayat proses.
19. Format file konfigurasi dan izin sistem operasi.
20. Metode pemeriksaan versi aplikasi dan sumber informasi pembaruan.
21. Prosedur rollback migrasi bila rollback otomatis tidak aman.
22. Perilaku aplikasi jika ruang disk habis saat autosave atau backup.
23. Aturan kapan chat awal diubah menjadi proyek resmi.
24. Detail implementasi editor Markdown, sanitasi, dan diff.
25. Detail teknis katalog dokumen yang dapat diperluas.

Nilai-nilai tersebut harus dipilih berdasarkan pengujian dan
kompatibilitas implementasi. Jika suatu pilihan mengubah perilaku produk
atau bertentangan dengan keputusan yang telah dikunci, perubahan harus
diajukan untuk persetujuan.

------------------------------------------------------------------------

## 31. Ringkasan Status

Rencanaku.ai dirancang sebagai aplikasi perencanaan proyek berbasis AI
dengan arsitektur modular monolith, dukungan lokal dan server, provider
AI yang fleksibel, memori terstruktur, dokumen berversi, rencana dan
tugas yang dapat ditelusuri, siklus perbaikan prompt coding agent,
penyimpanan yang dapat dipulihkan, serta tata kelola keamanan dan akses
yang jelas.

Dokumen ini menjadi baseline kebutuhan produk untuk menyusun arsitektur
rinci dan rencana implementasi. Rencana teknis per tugas harus mengikuti
kebutuhan fungsional, kebutuhan nonfungsional, kriteria penerimaan, dan
aturan kerja coding agent yang dijabarkan di atas.

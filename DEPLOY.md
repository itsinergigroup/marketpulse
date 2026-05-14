# 📖 Panduan Deployment MarketPulse

**Untuk:** Tim IT (Non-Developer)
**Bahasa:** Bahasa Indonesia
**Level:** Pemula — semua perintah siap copy-paste

---

> ⚠️ **PENTING SEBELUM MULAI**
> - Gunakan laptop/PC yang terhubung ke internet
> - Semua perintah di bawah bisa langsung di-copy-paste
> - Jangan ubah apapun kecuali diminta
> - Kalau ada yang aneh/error, screenshot dan kirim ke developer

---

## 📋 Daftar Isi

- [Skenario A — Instalasi Baru (Pertama Kali)](#skenario-a--instalasi-baru-pertama-kali)
- [Skenario B — Update Aplikasi (Ada Versi Baru)](#skenario-b--update-aplikasi-ada-versi-baru)
- [Skenario C — Reset Password Admin](#skenario-c--reset-password-admin-tidak-bisa-login)
- [Tabel Jawaban Script](#tabel-jawaban-script)
- [Troubleshooting](#-troubleshooting)
- [Kontak Developer](#-kontak-developer)

---

# SKENARIO A — Instalasi Baru (Pertama Kali)

> Gunakan skenario ini kalau aplikasi belum pernah dipasang di VPS sebelumnya.

---

## Langkah A1 — Upload File Database ke VPS

Sebelum install, file database (`marketpulse_export.sql`) harus sudah ada di VPS.

Pilih **salah satu** cara berikut:

---

### 💻 Cara 1: Upload Pakai FileZilla (Lebih Mudah)

**Download FileZilla dulu jika belum ada:**
Buka browser → ketik `https://filezilla-project.org` → klik **Download FileZilla Client**

**Langkah koneksi:**

1. Buka FileZilla
2. Isi form di bagian atas:

   | Kolom | Isi |
   |-------|-----|
   | Host | `202.74.74.95` |
   | Username | `sinergi` |
   | Password | *(password VPS — tanya developer)* |
   | Port | `22` |

3. Klik tombol **Quickconnect**

4. ✅ **Hasil yang diharapkan:** Panel kanan (Remote site) menampilkan folder-folder VPS. Tidak ada pesan error merah.

5. Di panel kanan (Remote site), ketik path ini di kotak atas lalu tekan Enter:
   ```
   /home/sinergi
   ```

6. Di panel kiri (Local site), cari file `marketpulse_export.sql` di laptop Anda

7. Klik kanan file `marketpulse_export.sql` → pilih **Upload**

8. ✅ **Hasil yang diharapkan:** File muncul di panel kanan dalam folder `/home/sinergi/`. Transfer selesai 100%.

---

### 💻 Cara 2: Upload Pakai SCP (Terminal/Command Prompt)

> Gunakan cara ini kalau tidak mau install FileZilla.

**Di Windows:** Tekan `Windows + R` → ketik `cmd` → Enter
**Di Mac/Linux:** Buka aplikasi Terminal

Jalankan perintah berikut. **Ganti** `/path/ke/file/` dengan lokasi file SQL di laptop Anda:

```bash
scp /path/ke/file/marketpulse_export.sql sinergi@202.74.74.95:/home/sinergi/
```

**Contoh jika file ada di Desktop Windows:**
```bash
scp C:\Users\NamaAnda\Desktop\marketpulse_export.sql sinergi@202.74.74.95:/home/sinergi/
```

**Contoh jika file ada di Desktop Mac:**
```bash
scp ~/Desktop/marketpulse_export.sql sinergi@202.74.74.95:/home/sinergi/
```

Ketik `yes` jika ada pertanyaan, lalu masukkan password VPS.

✅ **Hasil yang diharapkan:**
```
marketpulse_export.sql          100%  5MB   1.2MB/s   00:04
```
*(Ukuran file dan kecepatan bisa berbeda, yang penting ada angka 100%)*

---

## Langkah A2 — Masuk ke VPS (SSH)

**Di Windows:** Tekan `Windows + R` → ketik `cmd` → Enter
**Di Mac/Linux:** Buka Terminal

```bash
ssh sinergi@202.74.74.95
```

Ketik `yes` jika ada pertanyaan tentang "authenticity", lalu masukkan password.

✅ **Hasil yang diharapkan:** Muncul teks seperti ini (tidak harus sama persis):
```
Welcome to Ubuntu 22.04.3 LTS
sinergi@vps:~$
```
Anda sekarang sudah berada di dalam VPS.

---

## Langkah A3 — Download & Jalankan Script Install

Ketik 3 perintah berikut **satu per satu**, tekan Enter setelah masing-masing:

**Perintah 1 — Download script install:**
```bash
curl -fsSL https://raw.githubusercontent.com/mnfai/marketpulse/main/install.sh -o install.sh
```

✅ **Hasil yang diharapkan:** Kembali ke baris `sinergi@vps:~$` tanpa error.

**Perintah 2 — Beri izin eksekusi:**
```bash
chmod +x install.sh
```

✅ **Hasil yang diharapkan:** Kembali ke baris `sinergi@vps:~$` tanpa error.

**Perintah 3 — Jalankan installer:**
```bash
./install.sh
```

✅ **Hasil yang diharapkan:** Script mulai berjalan dan menampilkan:
```
=================================================
   MarketPulse - Installer Ubuntu 22.04 LTS
=================================================

Brand name [amura/reglow]:
```

---

## Langkah A4 — Ikuti Pertanyaan Script

Script akan menanyakan beberapa hal. Lihat tabel di bawah untuk jawaban yang tepat per brand.

### 📋 Tabel Jawaban Script

| Pertanyaan Script | Amura | Reglow |
|---|---|---|
| `Brand name [amura/reglow]:` | `amura` | `reglow` |
| `Database name [marketpulse_amura]:` | *(tekan Enter saja)* | *(tekan Enter saja)* |
| `Database user [mp_amura]:` | *(tekan Enter saja)* | *(tekan Enter saja)* |
| `Database password:` | *(ketik password pilihan Anda)* | *(ketik password pilihan Anda)* |
| `Domain [mrfm.amura.id]:` | *(tekan Enter saja)* | *(tekan Enter saja)* |
| `Port [3000]:` | *(tekan Enter saja)* | *(tekan Enter saja)* |
| `Lanjutkan? [y/N]:` | `y` | `y` |

> ⚠️ **Catatan password database:**
> - Gunakan password yang kuat (minimal 12 karakter, campuran huruf dan angka)
> - **Simpan password ini di catatan aman** — dibutuhkan kalau ada masalah nanti
> - Saat mengetik password, layar tidak menampilkan karakter apapun — itu normal

Script akan berjalan otomatis selama **5–15 menit**. Tunggu sampai selesai.

✅ **Hasil yang diharapkan di akhir:**
```
================================
✅ INSTALASI SELESAI!
================================
Brand          : amura
App URL        : http://mrfm.amura.id
PM2 Process    : marketpulse-amura
Database       : marketpulse_amura
Port           : 3000
Users imported : 12

Emergency Reset URL:
http://mrfm.amura.id/emergency-reset?token=xxxxxxxxxxxx
⚠️  Simpan URL ini di tempat aman!
================================
```

> 📋 **PENTING:** Screenshot atau salin teks `Emergency Reset URL` dan simpan di tempat aman. URL ini dibutuhkan jika admin tidak bisa login.

---

## Langkah A5 — Arahkan DNS

Setelah install selesai, domain harus diarahkan ke IP VPS.

1. Login ke panel domain (Niagahoster, Cloudflare, dll.)
2. Cari menu **DNS Management** atau **DNS Records**
3. Tambahkan record baru:

   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | A | `mrfm.amura.id` | `202.74.74.95` | Auto |
   | A | `mrfm.reglow.id` | `202.74.74.95` | Auto |

4. Tunggu **5–30 menit** sampai DNS aktif

✅ **Cara cek DNS sudah aktif:** Buka browser → ketik `http://mrfm.amura.id` → halaman login MarketPulse muncul (mungkin ada peringatan "Not Secure" — itu normal sebelum SSL dipasang)

---

## Langkah A6 — Pasang SSL (HTTPS)

Masuk ke VPS dulu (seperti Langkah A2), lalu jalankan perintah berikut.

**Untuk Amura:**
```bash
sudo certbot --nginx -d mrfm.amura.id
```

**Untuk Reglow:**
```bash
sudo certbot --nginx -d mrfm.reglow.id
```

Jika ditanya:
- `Enter email address:` → ketik email Anda
- `Agree to terms? (A/C):` → ketik `A`
- `Share email? (Y/N):` → ketik `N`
- `How would you like to redirect?` → ketik `2`

✅ **Hasil yang diharapkan:**
```
Successfully received certificate.
Congratulations! You have successfully enabled HTTPS
```

Setelah ini, buka browser dan akses `https://mrfm.amura.id` — harus muncul gembok hijau 🔒.

---
---

# SKENARIO B — Update Aplikasi (Ada Versi Baru)

> Gunakan skenario ini kalau developer bilang ada update yang perlu dipasang.

---

## Langkah B1 — Masuk ke VPS

```bash
ssh sinergi@202.74.74.95
```

✅ Muncul prompt `sinergi@vps:~$`

---

## Langkah B2 — Jalankan Script Update

```bash
./update.sh
```

Script menanya brand mana yang di-update. Ketik `amura` atau `reglow` sesuai kebutuhan.

✅ **Hasil yang diharapkan:**
```
================================
✅ UPDATE SELESAI!
================================
Brand       : amura
PM2 Process : marketpulse-amura
Waktu       : 2025-06-01 10:30:00
================================
```

> ⚠️ **Jika perlu update keduanya:** Jalankan `./update.sh` dua kali — sekali untuk amura, sekali untuk reglow.

---
---

# SKENARIO C — Reset Password Admin (Tidak Bisa Login)

> Gunakan skenario ini kalau admin tidak bisa login dan password perlu di-reset.
> Lakukan dengan hati-hati — fitur ini membuka akses sementara ke aplikasi.

---

## Langkah C1 — Cari Tahu IP Laptop Anda

Buka browser → ketik di address bar:
```
https://api.ipify.org
```

Halaman menampilkan angka seperti `182.1.234.56` — **catat angka ini**.

---

## Langkah C2 — Masuk ke VPS & Edit File Konfigurasi

```bash
ssh sinergi@202.74.74.95
```

Pilih brand yang admin-nya tidak bisa login:

**Untuk Amura:**
```bash
nano /web/marketpulse-amura/.env
```

**Untuk Reglow:**
```bash
nano /web/marketpulse-reglow/.env
```

---

## Langkah C3 — Aktifkan Fitur Reset

Di dalam editor `nano`, cari baris yang mengandung `EMERGENCY_RESET`:

Ubah atau tambahkan 2 baris ini (ganti `182.1.234.56` dengan IP laptop Anda dari Langkah C1):

```
EMERGENCY_RESET_ENABLED=true
EMERGENCY_RESET_ALLOWED_IPS=182.1.234.56
```

**Cara menyimpan di nano:**
- Tekan `Ctrl + X`
- Tekan `Y`
- Tekan `Enter`

✅ Kembali ke prompt `sinergi@vps:~$`

---

## Langkah C4 — Restart Aplikasi

**Untuk Amura:**
```bash
pm2 restart marketpulse-amura
```

**Untuk Reglow:**
```bash
pm2 restart marketpulse-reglow
```

✅ **Hasil yang diharapkan:**
```
[PM2] Restarting 'marketpulse-amura' with id 0
[PM2] Done.
```

---

## Langkah C5 — Buka URL Reset di Browser

Buka URL Emergency Reset yang disimpan saat instalasi. Formatnya seperti ini:

```
http://mrfm.amura.id/emergency-reset?token=XXXXXXXXXXXXXXXXXX
```

> ⚠️ Jika URL ini hilang, hubungi developer untuk mendapatkan token dari file `.env`.

Ikuti instruksi di halaman tersebut untuk reset password admin.

---

## Langkah C6 — Matikan Fitur Reset (WAJIB)

Setelah password berhasil di-reset, **segera matikan fitur ini** agar tidak disalahgunakan.

**Untuk Amura:**
```bash
nano /web/marketpulse-amura/.env
```

**Untuk Reglow:**
```bash
nano /web/marketpulse-reglow/.env
```

Ubah baris `EMERGENCY_RESET_ENABLED` menjadi:
```
EMERGENCY_RESET_ENABLED=false
```

Simpan (`Ctrl + X` → `Y` → `Enter`), lalu restart:

**Untuk Amura:**
```bash
pm2 restart marketpulse-amura
```

**Untuk Reglow:**
```bash
pm2 restart marketpulse-reglow
```

✅ Fitur reset sudah dimatikan kembali.

---
---

# 🔧 Troubleshooting

## ❌ Error 1: "Connection refused" saat SSH

**Gejala:**
```
ssh: connect to host 202.74.74.95 port 22: Connection refused
```

**Penyebab:** VPS sedang down atau internet bermasalah.

**Solusi:**
1. Cek koneksi internet laptop Anda
2. Coba ping server: buka CMD/Terminal, ketik `ping 202.74.74.95`
3. Jika tidak ada reply, hubungi provider VPS atau developer

---

## ❌ Error 2: "Permission denied" saat SSH

**Gejala:**
```
sinergi@202.74.74.95: Permission denied (publickey,password)
```

**Penyebab:** Password salah.

**Solusi:**
1. Pastikan mengetik password dengan benar (huruf besar/kecil berpengaruh)
2. Coba lagi. Jika tetap gagal, hubungi developer untuk reset password VPS.

---

## ❌ Error 3: "File database tidak ditemukan" saat install

**Gejala:**
```
❌ File database tidak ditemukan di /home/sinergi/marketpulse_export.sql
```

**Penyebab:** File SQL belum di-upload ke VPS.

**Solusi:**
1. Pastikan file `marketpulse_export.sql` ada di laptop Anda
2. Upload ulang menggunakan FileZilla atau SCP (Langkah A1)
3. Jalankan `./install.sh` lagi

---

## ❌ Error 4: Halaman web tidak bisa dibuka setelah install

**Gejala:** Browser menampilkan "This site can't be reached" atau timeout.

**Penyebab:** DNS belum aktif atau Nginx belum berjalan.

**Solusi:**
1. Tunggu 10–30 menit setelah DNS diubah, lalu coba lagi
2. Cek Nginx berjalan — masuk VPS, ketik:
   ```bash
   sudo systemctl status nginx
   ```
   ✅ Harus ada tulisan `active (running)` berwarna hijau
3. Jika Nginx mati, jalankan:
   ```bash
   sudo systemctl start nginx
   ```

---

## ❌ Error 5: Aplikasi tiba-tiba tidak bisa diakses (setelah sebelumnya bisa)

**Gejala:** Halaman error atau tidak bisa dibuka padahal sebelumnya normal.

**Penyebab:** PM2 process mati (mungkin setelah server restart).

**Solusi:** Masuk VPS, cek status PM2:
```bash
pm2 list
```

✅ **Hasil yang diharapkan:** Ada baris `marketpulse-amura` dan/atau `marketpulse-reglow` dengan status `online` (hijau).

Jika status `stopped` atau `errored`, restart:
```bash
pm2 restart marketpulse-amura
pm2 restart marketpulse-reglow
```

Jika PM2 kosong (tidak ada proses sama sekali), kemungkinan server reboot. Jalankan:
```bash
pm2 resurrect
```

---
---

# 📞 Kontak Developer

Jika mengalami masalah yang tidak tercakup di atas, hubungi developer dengan menyertakan:

1. **Screenshot error** — foto layar atau copy-paste teks errornya
2. **Skenario** yang sedang dijalankan (A, B, atau C)
3. **Langkah terakhir** yang berhasil sebelum error

| Info | Detail |
|------|--------|
| Developer | mnfai |
| Email | mnfai.work@gmail.com |
| Repo | https://github.com/mnfai/marketpulse |

---

*Dokumen ini dibuat untuk tim IT non-developer. Update dokumen ini setiap ada perubahan prosedur.*

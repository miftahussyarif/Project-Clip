# Setup Cookies untuk Bypass YouTube Bot Detection

## Mengapa Cookies Diperlukan?

IP datacenter (seperti AWS Singapore) sering di-blacklist oleh YouTube. Dengan menggunakan cookies dari browser yang sudah login, YouTube akan mengenali request sebagai user yang sah.

---

## Langkah 1: Install Extension Browser

Di **Chrome/Edge**, install extension: [Cookie Editor](https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm)

---

## Langkah 2: Login ke YouTube

1. Buka **YouTube.com** di browser
2. Login dengan akun Google (gunakan akun sekunder jika khawatir)
3. Pastikan sudah login dengan sukses

---

## Langkah 3: Export Cookies

1. Di YouTube.com, klik icon **Cookie Editor** di toolbar browser
2. Klik tombol **Export** (icon panah ke bawah)
3. Pilih format **Netscape HTTP Cookie File**
4. Akan tercopy ke clipboard

---

## Langkah 4: Buat File cookies.txt di Server

SSH ke server VPS, lalu jalankan:

```bash
cd ~/Project-Clip
nano cookies.txt
```

Paste isi cookies yang sudah di-copy, lalu simpan (Ctrl+X, Y, Enter).

---

## Langkah 5: Restart Aplikasi

```bash
pm2 restart clip-genius
```

---

## Test Manual

Untuk memastikan cookies bekerja, test dengan yt-dlp langsung:

```bash
cd ~/Project-Clip
yt-dlp --cookies cookies.txt --dump-json "https://www.youtube.com/watch?v=2xvN9e9_4qs" 2>&1 | head -5
```

Jika berhasil, akan muncul JSON info video. Jika error, cookies mungkin expired atau tidak valid.

---

## Tips Penting

- **Cookies expire** setelah beberapa waktu, perlu di-update ulang jika error muncul lagi
- Gunakan **akun YouTube sekunder** untuk keamanan
- Jangan share file cookies.txt ke publik

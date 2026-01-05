# Panduan Deployment Project-Clip di AWS EC2 (Ubuntu)

Dokumen ini menjelaskan langkah-langkah detail untuk menginstal dan menjalankan Project-Clip di VPS AWS EC2 menggunakan sistem operasi Ubuntu (22.04 atau 24.04 LTS).

## 1. Persiapan Instance AWS EC2

### Konfigurasi Instance
1.  **Launch Instance**: Di dashboard AWS, pilih **Ubuntu Server 22.04 LTS**.
2.  **Instance Type**: Minimal `t3.small` (2GB RAM) direkomendasikan. Jika menggunakan `t2.micro` (1GB RAM), **wajib** mengikuti langkah *Swap Memory* di bawah agar proses build tidak error.
3.  **Security Group**: Pastikan Inbound Rules mengizinkan:
    -   **SSH (22)**: Untuk akses terminal.
    -   **HTTP (80)**: Untuk akses web.
    -   **HTTPS (443)**: Untuk akses web aman (jika pakai SSL).

### Koneksi SSH
Setelah instance berjalan, hubungkan melalui terminal Anda:
```bash
ssh -i "key-anda.pem" ubuntu@ip-public-ec2
```

---

## 2. Persiapan Sistem (Update & Dependency)

Setelah masuk ke server, jalankan perintah ini secara berurutan:

### a. Update Paket
```bash
sudo apt update && sudo apt upgrade -y
```

### b. Instal Node.js (v20 LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### c. Instal FFmpeg & yt-dlp
```bash
sudo apt install ffmpeg -y
sudo apt install yt-dlp -y
```

### d. Instal PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

---

## 3. Optimasi RAM (Langkah Wajib untuk RAM 1GB/2GB)

Next.js membutuhkan banyak RAM saat proses `build`. Jika RAM kecil, server akan hang atau proses dihentikan (killed). Gunakan Swap:

```bash
# Membuat file swap 2GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Simpan agar permanen saat restart
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 4. Setup Aplikasi

### a. Clone Repository
```bash
# Mengunduh project (sesuaikan link repo)
git clone https://github.com/miftahussyarif/Project-Clip.git
cd Project-Clip
```

### b. Instal Dependencies & Konfigurasi
```bash
npm install
```

Buat file `.env`:
```bash
nano .env
```
Isi dengan API Key Anda:
```env
GEMINI_API_KEY=AIzaSy...
# Tambahkan variabel lain jika ada
```
*Tekan `Ctrl + O`, `Enter`, lalu `Ctrl + X` untuk simpan dan keluar.*

### c. Build Project
```bash
npm run build
```

---

## 5. Menjalankan Aplikasi di Background (PM2)

Agar aplikasi tetap berjalan meskipun terminal ditutup:

```bash
# Jalankan app dengan PM2
pm2 start npm --name "clip-genius" -- start

# Pastikan PM2 jalan otomatis saat server restart
pm2 startup
pm2 save
```
*(Ikuti instruksi command yang muncul setelah `pm2 startup` untuk menyelesaikannya).*

---

## 6. Konfigurasi Nginx (Reverse Proxy)

Kita akan mengalihkan traffic dari port 80 ke port 3000 (Next.js).

### a. Instal Nginx
```bash
sudo apt install nginx -y
```

### b. Konfigurasi Site
```bash
sudo nano /etc/nginx/sites-available/clip-genius
```

Tempelkan kode ini (ganti `yourdomain.com` atau gunakan IP Public jika belum ada domain):
```nginx
server {
    listen 80;
    server_name yourdomain.com; # Ganti ke IP Public jika tidak ada domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### c. Aktifkan & Restart
```bash
sudo ln -s /etc/nginx/sites-available/clip-genius /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default # Hapus config default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 7. Setup SSL (HTTPS) - Opsional

Jika sudah memiliki domain, gunakan Certbot (gratis):
```bash
sudo apt install python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

---

## Ringkasan Perawatan Server
- **Cek Status App**: `pm2 status`
- **Lihat Log Error**: `pm2 logs clip-genius`
- **Restart App**: `pm2 restart clip-genius`
- **Update Kode Baru**:
  ```bash
  git pull
  npm install
  npm run build
  pm2 restart clip-genius
  ```

# PetaKonsep AI

PetaKonsep AI adalah aplikasi diagnostik pembelajaran berbasis Gemini untuk mengubah jawaban salah siswa menjadi peta akar miskonsepsi, jalur pemulihan, dan micro-lesson yang siap dipakai guru.

Project ini dibuat untuk konteks hackathon dengan fokus **SDG 4: Quality Education**.

## Fitur Utama

- **Cognitive diagnostic graph**: memetakan konsep target, prasyarat, status pemahaman, dan akar masalah.
- **Evidence-based diagnosis**: setiap node menyimpan bukti dari jawaban siswa.
- **Learning path**: urutan remedial dari akar masalah menuju konsep target.
- **Micro-lesson Bahasa Indonesia**: penjelasan inti, analogi lokal, worked example, dan 3 latihan.
- **Teacher insight**: ringkasan tindakan untuk guru.
- **Demo cepat**: contoh Matematika, Fisika, dan Bahasa Indonesia.
- **Export-ready**: salin laporan guru, salin JSON, dan unduh hasil diagnosis.

## Tech Stack

- Next.js App Router
- React
- Tailwind CSS
- Motion
- Lucide React
- Google Gemini via `@google/genai`

Tidak perlu menambah paket baru untuk menjalankan versi ini.

## Menjalankan Lokal

1. Pastikan dependency sudah tersedia.

   ```bash
   npm install
   ```

2. Buat file `.env.local`.

   ```bash
   GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
   ```

3. Jalankan aplikasi.

   ```bash
   npm run dev
   ```

4. Buka:

   ```text
   http://localhost:3000
   ```

## Cara Pakai

1. Klik salah satu **Demo Cepat** atau isi form manual.
2. Masukkan mata pelajaran, kelas, topik, soal, jawaban siswa, dan jawaban benar.
3. Pilih mode model:
   - **Cepat**: `gemini-2.5-flash`
   - **Akurasi**: `gemini-2.5-pro`
4. Klik **Mulai Analisis**.
5. Baca hasil pada:
   - Diagnosis utama
   - Knowledge Dependency Graph
   - Jalur belajar
   - Materi pemulihan
   - Latihan
   - Insight guru

## Environment

| Variable | Wajib | Keterangan |
| --- | --- | --- |
| `GEMINI_API_KEY` | Ya | API key Gemini untuk route `/api/analyze`. |
| `APP_URL` | Tidak | URL deployment, bila diperlukan. |

File `.env.local` sudah diabaikan oleh git, jadi aman untuk konfigurasi lokal. Jangan menaruh API key asli di README, kode, screenshot, atau commit.

## API

Endpoint:

```text
POST /api/analyze
```

Payload:

```json
{
  "subject": "Matematika",
  "grade": "SMP Kelas 8",
  "topic": "Pemfaktoran Persamaan Kuadrat",
  "question": "Tentukan nilai x dari x^2 - 5x + 6 = 0.",
  "studentAnswer": "x = 5 dan x = 6",
  "correctAnswer": "x = 2 dan x = 3",
  "additionalContext": "Siswa mengambil angka di soal sebagai jawaban langsung.",
  "modelName": "gemini-2.5-pro"
}
```

Response mengikuti struktur:

```text
meta
diagnosis
nodes[]
edges[]
root_cause_node_id
learning_path[]
summary
```

## Pitch Hackathon

Masalah pendidikan sering berhenti pada koreksi jawaban. PetaKonsep AI mengambil arah berbeda: setiap jawaban salah diperlakukan sebagai sinyal diagnostik untuk menemukan prasyarat yang hilang. Guru mendapatkan peta konsep, siswa mendapatkan rute belajar yang konkret, dan proses remedial menjadi lebih cepat, personal, serta mudah dijelaskan.

## Catatan Keamanan

- API key hanya dipakai di server route.
- Jangan expose `GEMINI_API_KEY` ke client component.
- Jika API key pernah terlanjur dipublikasikan, segera rotate key dari Google AI Studio.

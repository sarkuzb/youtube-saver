---

## 📽️ YouTube Video Downloader

A full-stack web application to download YouTube videos or audio in various formats and resolutions using `yt-dlp`, `Node.js`, and `React`.
Built with a clean UI, intelligent format filtering, and supports progressive and merged downloads.

---

### ⚙️ Features

* 🎬 Download YouTube videos in resolutions: 144p, 240p, 360p, 480p, 720p, 1080p, and more.
* 🎧 Download audio-only (MP3 or M4A).
* 🧠 Smart format filtering: only shows preferred formats like MP4.
* ⚡ Stream-based downloading (no file saved on server).
* 📦 Clean and responsive frontend built with React.
* 🛠 Uses `yt-dlp` and `ffmpeg` for advanced format handling.

---

### 📁 Project Structure

```
youtube-downloader/
│
├── backend/                 # Express server
│   ├── controllers/         # Route controllers
│   ├── services/            # YouTubeService logic (yt-dlp, ffmpeg)
│   ├── routes/              # API endpoints
│   └── index.js             # Entry point for Express app
│
├── frontend/                # React client
│   ├── components/          # UI components
│   ├── pages/               # Page-level components
│   ├── services/            # API functions
│   └── App.jsx              # Root component
│
├── README.md
└── package.json
```

---

### 🧪 Requirements

* Node.js (v16+ recommended)
* yt-dlp (Windows `.exe` used via absolute path)
* ffmpeg (installed and referenced in backend)

---

### 🚀 How to Run Locally

#### 1. Clone the repository

```bash
git clone https://github.com/your-username/youtube-downloader.git
cd youtube-downloader
```

#### 2. Backend Setup

```bash
cd backend
npm install
node server.js
```

> ✨ Make sure to update the `YTDLP_PATH` and `FFMPEG_PATH` in `services/YouTubeService.js` to match your local file paths.

#### 3. Frontend Setup

```bash
cd ../frontend
npm install
npm run dev
```

> The frontend runs on [http://localhost:5173](http://localhost:5173) and communicates with the backend at [http://localhost:5000](http://localhost:5000)

---

### 📸 Screenshot

<img width="616" height="486" alt="{C9DFD007-AD4E-49F6-87F5-06396539234F}" src="https://github.com/user-attachments/assets/071d7145-10fc-43f7-ad9d-fd0a448ed585" />\
<img width="683" height="772" alt="{1627225C-801C-4207-8D25-D4351F1E3EF9}" src="https://github.com/user-attachments/assets/67c21cce-f54b-4ced-9365-7bfa6217b659" />



---

### 📚 Tech Stack

* **Frontend:** React, Vite, CSS Modules
* **Backend:** Node.js, Express.js
* **Tools:** yt-dlp, ffmpeg

---

### 📌 Notes

* YouTube occasionally changes its streaming formats; this app uses `yt-dlp`, which is regularly updated to adapt.
* For best results, download the latest `yt-dlp.exe` from [https://github.com/yt-dlp/yt-dlp/releases](https://github.com/yt-dlp/yt-dlp/releases)
* FFmpeg is required for merging formats like `137+140` (video-only + audio).

---

### 📃 License

MIT License © [Your Name](https://github.com/your-username)

---


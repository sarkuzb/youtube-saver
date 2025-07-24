const path = require("path");
const sanitize = require("sanitize-filename");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");

const YTDLP_PATH = path.resolve("C:/Users/Sarvar/Downloads/yt-dlp.exe");
const FFMPEG_PATH = path.resolve(
  "C:/Users/Sarvar/Downloads/ffmpeg/bin/ffmpeg.exe"
);

const youtubeDlExec = require("youtube-dl-exec").create(YTDLP_PATH);

class YouTubeService {
  static validateURL(url) {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//;
    return pattern.test(url);
  }

  static async getVideoInfo(url) {
    try {
      const info = await youtubeDlExec(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: [
          "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ],
        referer: "https://www.youtube.com/",
      });

      if (!info || !Array.isArray(info.formats)) {
        throw new Error("No downloadable formats available for this video.");
      }

      return {
        videoDetails: {
          title: info.title,
          author: info.uploader,
          lengthSeconds: info.duration,
          viewCount: info.view_count,
          uploadDate: info.upload_date,
          thumbnail: info.thumbnail,
          description: info.description
            ? info.description.substring(0, 200) + "..."
            : "No description available.",
        },
        formats: this.getAvailableFormats(info.formats, info.duration),
      };
    } catch (error) {
      console.error(
        "yt-dlp getVideoInfo error:",
        error.stderr || error.message
      );
      throw new Error(
        "Failed to get video info: " + (error.stderr || error.message)
      );
    }
  }

  static getAvailableFormats(formats, duration) {
    const resolutionOrder = [
      "144p",
      "240p",
      "360p",
      "480p",
      "720p",
      "1080p",
      "1440p",
      "2160p",
    ];

    const progressiveMap = {};
    const videoOnlyMap = {};
    const audioFormats = [];

    formats.forEach((f) => {
      const isVideo = f.vcodec !== "none";
      const isAudio = f.acodec !== "none";
      const res = f.height ? `${f.height}p` : null;

      const size = f.filesize
        ? this.formatBytes(f.filesize)
        : f.filesize_approx
        ? this.formatBytes(f.filesize_approx)
        : f.tbr && duration
        ? this.estimateSizeFromBitrate(f.tbr, duration)
        : "Unknown";

      if (isVideo && isAudio && res) {
        if (!progressiveMap[res] || f.ext === "mp4") {
          progressiveMap[res] = {
            itag: f.format_id,
            quality: res,
            container: f.ext,
            size,
            type: "video+audio",
            label: `${res} (MP4)`,
          };
        }
      }

      if (isVideo && !isAudio && res) {
        if (!videoOnlyMap[res] || f.ext === "mp4") {
          videoOnlyMap[res] = {
            itag: f.format_id,
            quality: res,
            container: f.ext,
            size,
            type: "video-only",
            label: `${res} (Best Quality)`,
          };
        }
      }

      if (!isVideo && isAudio && f.abr) {
        audioFormats.push({
          itag: f.format_id,
          quality: `${Math.round(f.abr)}kbps`,
          container: f.ext,
          size,
          type: "audio",
          label: `Audio ${Math.round(f.abr)}kbps (${f.ext.toUpperCase()})`,
        });
      }
    });

    const finalVideo = resolutionOrder.flatMap((res) => {
      const entries = [];
      if (progressiveMap[res]) entries.push(progressiveMap[res]);
      if (videoOnlyMap[res]) entries.push(videoOnlyMap[res]);
      return entries;
    });

    audioFormats.sort((a, b) => {
      const aBitrate = parseInt(a.quality) || 0;
      const bBitrate = parseInt(b.quality) || 0;
      return bBitrate - aBitrate;
    });

    return {
      video: finalVideo,
      audio: audioFormats.slice(0, 5),
    };
  }

  static estimateSizeFromBitrate(bitrateKbps, durationSeconds) {
    const bits = bitrateKbps * 1000 * durationSeconds;
    const bytes = bits / 8;
    return this.formatBytes(bytes);
  }

  static formatBytes(bytes, decimals = 1) {
    if (!bytes || isNaN(bytes)) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  static sanitizeFilename(name) {
    return sanitize(name || "video")
      .replace(/[^\w\-\.]/g, "_")
      .replace(/[\r\n"]/g, "")
      .substring(0, 200);
  }

  // Direct streaming download with progress
  static downloadVideoStream(url, itag, res, type = "video") {
    // Handle format selection
    let formatArgs = [];

    if (type === "audio") {
      formatArgs = [
        "-f",
        `${itag}/bestaudio[ext=m4a]/bestaudio`,
        "-x",
        "--audio-format",
        "mp3",
      ];
    } else if (itag === "best" || itag.includes("best")) {
      formatArgs = ["-f", "best[ext=mp4]/best"];
    } else if (itag.includes("+")) {
      formatArgs = ["-f", `${itag}/best[ext=mp4]/best`];
    } else {
      formatArgs = ["-f", `${itag}+bestaudio[ext=m4a]/best`];
    }

    const args = [
      url,
      ...formatArgs,
      "--ffmpeg-location",
      FFMPEG_PATH,
      "-o",
      "-", // Output to stdout for direct streaming
      // Headers
      "--user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "--referer",
      "https://www.youtube.com/",
      "--add-header",
      "Accept-Language:en-US,en;q=0.9",
      // Options
      "--no-check-certificate",
      "--no-warnings",
      "--no-playlist",
      "--newline", // Progress on new lines
      "--no-color",
    ];

    console.log("▶️ Starting direct stream download");
    const ytdlp = spawn(YTDLP_PATH, args);

    let contentLength = 0;
    let downloadedBytes = 0;

    // Handle stdout (actual video data)
    ytdlp.stdout.on("data", (chunk) => {
      downloadedBytes += chunk.length;
      res.write(chunk);
    });

    // Handle stderr (progress and errors)
    ytdlp.stderr.on("data", (data) => {
      const output = data.toString();

      // Parse progress information
      const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
      if (progressMatch) {
        const progress = parseFloat(progressMatch[1]);
        console.log(`Download progress: ${progress}%`);
      }

      // Parse size information
      const sizeMatch = output.match(
        /\[download\]\s+Destination:.*?(\d+\.?\d*\w+)/
      );
      if (sizeMatch) {
        console.log(`File size: ${sizeMatch[1]}`);
      }
    });

    ytdlp.on("error", (err) => {
      console.error("yt-dlp error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Download failed: " + err.message });
      }
    });

    ytdlp.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Download completed successfully");
        res.end();
      } else {
        console.error("yt-dlp exited with code:", code);
        if (!res.headersSent) {
          res.status(500).json({ error: "Download failed with code: " + code });
        }
      }
    });

    // Handle client disconnect
    res.on("close", () => {
      console.log("Client disconnected, killing yt-dlp process");
      ytdlp.kill("SIGTERM");
    });
  }

  // Progress tracking with SSE (Server-Sent Events)
  static async downloadVideoWithProgress(url, itag, type = "video") {
    return new Promise((resolve, reject) => {
      const tempFile = path.join(
        os.tmpdir(),
        `${uuidv4()}.${type === "audio" ? "mp3" : "mp4"}`
      );

      let formatArgs = [];
      if (type === "audio") {
        formatArgs = [
          "-f",
          `${itag}/bestaudio[ext=m4a]/bestaudio`,
          "-x",
          "--audio-format",
          "mp3",
        ];
      } else if (itag === "best") {
        formatArgs = ["-f", "best[ext=mp4]/best"];
      } else if (itag.includes("+")) {
        formatArgs = ["-f", `${itag}/best[ext=mp4]/best`];
      } else {
        formatArgs = ["-f", `${itag}+bestaudio[ext=m4a]/best`];
      }

      const args = [
        url,
        ...formatArgs,
        "--ffmpeg-location",
        FFMPEG_PATH,
        "-o",
        tempFile,
        "--user-agent",
        "Mozilla/5.0",
        "--referer",
        "https://www.youtube.com/",
        "--no-check-certificate",
        "--no-warnings",
        "--newline",
        "--progress",
      ];

      const ytdlp = spawn(YTDLP_PATH, args);
      const progressData = {
        tempFile,
        progress: 0,
        speed: "",
        eta: "",
        size: "",
      };

      ytdlp.stderr.on("data", (data) => {
        const output = data.toString();

        // Parse different progress indicators
        const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
        const speedMatch = output.match(/at\s+(\d+\.?\d*\w+\/s)/);
        const etaMatch = output.match(/ETA\s+(\d+:\d+)/);
        const sizeMatch = output.match(/of\s+(\d+\.?\d*\w+)/);

        if (progressMatch) progressData.progress = parseFloat(progressMatch[1]);
        if (speedMatch) progressData.speed = speedMatch[1];
        if (etaMatch) progressData.eta = etaMatch[1];
        if (sizeMatch) progressData.size = sizeMatch[1];

        // Emit progress update
        if (progressMatch) {
          resolve({
            type: "progress",
            data: progressData,
          });
        }
      });

      ytdlp.on("close", (code) => {
        if (code === 0) {
          resolve({
            type: "complete",
            data: { ...progressData, tempFile },
          });
        } else {
          reject(new Error(`Download failed with code ${code}`));
        }
      });

      ytdlp.on("error", reject);
    });
  }
}

module.exports = YouTubeService;

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

      // Prefer progressive formats (pre-merged video+audio) for faster downloads
      if (isVideo && isAudio && res) {
        if (!progressiveMap[res] || f.ext === "mp4") {
          progressiveMap[res] = {
            itag: f.format_id,
            quality: res,
            container: f.ext,
            size,
            type: "video+audio",
            label: `${res} (Fast)`,
            isProgressive: true,
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
            label: `${res} (High Quality)`,
            isProgressive: false,
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

    // Prioritize progressive formats for faster downloads
    const finalVideo = resolutionOrder.flatMap((res) => {
      const entries = [];
      // Add progressive formats first (faster)
      if (progressiveMap[res]) entries.push(progressiveMap[res]);
      // Then add adaptive formats
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

  // OPTIMIZED: Direct streaming download (fastest method)
  static downloadVideoStream(url, itag, res, type = "video") {
    console.log("⚡ Starting optimized streaming download");

    // Optimize format selection for speed
    let formatArgs = [];

    if (type === "audio") {
      // For audio, use best available without conversion for speed
      formatArgs = ["-f", `${itag}/bestaudio[ext=m4a]/bestaudio`];
      if (itag !== "bestaudio") {
        formatArgs.push("-x", "--audio-format", "mp3");
      }
    } else if (itag === "best") {
      // Prefer pre-merged formats for speed
      formatArgs = ["-f", "best[ext=mp4]/best"];
    } else if (itag.includes("+")) {
      // For adaptive formats, optimize the merge
      const [videoId, audioId] = itag.split("+");
      formatArgs = ["-f", `${videoId}+${audioId}/best`];
    } else {
      // Single format ID - check if it needs audio
      formatArgs = ["-f", `${itag}/best`];
    }

    const args = [
      url,
      ...formatArgs,
      "--ffmpeg-location",
      FFMPEG_PATH,
      "-o",
      "-", // Output to stdout for direct streaming

      // Speed optimizations
      "--concurrent-fragments",
      "8", // Download 8 fragments concurrently
      "--buffer-size",
      "32K", // Larger buffer for better performance
      "--http-chunk-size",
      "10485760", // 10MB chunks

      // Network optimizations
      "--socket-timeout",
      "30",
      "--retries",
      "3",
      "--no-part", // Don't use .part files

      // Headers to avoid throttling
      "--user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "--referer",
      "https://www.youtube.com/",

      // Reduce overhead
      "--no-check-certificate",
      "--no-warnings",
      "--no-playlist",
      "--quiet", // Minimal output for speed
      "--no-progress", // Don't calculate progress for speed
      "--no-call-home",
    ];

    console.log("Format args:", formatArgs.join(" "));

    const ytdlp = spawn(YTDLP_PATH, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    // Optimize TCP settings
    if (res.socket) {
      res.socket.setNoDelay(true);
      res.socket.setKeepAlive(true, 5000);
    }

    // Track download speed
    const startTime = Date.now();
    let bytesDownloaded = 0;
    let lastLogTime = startTime;

    ytdlp.stdout.on("data", (chunk) => {
      bytesDownloaded += chunk.length;
      res.write(chunk);

      // Log speed every 5MB
      if (bytesDownloaded % (5 * 1024 * 1024) < chunk.length) {
        const now = Date.now();
        const elapsedSeconds = (now - startTime) / 1000;
        const speedMBps = (
          bytesDownloaded /
          elapsedSeconds /
          1024 /
          1024
        ).toFixed(2);
        console.log(
          `📊 Downloaded: ${this.formatBytes(
            bytesDownloaded
          )} | Speed: ${speedMBps} MB/s`
        );
        lastLogTime = now;
      }
    });

    // Handle errors efficiently
    let errorOutput = "";
    ytdlp.stderr.on("data", (data) => {
      errorOutput += data.toString();
      // Only log actual errors, not warnings
      if (data.toString().includes("ERROR")) {
        console.error("yt-dlp error:", data.toString());
      }
    });

    ytdlp.on("error", (err) => {
      console.error("❌ yt-dlp spawn error:", err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Download failed: " + err.message });
      }
    });

    ytdlp.on("close", (code) => {
      const duration = (Date.now() - startTime) / 1000;
      const avgSpeed = (bytesDownloaded / duration / 1024 / 1024).toFixed(2);

      if (code === 0) {
        console.log(
          `✅ Download completed: ${this.formatBytes(
            bytesDownloaded
          )} in ${duration.toFixed(1)}s (${avgSpeed} MB/s avg)`
        );
        res.end();
      } else {
        console.error(`❌ yt-dlp exited with code ${code}`);
        if (errorOutput.includes("requested format not available")) {
          console.log("Retrying with best available format...");
          // Retry with best format
          this.downloadVideoStream(url, "best", res, type);
        } else if (!res.headersSent) {
          res.status(500).json({
            error: "Download failed",
            code: code,
            details: errorOutput.substring(0, 500),
          });
        }
      }
    });

    // Handle client disconnect
    res.on("close", () => {
      console.log("⚠️ Client disconnected, stopping download");
      ytdlp.kill("SIGTERM");
    });

    res.on("error", (err) => {
      console.error("Response error:", err);
      ytdlp.kill("SIGTERM");
    });
  }

  // Add this method for reliable downloads
  // Replace the downloadVideoStream method with this more reliable version:
  static downloadVideoReliable(url, itag, res, type = "video") {
    console.log("🎯 Starting reliable download method");

    // For format 616+140-drc, simplify to avoid the -drc suffix
    if (itag.includes("-drc")) {
      itag = itag.replace("-drc", "");
      console.log("📝 Cleaned format:", itag);
    }

    const tempFile = path.join(
      os.tmpdir(),
      `${uuidv4()}.${type === "audio" ? "mp3" : "mp4"}`
    );
    console.log("📁 Temp file:", tempFile);

    let formatArgs = [];
    if (type === "audio") {
      formatArgs = ["-f", `${itag}/bestaudio[ext=m4a]/bestaudio`];
    } else if (itag === "best") {
      formatArgs = ["-f", "best[ext=mp4]/best"];
    } else if (itag.includes("+")) {
      // Handle merged formats properly
      const [video, audio] = itag.split("+");
      formatArgs = ["-f", `${video}+${audio}/best[ext=mp4]/best`];
    } else {
      formatArgs = ["-f", `${itag}/best`];
    }

    const args = [
      url,
      ...formatArgs,
      "--ffmpeg-location",
      FFMPEG_PATH,
      "-o",
      tempFile,

      // Important: Add these to handle 403 errors
      "--user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "--referer",
      "https://www.youtube.com/",
      "--add-header",
      "Accept:*/*",
      "--add-header",
      "Accept-Language:en-US,en;q=0.9",
      "--add-header",
      "Sec-Fetch-Mode:navigate",

      // Performance options
      "--concurrent-fragments",
      "4", // Reduce to avoid 403s
      "--buffer-size",
      "16K",
      "--http-chunk-size",
      "1048576", // 1MB chunks
      "--retries",
      "10",
      "--fragment-retries",
      "10",
      "--retry-sleep",
      "3",

      // Other options
      "--no-check-certificate",
      "--no-warnings",
      "--no-part",
      "--progress",
      "--newline",
    ];

    console.log("🚀 Starting yt-dlp with args:", formatArgs.join(" "));

    const ytdlp = spawn(YTDLP_PATH, args);

    let downloadError = false;
    let progressData = { percent: 0, downloaded: 0, total: 0 };

    ytdlp.stdout.on("data", (data) => {
      const output = data.toString();
      console.log("stdout:", output);
    });

    ytdlp.stderr.on("data", (data) => {
      const output = data.toString();

      // Check for actual errors (not just warnings)
      if (output.includes("ERROR:") && !output.includes("fragment")) {
        console.error("❌ yt-dlp error:", output);
        downloadError = true;
      }

      // Parse progress
      const progressMatch = output.match(
        /\[download\]\s+(\d+\.?\d*)%\s+of\s+~?\s*(\d+\.?\d*\w+)/
      );
      if (progressMatch) {
        progressData.percent = parseFloat(progressMatch[1]);
        progressData.totalSize = progressMatch[2];
        console.log(
          `📊 Progress: ${progressData.percent}% of ${progressData.totalSize}`
        );
      }
    });

    ytdlp.on("close", (code) => {
      console.log(`🏁 yt-dlp process ended with code: ${code}`);

      // Check if download was successful
      if (!fs.existsSync(tempFile)) {
        console.error("❌ Download failed - file not created");
        if (!res.headersSent) {
          res.status(500).json({
            error: "Download failed - file not created",
            suggestion: "Try a different quality or format",
          });
        }
        return;
      }

      const stat = fs.statSync(tempFile);
      const fileSizeMB = (stat.size / 1024 / 1024).toFixed(1);
      console.log(`✅ File downloaded: ${fileSizeMB} MB`);

      // Important: Set headers before streaming
      if (!res.headersSent) {
        res.setHeader("Content-Length", stat.size);
        res.setHeader("Accept-Ranges", "bytes");
      }

      // Stream the complete file
      const readStream = fs.createReadStream(tempFile);
      let bytesSent = 0;

      readStream.on("data", (chunk) => {
        bytesSent += chunk.length;
        if (!res.write(chunk)) {
          readStream.pause();
          res.once("drain", () => readStream.resume());
        }
      });

      readStream.on("end", () => {
        console.log(
          `✅ Sent ${(bytesSent / 1024 / 1024).toFixed(1)} MB to client`
        );
        res.end();

        // Clean up temp file
        setTimeout(() => {
          fs.unlink(tempFile, (err) => {
            if (err) console.error("Failed to delete temp file:", err);
            else console.log("🧹 Temp file deleted");
          });
        }, 1000);
      });

      readStream.on("error", (err) => {
        console.error("❌ Read stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to read file" });
        }
        fs.unlink(tempFile, () => {});
      });
    });

    // Handle client disconnect properly
    res.on("close", () => {
      if (!res.writableEnded) {
        console.log("⚠️ Client disconnected during download");
        ytdlp.kill("SIGTERM");

        // Clean up temp file if exists
        setTimeout(() => {
          if (fs.existsSync(tempFile)) {
            fs.unlink(tempFile, () => {});
          }
        }, 1000);
      }
    });

    ytdlp.on("error", (err) => {
      console.error("❌ Process spawn error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  // Alternative: Get direct CDN URL (fastest but may not always work)
  static async getDirectDownloadURL(url, itag) {
    try {
      console.log("🔍 Getting direct download URL...");

      const info = await youtubeDlExec(url, {
        format: itag === "best" ? "best[ext=mp4]/best" : itag,
        getUrl: true,
        noCheckCertificates: true,
        quiet: true,
      });

      // info will contain the direct URL
      if (typeof info === "string") {
        return info.trim();
      } else if (info.url) {
        return info.url;
      } else {
        throw new Error("Could not get direct URL");
      }
    } catch (error) {
      console.error("Error getting direct URL:", error);
      return null;
    }
  }

  // Progress tracking with Server-Sent Events
  static downloadVideoWithProgress(url, itag, type = "video") {
    return new Promise((resolve, reject) => {
      const eventEmitter = new (require("events"))();

      let formatArgs = [];
      if (type === "audio") {
        formatArgs = ["-f", `${itag}/bestaudio`, "-x", "--audio-format", "mp3"];
      } else if (itag === "best") {
        formatArgs = ["-f", "best[ext=mp4]/best"];
      } else {
        formatArgs = ["-f", `${itag}/best`];
      }

      const args = [
        url,
        ...formatArgs,
        "--ffmpeg-location",
        FFMPEG_PATH,
        "-o",
        "-",
        "--newline", // Progress on new lines
        "--progress", // Show progress
        "--concurrent-fragments",
        "8",
        "--buffer-size",
        "32K",
      ];

      const ytdlp = spawn(YTDLP_PATH, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      const progressData = {
        eventEmitter,
        process: ytdlp,
        stdout: ytdlp.stdout,
        progress: 0,
        speed: "",
        eta: "",
        size: "",
      };

      ytdlp.stderr.on("data", (data) => {
        const output = data.toString();

        // Parse progress information
        const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
        const speedMatch = output.match(/at\s+(\d+\.?\d*\w+\/s)/);
        const etaMatch = output.match(/ETA\s+(\d+:\d+)/);
        const sizeMatch = output.match(/of\s+~?(\d+\.?\d*\w+)/);

        if (progressMatch) {
          progressData.progress = parseFloat(progressMatch[1]);
          if (speedMatch) progressData.speed = speedMatch[1];
          if (etaMatch) progressData.eta = etaMatch[1];
          if (sizeMatch) progressData.size = sizeMatch[1];

          eventEmitter.emit("progress", progressData);
        }
      });

      ytdlp.on("close", (code) => {
        if (code === 0) {
          eventEmitter.emit("complete");
        } else {
          eventEmitter.emit(
            "error",
            new Error(`Process exited with code ${code}`)
          );
        }
      });

      ytdlp.on("error", (err) => {
        eventEmitter.emit("error", err);
      });

      resolve(progressData);
    });
  }
}

module.exports = YouTubeService;

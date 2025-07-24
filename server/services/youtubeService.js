const path = require("path");
const sanitize = require("sanitize-filename");
const { spawn } = require("child_process");

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
      console.log("✅ yt-dlp path:", YTDLP_PATH);

      const info = await youtubeDlExec(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
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
            label: `${res} (Standard)`,
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
            label: `${res} (Merged)`,
          };
        }
      }

      if (!isVideo && isAudio) {
        audioFormats.push({
          itag: f.format_id,
          quality: f.abr ? `${f.abr}kbps` : "Unknown",
          container: f.ext,
          size,
          type: "audio",
        });
      }
    });

    const finalVideo = resolutionOrder.flatMap((res) => {
      const entries = [];
      if (progressiveMap[res]) entries.push(progressiveMap[res]);
      if (videoOnlyMap[res]) entries.push(videoOnlyMap[res]);
      return entries;
    });

    return {
      video: finalVideo,
      audio: audioFormats.slice(0, 3),
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

  static downloadVideo(url, itag, res) {
    const args = [
      url,
      "-f",
      itag,
      "--ffmpeg-location",
      `"${FFMPEG_PATH}"`,
      "-o",
      "-",
    ];

    console.log("▶️ Spawning yt-dlp:", `"${YTDLP_PATH}"`, args.join(" "));

    const ytdlp = spawn(YTDLP_PATH, args, { shell: true });

    ytdlp.stdout.pipe(res);

    ytdlp.stderr.on("data", (data) => {
      console.error("yt-dlp stderr:", data.toString());
    });

    ytdlp.on("error", (err) => {
      console.error("yt-dlp error:", err.message);
      if (!res.headersSent) {
        res.status(500).send("Download failed: " + err.message);
      }
    });

    ytdlp.on("close", (code) => {
      if (code !== 0) {
        console.error("yt-dlp exited with code", code);
      }
    });
  }
}

module.exports = YouTubeService;

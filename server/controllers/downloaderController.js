const YouTubeService = require("../services/youtubeService");

class DownloaderController {
  // ✅ Fetch video details
  static async getVideoInfo(req, res) {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      if (!YouTubeService.validateURL(url)) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }

      console.log("📹 Fetching video info for:", url);
      const videoInfo = await YouTubeService.getVideoInfo(url);

      console.log(`✅ Video found: ${videoInfo.videoDetails.title}`);
      console.log(
        `📊 Available formats: ${videoInfo.formats.video.length} video, ${videoInfo.formats.audio.length} audio`
      );

      res.json(videoInfo);
    } catch (error) {
      console.error("❌ Error getting video info:", error.message);
      res.status(500).json({
        error: error.message || "Failed to retrieve video information",
      });
    }
  }

  // ✅ OPTIMIZED: Fast streaming download
  // ✅ FIXED: Download selected video/audio stream
  // Update the downloadVideo method to use the reliable version:
  static async downloadVideo(req, res) {
    try {
      const { url, itag, type } = req.query;

      console.log("\n📥 Download request received:");
      console.log("  URL:", url);
      console.log("  Format:", itag);
      console.log("  Type:", type);

      if (!url || !itag || !type) {
        return res
          .status(400)
          .json({ error: "Missing required query parameters" });
      }

      if (!YouTubeService.validateURL(url)) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }

      // Get video info for filename
      let safeTitle = "video";
      try {
        const videoInfo = await YouTubeService.getVideoInfo(url);
        safeTitle = YouTubeService.sanitizeFilename(
          videoInfo.videoDetails.title
        );
        console.log("📝 Video title:", videoInfo.videoDetails.title);
      } catch (error) {
        console.warn("⚠️ Could not fetch video title");
      }

      // Set headers for download
      const ext = type === "audio" ? "mp3" : "mp4";
      const filename = `${safeTitle}.${ext}`;

      res.setHeader(
        "Content-Type",
        type === "audio" ? "audio/mpeg" : "video/mp4"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Cache-Control", "no-cache");

      // Use the reliable download method
      YouTubeService.downloadVideoReliable(url, itag, res, type);
    } catch (error) {
      console.error("❌ Controller error:", error.message);
      if (!res.headersSent) {
        res.status(500).json({
          error: error.message || "Failed to process the download",
        });
      }
    }
  }

  // ✅ Download with progress (Server-Sent Events)
  static async downloadProgress(req, res) {
    const { url, itag, type } = req.query;

    if (!url || !itag) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering

    // Send initial connection message
    res.write('data: {"type":"connected"}\n\n');
    res.flush?.(); // Flush if available

    try {
      // Get video info first
      const videoInfo = await YouTubeService.getVideoInfo(url);

      // Send video info
      res.write(
        `data: ${JSON.stringify({
          type: "info",
          title: videoInfo.videoDetails.title,
          duration: videoInfo.videoDetails.lengthSeconds,
          thumbnail: videoInfo.videoDetails.thumbnail,
        })}\n\n`
      );
      res.flush?.();

      // Start download with progress tracking
      const downloadProcess = await YouTubeService.downloadVideoWithProgress(
        url,
        itag,
        type
      );

      // Listen for progress events
      downloadProcess.eventEmitter.on("progress", (data) => {
        res.write(
          `data: ${JSON.stringify({
            type: "progress",
            progress: data.progress,
            speed: data.speed,
            eta: data.eta,
            size: data.size,
          })}\n\n`
        );
        res.flush?.();
      });

      // Pipe the actual download
      downloadProcess.stdout.on("data", (chunk) => {
        // Store chunks or handle as needed
      });

      downloadProcess.eventEmitter.on("complete", () => {
        res.write(
          `data: ${JSON.stringify({
            type: "complete",
            message: "Download ready",
          })}\n\n`
        );
        res.end();
      });

      downloadProcess.eventEmitter.on("error", (error) => {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            message: error.message,
          })}\n\n`
        );
        res.end();
      });
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: error.message,
        })}\n\n`
      );
      res.end();
    }

    // Handle client disconnect
    req.on("close", () => {
      console.log("SSE client disconnected");
    });
  }

  // ✅ API health status
  static async checkHealth(req, res) {
    try {
      console.log("🏥 Running health check...");

      const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const startTime = Date.now();

      const info = await YouTubeService.getVideoInfo(testUrl);
      const responseTime = Date.now() - startTime;

      const healthStatus = {
        status: "OK",
        service: "YouTube Downloader API",
        timestamp: new Date().toISOString(),
        diagnostics: {
          ytdlpWorking: true,
          videoTitle: info.videoDetails.title,
          videoFormats: {
            total: info.formats.video.length + info.formats.audio.length,
            video: info.formats.video.length,
            audio: info.formats.audio.length,
            progressive: info.formats.video.filter((f) => f.isProgressive)
              .length,
            adaptive: info.formats.video.filter((f) => !f.isProgressive).length,
          },
          responseTimeMs: responseTime,
          paths: {
            ytdlp: require("path").resolve(
              "C:/Users/Sarvar/Downloads/yt-dlp.exe"
            ),
            ffmpeg: require("path").resolve(
              "C:/Users/Sarvar/Downloads/ffmpeg/bin/ffmpeg.exe"
            ),
          },
        },
      };

      console.log("✅ Health check passed");
      res.json(healthStatus);
    } catch (error) {
      console.error("❌ Health check failed:", error.message);
      res.status(500).json({
        status: "Error",
        message: error.message || "yt-dlp unreachable",
      });
    }
  }

  // ✅ List formats with recommendations
  static async listFormats(req, res) {
    try {
      const { url } = req.query;

      if (!url || !YouTubeService.validateURL(url)) {
        return res.status(400).json({ error: "Valid YouTube URL required" });
      }

      const videoInfo = await YouTubeService.getVideoInfo(url);

      // Separate progressive and adaptive formats
      const progressiveFormats = videoInfo.formats.video.filter(
        (f) => f.isProgressive
      );
      const adaptiveFormats = videoInfo.formats.video.filter(
        (f) => !f.isProgressive
      );

      const formatList = {
        title: videoInfo.videoDetails.title,
        recommendations: {
          fastest: progressiveFormats[0] || {
            itag: "best",
            label: "Best Available",
          },
          balanced:
            progressiveFormats.find((f) => f.quality === "720p") ||
            progressiveFormats[0],
          highest:
            adaptiveFormats[adaptiveFormats.length - 1] ||
            progressiveFormats[progressiveFormats.length - 1],
        },
        formats: {
          progressive: progressiveFormats,
          adaptive: adaptiveFormats,
          audio: videoInfo.formats.audio,
        },
      };

      res.json(formatList);
    } catch (error) {
      console.error("Error listing formats:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = DownloaderController;

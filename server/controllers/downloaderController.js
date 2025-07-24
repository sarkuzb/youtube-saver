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

  // ✅ Download selected video/audio stream (Direct Streaming)
  static async downloadVideo(req, res) {
    try {
      const { url, itag, type } = req.query;

      console.log("📥 Download request received:");
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
        console.warn("⚠️ Could not fetch video title, using default filename");
      }

      // Determine file extension based on type
      const ext = type === "audio" ? "mp3" : "mp4";

      // Set response headers
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeTitle}.${ext}"`
      );

      res.setHeader(
        "Content-Type",
        type === "audio" ? "audio/mpeg" : "video/mp4"
      );

      // Use direct streaming method
      console.log(`🎯 Starting direct stream for format: ${itag}`);
      YouTubeService.downloadVideoStream(url, itag, res, type);
    } catch (error) {
      console.error("❌ Download error:", error.message);
      if (!res.headersSent) {
        res.status(500).json({
          error: error.message || "Failed to process the download",
        });
      }
    }
  }

  // ✅ Download with progress updates (Server-Sent Events)
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

    // Send initial connection message
    res.write('data: {"type":"connected"}\n\n');

    try {
      const videoInfo = await YouTubeService.getVideoInfo(url);
      const title = videoInfo.videoDetails.title;

      // Send video info
      res.write(
        `data: ${JSON.stringify({
          type: "info",
          title: title,
          duration: videoInfo.videoDetails.lengthSeconds,
        })}\n\n`
      );

      // Start download with progress tracking
      const downloadProcess = YouTubeService.downloadVideoWithProgress(
        url,
        itag,
        type
      );

      downloadProcess
        .then((update) => {
          if (update.type === "progress") {
            res.write(
              `data: ${JSON.stringify({
                type: "progress",
                progress: update.data.progress,
                speed: update.data.speed,
                eta: update.data.eta,
                size: update.data.size,
              })}\n\n`
            );
          } else if (update.type === "complete") {
            res.write(
              `data: ${JSON.stringify({
                type: "complete",
                message: "Download completed",
                tempFile: update.data.tempFile,
              })}\n\n`
            );
            res.end();
          }
        })
        .catch((error) => {
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

  // ✅ API health status with enhanced diagnostics
  static async checkHealth(req, res) {
    try {
      console.log("🏥 Running health check...");

      // Test with a known good video
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

      const errorStatus = {
        status: "Error",
        service: "YouTube Downloader API",
        timestamp: new Date().toISOString(),
        error: {
          message: error.message || "yt-dlp unreachable",
          type: error.name || "UnknownError",
        },
        diagnostics: {
          ytdlpWorking: false,
          suggestion:
            "Check if yt-dlp.exe and ffmpeg.exe are in the correct paths",
        },
      };

      res.status(500).json(errorStatus);
    }
  }

  // ✅ List available formats for debugging
  static async listFormats(req, res) {
    try {
      const { url } = req.query;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      if (!YouTubeService.validateURL(url)) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }

      console.log("📋 Listing formats for:", url);
      const videoInfo = await YouTubeService.getVideoInfo(url);

      // Create a simplified format list
      const formatList = {
        title: videoInfo.videoDetails.title,
        recommendedDownloads: [
          {
            label: "Best Quality (Video + Audio)",
            itag: "best",
            type: "video+audio",
            description: "Highest quality available with both video and audio",
          },
          {
            label: "1080p Video",
            itag: "137+140",
            type: "video+audio",
            description: "Full HD video with audio",
          },
          {
            label: "720p Video",
            itag: "136+140",
            type: "video+audio",
            description: "HD video with audio",
          },
          {
            label: "Best Audio Only",
            itag: "140",
            type: "audio",
            description: "Highest quality audio (MP3)",
          },
        ],
        availableFormats: {
          video: videoInfo.formats.video,
          audio: videoInfo.formats.audio,
        },
      };

      res.json(formatList);
    } catch (error) {
      console.error("❌ Error listing formats:", error.message);
      res.status(500).json({
        error: error.message || "Failed to list formats",
      });
    }
  }
}

module.exports = DownloaderController;

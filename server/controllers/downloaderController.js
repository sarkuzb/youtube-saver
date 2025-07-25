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

  // ✅ Download selected video/audio stream (Simple version that works)
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

      // Use the working download method
      console.log(`🎯 Starting download for format: ${itag}`);
      YouTubeService.downloadVideo(url, itag, res, type);
    } catch (error) {
      console.error("❌ Download error:", error.message);
      if (!res.headersSent) {
        res.status(500).json({
          error: error.message || "Failed to process the download",
        });
      }
    }
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
          },
          responseTimeMs: responseTime,
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
}

module.exports = DownloaderController;

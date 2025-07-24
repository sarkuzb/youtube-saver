const YouTubeService = require("../services/youtubeService");

class DownloaderController {
  // Get video info
  static async getVideoInfo(req, res) {
    try {
      const { url } = req.body;

      if (!url) return res.status(400).json({ error: "URL is required" });
      if (!YouTubeService.validateURL(url))
        return res.status(400).json({ error: "Invalid YouTube URL" });

      const videoInfo = await YouTubeService.getVideoInfo(url);
      res.json(videoInfo);
    } catch (error) {
      console.error("Error getting video info:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to get video information" });
    }
  }

  // ✅ Download video/audio stream
  static async downloadVideo(req, res) {
    try {
      const { url, itag, type } = req.query;

      if (!url) return res.status(400).json({ error: "URL is required" });
      if (!YouTubeService.validateURL(url))
        return res.status(400).json({ error: "Invalid YouTube URL" });

      const info = await YouTubeService.getVideoInfo(url);
      const filename = YouTubeService.sanitizeFilename(info.videoDetails.title);
      const extension = type === "audio" ? "mp3" : "mp4";

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.${extension}"`
      );

      res.setHeader(
        "Content-Type",
        type === "audio" ? "audio/mpeg" : "video/mp4"
      );

      YouTubeService.downloadVideo(url, itag, res);
    } catch (error) {
      console.error("Error downloading video:", error);
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: error.message || "Failed to download video" });
      }
    }
  }

  // ✅ Health check
  static async checkHealth(req, res) {
    try {
      const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const info = await YouTubeService.getVideoInfo(testUrl);

      res.json({
        status: "OK",
        service: "YouTube Downloader API",
        videoTitle: info.videoDetails.title,
        formatsAvailable: info.formats.video.length + info.formats.audio.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Health check failed:", error.message);
      res.status(500).json({
        status: "Error",
        message: error.message || "yt-dlp failed",
      });
    }
  }
}

module.exports = DownloaderController;

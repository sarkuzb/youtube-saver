const express = require("express");
const router = express.Router();
const DownloaderController = require("../controllers/downloaderController");

// Middleware to log all requests
router.use((req, res, next) => {
  console.log(`➡️  ${req.method} ${req.path}`);
  next();
});

// Get video information
router.post("/info", DownloaderController.getVideoInfo);

// Download video (optimized streaming)
router.get("/video", DownloaderController.downloadVideo);

// Download with progress (SSE)
router.get("/progress", DownloaderController.downloadProgress);

// Health check
router.get("/health", DownloaderController.checkHealth);

// List formats with recommendations
router.get("/formats", DownloaderController.listFormats);

module.exports = router;

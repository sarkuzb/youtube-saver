const express = require("express");
const router = express.Router();
const DownloaderController = require("../controllers/downloaderController");

// Get video information
router.post("/info", DownloaderController.getVideoInfo);

// Download video (direct streaming)
router.get("/video", DownloaderController.downloadVideo);

// Download with progress updates (SSE)
router.get("/progress", DownloaderController.downloadProgress);

// Health check
router.get("/health", DownloaderController.checkHealth);

// List formats (for debugging)
router.get("/formats", DownloaderController.listFormats);

module.exports = router;

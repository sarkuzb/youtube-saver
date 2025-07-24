const express = require("express");
const router = express.Router();
const DownloaderController = require("../controllers/downloaderController");

// Get video information
router.post("/info", DownloaderController.getVideoInfo);

// Download video
router.get("/video", DownloaderController.downloadVideo);

// Health check
router.get("/health", DownloaderController.checkHealth);

module.exports = router;

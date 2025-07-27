const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Import routes
const downloaderRoutes = require("./routes/downloader");

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Simple logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Performance optimizations
app.use((req, res, next) => {
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Keep-Alive", "timeout=5");
  res.removeHeader("X-Powered-By");
  next();
});

// Routes
app.use("/api/download", downloaderRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "YouTube Downloader API",
    version: "2.0",
    endpoints: {
      health: "/api/download/health",
      info: "POST /api/download/info",
      download: "GET /api/download/video",
      progress: "GET /api/download/progress",
      formats: "GET /api/download/formats",
    },
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `🌐 Client URL: ${process.env.CLIENT_URL || "http://localhost:5173"}`
  );
});

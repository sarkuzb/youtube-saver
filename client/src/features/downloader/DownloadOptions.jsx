import React, { useState, useEffect, useMemo } from "react";
import { downloaderAPI } from "../../services/api";
import { formatDuration, formatViewCount } from "../../utils/validation";
import styles from "./downloader.module.css";
import { Download, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// YouTube Data API Key
const YOUTUBE_API_KEY = "AIzaSyA_HgifGGFu8-tpZhyk6YJMOL3yotm5MFA";

const preferredResolutions = [
  "144p",
  "240p",
  "360p",
  "480p",
  "720p",
  "1080p",
  "1440p",
  "2160p",
];

const DownloadOptions = ({ videoInfo, videoUrl }) => {
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [activeTab, setActiveTab] = useState("video");
  const [likeCount, setLikeCount] = useState(null);
  const [commentCount, setCommentCount] = useState(null);

  // Download progress states
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState("");
  const [downloadETA, setDownloadETA] = useState("");
  const [downloadSize, setDownloadSize] = useState("");
  const [downloadError, setDownloadError] = useState(null);
  const [eventSource, setEventSource] = useState(null);

  // Extract video ID from YouTube URL
  const extractVideoId = (url) => {
    const regex = /(?:v=|\/)([0-9A-Za-z_-]{11})(?:[?&]|$)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // Fetch likes and comments from YouTube Data API
  useEffect(() => {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) return;

    const fetchStats = async () => {
      try {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`
        );
        const data = await response.json();
        const stats = data?.items?.[0]?.statistics;

        if (stats?.likeCount) setLikeCount(stats.likeCount);
        if (stats?.commentCount) setCommentCount(stats.commentCount);
      } catch (error) {
        console.error("Failed to fetch video statistics:", error);
      }
    };

    fetchStats();
  }, [videoUrl]);

  // Cleanup event source on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  const handleDownload = () => {
    if (!selectedFormat) return;

    setDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);
    setDownloadSpeed("");
    setDownloadETA("");
    setDownloadSize("");

    // Option 1: Direct download (simpler but no real progress from server)
    const useDirectDownload = false; // Set to true to use simple download

    if (useDirectDownload) {
      // Simple download with simulated progress
      const downloadUrl = downloaderAPI.getDownloadURL(
        videoUrl,
        selectedFormat.itag,
        selectedFormat.type
      );

      // Simulate progress (since we can't get real progress from direct download)
      const progressInterval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + Math.random() * 10;
        });
      }, 500);

      // Create download link
      fetch(downloadUrl)
        .then((response) => response.blob())
        .then((blob) => {
          clearInterval(progressInterval);
          setDownloadProgress(100);

          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${videoInfo.videoDetails.title.replace(
            /[^a-z0-9]/gi,
            "_"
          )}.${selectedFormat.type === "audio" ? "mp3" : "mp4"}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          setTimeout(() => {
            setDownloading(false);
            setDownloadProgress(0);
          }, 2000);
        })
        .catch((error) => {
          clearInterval(progressInterval);
          setDownloadError(error.message);
          setDownloading(false);
        });
    } else {
      // Option 2: Server-Sent Events for real progress
      const es = downloaderAPI.createProgressEventSource(
        videoUrl,
        selectedFormat.itag,
        selectedFormat.type,
        {
          onConnected: (data) => {
            console.log("Connected to download progress stream");
          },
          onInfo: (data) => {
            console.log("Video:", data.title);
            if (data.duration) {
              console.log("Duration:", data.duration);
            }
          },
          onProgress: (data) => {
            setDownloadProgress(data.progress || 0);
            setDownloadSpeed(data.speed || "");
            setDownloadETA(data.eta || "");
            setDownloadSize(data.size || "");
          },
          onComplete: (data) => {
            setDownloadProgress(100);

            // Trigger actual file download
            const downloadUrl = downloaderAPI.getDownloadURL(
              videoUrl,
              selectedFormat.itag,
              selectedFormat.type
            );

            window.location.href = downloadUrl;

            setTimeout(() => {
              setDownloading(false);
              setDownloadProgress(0);
              setDownloadSpeed("");
              setDownloadETA("");
              setDownloadSize("");
            }, 3000);
          },
          onError: (data) => {
            console.error("Download error:", data.message);
            setDownloadError(data.message);
            setDownloading(false);
          },
        }
      );

      setEventSource(es);
    }
  };

  const cancelDownload = () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    setDownloading(false);
    setDownloadProgress(0);
    setDownloadSpeed("");
    setDownloadETA("");
    setDownloadError(null);
  };

  const mergedVideoFormats = useMemo(() => {
    const videoOnly = videoInfo.formats.video.filter(
      (f) => f.type === "video-only"
    );
    const progressive = videoInfo.formats.video.filter(
      (f) => f.type === "video+audio"
    );
    const audioOnly = videoInfo.formats.audio.filter((f) => f.type === "audio");

    const bestAudio = audioOnly[0];
    const merged = [];

    progressive.forEach((f) => {
      if (preferredResolutions.includes(f.quality)) {
        merged.push({
          ...f,
          label: `${f.quality} (Standard)`,
          itag: f.itag,
          type: "video+audio",
        });
      }
    });

    if (bestAudio) {
      videoOnly.forEach((f) => {
        if (preferredResolutions.includes(f.quality)) {
          merged.push({
            ...f,
            label: `${f.quality} (Merged)`,
            itag: `${f.itag}+${bestAudio.itag}`,
            type: "video+audio",
          });
        }
      });
    }

    merged.sort((a, b) => {
      const aIdx = preferredResolutions.indexOf(a.quality);
      const bIdx = preferredResolutions.indexOf(b.quality);
      return aIdx - bIdx;
    });

    return merged;
  }, [videoInfo]);

  const formats =
    activeTab === "video" ? mergedVideoFormats : videoInfo.formats.audio;

  const rawDate = videoInfo.videoDetails.uploadDate;
  const formattedDate = `${rawDate.slice(0, 4)}/${rawDate.slice(
    4,
    6
  )}/${rawDate.slice(6, 8)}`;

  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-6">
      {/* Video Info */}
      <div className="flex items-start space-x-4">
        <div className="relative w-60 h-36">
          <img
            src={videoInfo.videoDetails.thumbnail}
            alt={videoInfo.videoDetails.title}
            className="w-full h-full object-cover rounded"
          />
          <span className="absolute bottom-1 right-1 bg-black/50 text-white text-[15px] px-1.5 py-0.5 rounded-sm font-medium">
            {formatDuration(videoInfo.videoDetails.lengthSeconds)}
          </span>
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-800">
            {videoInfo.videoDetails.title}
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            By:{" "}
            <span className="font-bold">{videoInfo.videoDetails.author}</span>
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <span>
              Views: {formatViewCount(videoInfo.videoDetails.viewCount)}
            </span>
            <span>
              Likes:{" "}
              {likeCount !== null ? formatViewCount(likeCount) : "Loading..."}
            </span>
            <span>
              Comments:{" "}
              {commentCount !== null
                ? formatViewCount(commentCount)
                : "Loading..."}
            </span>
            <span>Upload Date: {formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => {
            setActiveTab("video");
            setSelectedFormat(null);
          }}
          className={`px-4 py-2 font-medium cursor-pointer ${
            activeTab === "video"
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-gray-500 hover:text-indigo-600"
          }`}
        >
          Video Downloads
        </button>
        <button
          onClick={() => {
            setActiveTab("audio");
            setSelectedFormat(null);
          }}
          className={`px-4 py-2 font-medium cursor-pointer ${
            activeTab === "audio"
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-gray-500 hover:text-indigo-600"
          }`}
        >
          Audio Only
        </button>
      </div>

      {/* Format List */}
      <div className="grid gap-3">
        {formats.map((format, index) => (
          <label
            key={format.itag || index}
            className={`flex items-center justify-between p-3 border rounded cursor-pointer transition hover:bg-gray-50 ${
              selectedFormat?.itag === format.itag
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-200"
            }`}
            onClick={() => setSelectedFormat(format)}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                checked={selectedFormat?.itag === format.itag}
                onChange={() => setSelectedFormat(format)}
                className="form-radio text-indigo-600"
              />
              <div className="text-sm">
                <p className="font-medium text-gray-800">{format.quality}</p>
                <p className="text-gray-500">
                  {format.container.toUpperCase()} • {format.size}
                </p>
              </div>
            </div>
          </label>
        ))}
      </div>

      {/* Download Button / Progress */}
      <AnimatePresence mode="wait">
        {!downloading ? (
          <motion.button
            key="download-button"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onClick={handleDownload}
            disabled={!selectedFormat}
            whileTap={{ scale: 0.98 }}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-white font-medium transition ${
              selectedFormat
                ? "bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            <Download className="w-5 h-5" />
            {selectedFormat
              ? `Download ${
                  selectedFormat.label || selectedFormat.quality
                } ${selectedFormat.container?.toUpperCase()}`
              : "Select a format to download"}
          </motion.button>
        ) : (
          <motion.div
            key="progress-container"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-3"
          >
            {/* Progress Bar */}
            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Downloading... {downloadProgress.toFixed(1)}%
                </span>
                <button
                  onClick={cancelDownload}
                  className="text-gray-500 hover:text-red-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <motion.div
                  className="bg-indigo-600 h-3 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${downloadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Download Info */}
              <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
                <div className="space-x-4">
                  {downloadSpeed && <span>Speed: {downloadSpeed}</span>}
                  {downloadSize && <span>Size: {downloadSize}</span>}
                </div>
                {downloadETA && <span>ETA: {downloadETA}</span>}
              </div>
            </div>

            {/* Error Message */}
            {downloadError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm"
              >
                {downloadError}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DownloadOptions;

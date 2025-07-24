import React, { useState, useMemo } from "react";
import { downloaderAPI } from "../../services/api";
import { formatDuration, formatViewCount } from "../../utils/validation";
import styles from "./downloader.module.css";
import { Download } from "lucide-react";
import { motion } from "framer-motion";

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

  const handleDownload = () => {
    if (!selectedFormat) return;

    const downloadUrl = downloaderAPI.getDownloadURL(
      videoUrl,
      selectedFormat.itag,
      selectedFormat.type
    );

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${videoInfo.videoDetails.title.replace(
      /[^a-z0-9]/gi,
      "_"
    )}.${selectedFormat.type === "audio" ? "mp3" : "mp4"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ✅ Filter and merge formats intelligently
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

    // Add filtered progressive formats
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

    // Add filtered merged formats (video-only + best audio)
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

    // Sort by resolution height
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
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[15px] px-1.5 py-0.5 rounded-sm font-medium">
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
            <span>Likes: {formatViewCount(videoInfo.videoDetails.likes)}</span>

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

      {/* Download Button */}
      <motion.button
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
    </div>
  );
};

export default DownloadOptions;

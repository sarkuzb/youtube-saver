import React, { useState } from "react";
import { validateYouTubeURL } from "../../utils/validation";
import styles from "./downloader.module.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Youtube,
  ClipboardPaste,
  Loader,
  PlayCircle,
  AlertCircle,
} from "lucide-react";

const DownloaderForm = ({ onSubmit, isLoading }) => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Please enter a YouTube URL");
      return;
    }

    if (!validateYouTubeURL(url)) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    onSubmit(url);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      setError("");
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 bg-white p-6 rounded-2xl shadow-md border border-gray-200 max-w-xl mx-auto"
    >
      {/* URL Input */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 flex-1 border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 focus-within:ring-2 focus-within:ring-indigo-500 transition">
          <Youtube className="text-red-500 w-5 h-5 shrink-0" />
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError("");
            }}
            placeholder="Paste a YouTube video URL..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
            disabled={isLoading}
          />
        </div>

        {/* Paste Button */}
        <button
          type="button"
          onClick={handlePaste}
          disabled={isLoading}
          title="Paste from clipboard"
          className="p-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 transition cursor-pointer"
        >
          <ClipboardPaste className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="flex items-center text-red-500 gap-2 text-sm"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !url.trim()}
        className="w-full py-3 px-6 text-white font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition cursor-pointer"
      >
        {isLoading ? (
          <>
            <Loader className="animate-spin w-5 h-5" />
            Getting Video Info...
          </>
        ) : (
          <>
            <PlayCircle className="w-5 h-5" />
            Get Video Info
          </>
        )}
      </button>
    </motion.form>
  );
};

export default DownloaderForm;

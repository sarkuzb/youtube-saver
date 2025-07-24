import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { downloaderAPI } from "../../services/api";
import DownloaderForm from "./DownloaderForm";
import DownloadOptions from "./DownloadOptions";
import styles from "./downloader.module.css";
import { motion } from "framer-motion";
import { Video, Music, Zap, Circle } from "lucide-react";

const DownloaderPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [serverStatus, setServerStatus] = useState("checking");

  useEffect(() => {
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
    try {
      await downloaderAPI.checkHealth();
      setServerStatus("online");
    } catch (error) {
      setServerStatus("offline");
      toast.error("Server is offline. Please try again later.");
    }
  };

  const handleSubmit = async (url) => {
    setIsLoading(true);
    setVideoInfo(null);
    setVideoUrl(url);

    try {
      const info = await downloaderAPI.getVideoInfo(url);
      setVideoInfo(info);
      toast.success("Video information loaded successfully!");
    } catch (error) {
      toast.error(error.message || "Failed to get video information");
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setVideoInfo(null);
    setVideoUrl("");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-gray-50 text-gray-800">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-4xl px-6 py-8 text-center"
      >
        <h1 className="text-3xl font-bold text-indigo-600">
          YouTube Downloader
        </h1>
        <p className="mt-2 text-gray-600">
          Download YouTube videos in any format
        </p>
        <div className="mt-4 flex items-center justify-center text-sm text-gray-500">
          <Circle
            fill={serverStatus === "online" ? "#22c55e" : "#f87171"}
            stroke="none"
            className="w-3 h-3 mr-2"
          />
          Server: {serverStatus}
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="w-full max-w-2xl px-6 flex-1">
        {!videoInfo ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-10"
          >
            {/* Downloader Form */}
            <DownloaderForm onSubmit={handleSubmit} isLoading={isLoading} />

            {/* Features */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: { staggerChildren: 0.15 },
                },
              }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-6"
            >
              {/* Feature 1 */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 },
                }}
                className="bg-white shadow rounded-lg p-5 text-center"
              >
                <Video className="mx-auto text-indigo-600 bg-indigo-100 p-2 rounded-lg w-10 h-10 mb-3" />
                <h3 className="font-semibold text-lg">Multiple Formats</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Download in various video qualities from 144p to 4K
                </p>
              </motion.div>

              {/* Feature 2 */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 },
                }}
                className="bg-white shadow rounded-lg p-5 text-center"
              >
                <Music className="mx-auto text-indigo-600 bg-indigo-100 p-2 rounded-lg w-10 h-10 mb-3" />
                <h3 className="font-semibold text-lg">Audio Only</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Extract audio in high quality MP3 format
                </p>
              </motion.div>

              {/* Feature 3 */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 },
                }}
                className="bg-white shadow rounded-lg p-5 text-center"
              >
                <Zap className="mx-auto text-indigo-600 bg-indigo-100 p-2 rounded-lg w-10 h-10 mb-3" />
                <h3 className="font-semibold text-lg">Fast Downloads</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Quick and reliable download speeds
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <button
              onClick={handleReset}
              className="text-indigo-600 hover:underline text-sm cursor-pointer"
            >
              ← Download Another Video
            </button>
            <DownloadOptions videoInfo={videoInfo} videoUrl={videoUrl} />
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="w-full max-w-4xl px-6 py-8 text-center text-sm text-gray-400 border-t-2 mt-10"
      >
        <p>© 2024 YouTube Downloader. For educational purposes only.</p>
        <p className="mt-1">
          Please respect copyright laws and YouTube’s Terms of Service.
        </p>
      </motion.footer>
    </div>
  );
};

export default DownloaderPage;

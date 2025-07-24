// ✅ Improved YouTube URL validation (supports watch, embed, shorts, youtu.be, etc.)
export const validateYouTubeURL = (url) => {
  if (!url || typeof url !== "string") return false;

  const pattern =
    /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|shorts\/)?[\w\-]{11}([&?#].*)?$/;
  return pattern.test(url.trim());
};

// ✅ Extract the YouTube video ID from supported URL formats
export const extractVideoId = (url) => {
  if (!url || typeof url !== "string") return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([\w\-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

// ✅ Format video duration from seconds to HH:MM:SS or MM:SS
export const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return "N/A";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

// ✅ Format view count like 1.2M, 4.5K, etc.
export const formatViewCount = (count) => {
  if (!count || isNaN(count)) return "N/A";

  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

import React, { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export default function ResultsGrid({ results }) {
  const [selectedResult, setSelectedResult] = useState(null);
  const [youtubeLinks, setYoutubeLinks] = useState({});
  const [fpsMap, setFpsMap] = useState({});
  const [showVideo, setShowVideo] = useState(false); // trạng thái hiện video

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ytRes, fpsRes] = await Promise.all([
          fetch("/metadata/youtube_links.json"),
          fetch("/metadata/batch1_fps.json"),
        ]);
        if (!ytRes.ok || !fpsRes.ok) throw new Error("Failed to load JSON files");
        const ytData = await ytRes.json();
        const fpsData = await fpsRes.json();
        setYoutubeLinks(ytData);
        setFpsMap(fpsData);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const openModal = (result, index) => {
    setSelectedResult({ ...result, index });
    setShowVideo(false); // reset video ẩn khi mở modal khác
  };

  const closeModal = () => {
    setSelectedResult(null);
    setShowVideo(false);
  };

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") closeModal();
    };
    if (selectedResult) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [selectedResult]);

  const getImageSrc = (path) => {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (path.includes("\\") || path.match(/^[A-Z]:/)) {
      const normalizedPath = path.replace(/\\/g, "/");
      return `file:///${normalizedPath}`;
    }
    return path;
  };

  const getVideoTimeSeconds = (name_img, video_name) => {
    const fps = fpsMap[video_name] ?? 25;
    const frameNum = parseInt(name_img);
    if (isNaN(frameNum) || fps <= 0) return 0;
    return frameNum / fps;
  };

  const getYoutubeEmbedUrl = (video_name, name_img) => {
    const baseUrl = youtubeLinks[video_name];
    if (!baseUrl) return null;
    try {
      const urlObj = new URL(baseUrl);
      const videoId = urlObj.searchParams.get("v");
      if (!videoId) return null;
      const startSeconds = Math.floor(getVideoTimeSeconds(name_img, video_name));
      // Sửa lại tham số query đúng cú pháp & thay vì &amp;
      return `https://www.youtube.com/embed/${videoId}?start=${startSeconds}&autoplay=1&rel=0&modestbranding=1`;
    } catch {
      return null;
    }
  };

  return (
    <>
      {/* Grid ảnh */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {results
          .slice()
          .sort((a, b) => b.score - a.score)
          .map((result, i) => (
            <div
              key={i}
              className="relative aspect-square cursor-pointer group overflow-hidden rounded-md shadow-sm hover:shadow-md transition-all duration-200"
              onClick={() => openModal(result, i + 1)}
              title={`Video: ${result.video_name}, Image: ${result.name_img}, Score: ${result.score.toFixed(3)}`}
            >
              {result.path ? (
                <img
                  src={getImageSrc(result.path)}
                  alt={`Keyframe ${i + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "";
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-300">
                  <span className="text-lg">🖼️</span>
                  <span className="text-xs text-center">No Image</span>
                </div>
              )}
              <div className="absolute top-1 right-1 bg-green-600/90 text-white px-1.5 py-0.5 rounded text-xs font-bold">
                {Number(result.score ?? 0).toFixed(2)}
              </div>
            </div>
          ))}
      </div>

      {/* Modal chi tiết */}
      {selectedResult && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
          aria-modal="true"
          role="dialog"
          aria-labelledby="modal-title"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close modal"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>

            <div className="p-6">
              <h3 id="modal-title" className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                Result #{selectedResult.index}
              </h3>
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                  Score: {Number(selectedResult.score ?? 0).toFixed(4)}
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Ảnh keyframe */}
                <div className="flex justify-center">
                  {selectedResult.path ? (
                    <img
                      src={getImageSrc(selectedResult.path)}
                      alt={`Keyframe ${selectedResult.index}`}
                      className="max-w-full max-h-96 object-contain rounded-lg shadow-md"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "";
                      }}
                    />
                  ) : (
                    <div className="w-64 h-64 bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-300 rounded-lg">
                      <span className="text-4xl">🖼️</span>
                      <span>Image Not Available</span>
                    </div>
                  )}
                </div>

                {/* Thông tin video và nút play */}
                <div className="flex flex-col items-center justify-center">
                  <div className="mb-4 w-full">
                    <label className="block text-sm font-semibold mb-1">Video Name</label>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg font-mono text-sm break-all">
                      {selectedResult.video_name || "-"}
                    </div>
                  </div>

                  <div className="mb-4 w-full">
                    <label className="block text-sm font-semibold mb-1">Image Name</label>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg font-mono text-sm">
                      {selectedResult.name_img ?? "-"}
                    </div>
                  </div>

                  {!showVideo && (
                    <button
                      className="px-6 py-3 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      onClick={() => setShowVideo(true)}
                    >
                      ▶ Play YouTube Video
                    </button>
                  )}
                </div>
              </div>

              {/* Hiển thị video YouTube nhúng khi bấm Play */}
              {showVideo && (
                <div className="flex justify-center">
                  {getYoutubeEmbedUrl(selectedResult.video_name, selectedResult.name_img) ? (
                    <iframe
                      width="100%"
                      height="365"
                      src={getYoutubeEmbedUrl(selectedResult.video_name, selectedResult.name_img)}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ border: "none", borderRadius: "8px" }}
                    />
                  ) : (
                    <p className="text-red-600">Video YouTube không khả dụng</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

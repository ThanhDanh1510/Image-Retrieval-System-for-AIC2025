import React, { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import YoutubePlayerWithFrameCounter from "./YoutubePlayerWithFrameCounter";

// <<< THAY ĐỔI 1: Nhận thêm prop `onSimilaritySearch` từ App.js >>>
export default function ResultsGrid({ results, onSimilaritySearch }) {
  const [selectedResult, setSelectedResult] = useState(null);
  const [youtubeLinks, setYoutubeLinks] = useState({});
  const [fpsMap, setFpsMap] = useState({});
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ytRes, fpsRes] = await Promise.all([
          fetch("/metadata/youtube_links_all.json"),
          fetch("/metadata/full_data_fps.json"),
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
    setShowVideo(false);
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
    if (!path) return "";
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
  
  const getVideoIdFromUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get("v");
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
              key={`${result.path}-${i}`}
              className="relative aspect-square cursor-pointer group overflow-hidden rounded-md shadow-sm hover:shadow-md transition-all duration-200"
              onClick={() => openModal(result, i + 1)}
              title={`Video: ${result.video_name}, Image: ${result.name_img}, Score: ${result.score.toFixed(3)}`}
            >
              <img
                src={getImageSrc(result.path)}
                alt={`Keyframe ${i + 1}`}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                onError={(e) => { e.currentTarget.src = ""; }}
              />
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
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>

            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                Result #{selectedResult.index}
              </h3>
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                  Score: {Number(selectedResult.score ?? 0).toFixed(4)}
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="flex justify-center items-center">
                  <img
                    src={getImageSrc(selectedResult.path)}
                    alt={`Keyframe ${selectedResult.index}`}
                    className="max-w-full max-h-96 object-contain rounded-lg shadow-md"
                  />
                </div>

                <div className="flex flex-col justify-center space-y-4">
                  <div className="w-full">
                    <label className="block text-sm font-semibold mb-1">Video Name</label>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg font-mono text-sm break-all">
                      {selectedResult.video_name || "-"}
                    </div>
                  </div>
                  <div className="w-full">
                    <label className="block text-sm font-semibold mb-1">Image Name</label>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg font-mono text-sm">
                      {selectedResult.name_img ?? "-"}
                    </div>
                  </div>
                  {selectedResult?.ocr_text && (
                    <div className="w-full">
                      <label className="block text-sm font-semibold mb-1 text-purple-600 dark:text-purple-400">OCR Text</label>
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-700 text-sm leading-relaxed max-h-32 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200">{selectedResult.ocr_text}</pre>
                      </div>
                    </div>
                  )}

                  {/* <<< THAY ĐỔI 2 & 3: Container chứa các nút và nút "Find Similar" mới >>> */}
                  {!showVideo && (
                    <div className="flex items-center justify-center gap-4 pt-2">
                      <button
                        className="px-6 py-3 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        onClick={() => setShowVideo(true)}
                      >
                        ▶ Play YouTube
                      </button>
                      <button
                        className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        onClick={() => {
                          onSimilaritySearch(selectedResult.key, 100);
                          closeModal();
                        }}
                      >
                        ✨ Find Similar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {showVideo && (
                <div className="flex justify-center">
                  {youtubeLinks[selectedResult.video_name] ? (
                    <YoutubePlayerWithFrameCounter
                      videoId={getVideoIdFromUrl(youtubeLinks[selectedResult.video_name])}
                      startSeconds={Math.floor(getVideoTimeSeconds(selectedResult.name_img, selectedResult.video_name))}
                      fps={fpsMap[selectedResult.video_name] ?? 25}
                    />
                  ) : (
                    <p className="text-red-600 dark:text-red-400">YouTube video not available for this keyframe.</p>
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
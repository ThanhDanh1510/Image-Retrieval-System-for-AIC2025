import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import YoutubePlayerWithFrameCounter from "./YoutubePlayerWithFrameCounter";

// Helper function to extract info from image path
const parseInfoFromPath = (path) => {
  if (!path) return { video_name: null, name_img: null, key: null }; // Added key: null
  // Regex tries to find the keyframe key (numeric part) at the end of the filename
  const keyMatch = path.match(/(\d+)\.webp$/);
  const key = keyMatch ? parseInt(keyMatch[1], 10) : null; // Extract key if possible

  const match = path.match(/(L\d{2}|K\d{2}|K0\d{1})\/(V\d{3})\/(\d+)\.webp$/);

  if (match) {
    const [, group, video, img] = match;
    return {
      video_name: `${group}_${video}`,
      name_img: img,
      key: key, // Return the extracted key
    };
  }

  console.warn("Could not parse path:", path);
  return { video_name: null, name_img: null, key: key }; // Return key even if path parsing fails
};


// <<< Receive `onSimilaritySearch` prop >>>
export default function ResultsGrid({ results, mode, onSimilaritySearch }) {
  const [selectedResult, setSelectedResult] = useState(null);
  const [youtubeLinks, setYoutubeLinks] = useState({});
  const [fpsMap, setFpsMap] = useState({});
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Assume metadata files are in public/metadata/
        const [ytRes, fpsRes] = await Promise.all([
          fetch("/metadata/youtube_links_all.json"),
          fetch("/metadata/full_data_fps.json"),
        ]);
        if (!ytRes.ok || !fpsRes.ok) throw new Error("Failed to load metadata JSON files");
        const ytData = await ytRes.json();
        const fpsData = await fpsRes.json();
        setYoutubeLinks(ytData);
        setFpsMap(fpsData);
      } catch (err) {
        console.error("Error fetching metadata:", err);
      }
    };
    fetchData();
  }, []);

  const openModal = (result, index) => {
    // Ensure the key exists in the result object for similarity search
    // If results come from API directly, they should have `key`
    // If parsed from path (TRAKE), parseInfoFromPath adds it
    const resultWithKey = result.key !== undefined ? result : { ...result, key: parseInfoFromPath(result.path)?.key };
    setSelectedResult({ ...resultWithKey, index });
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

  // Use a placeholder for broken images
  const placeholderImage = "/placeholder.png"; // Add a placeholder image in your public folder

  const getImageSrc = (path) => {
    if (!path) return placeholderImage;
    // Basic check if it's already a full URL
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    // Handle potential local file paths if needed (less common for web apps)
    // if (path.includes("\\") || path.match(/^[A-Z]:/)) {
    //   const normalizedPath = path.replace(/\\/g, "/");
    //   return `file:///${normalizedPath}`; // Note: file:// protocol might not work in browsers due to security
    // }
    // Assume it's a relative path from the server root if not a full URL
    return path.startsWith('/') ? path : `/${path}`; // Ensure leading slash if needed
  };

   const handleImageError = (e) => {
     if (e.target.src !== placeholderImage) {
        console.warn(`Failed to load image: ${e.target.currentSrc || e.target.src}. Showing placeholder.`);
        e.target.src = placeholderImage;
     }
      e.target.onerror = null; // Prevent infinite loop if placeholder fails
   };

  const getVideoTimeSeconds = (name_img, video_name) => {
    const fps = fpsMap[video_name] ?? 30; // Default to 30 if not found
    const frameNum = parseInt(name_img, 10);
    if (isNaN(frameNum) || fps <= 0) return 0;
    return frameNum / fps;
  };

  const getVideoIdFromUrl = (url) => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get("v");
    } catch (e){
      console.error("Invalid YouTube URL:", url, e);
      return null;
    }
  };

  let gridContent;

  if (mode === "TRAKE") {
    const sortedResults = results?.slice().sort((a, b) => (b.dp_score ?? 0) - (a.dp_score ?? 0)) || [];
    gridContent = (
      <div className="space-y-4">
        {sortedResults.length === 0 ? (
           <p className="text-gray-500 dark:text-gray-400 text-center py-4">No TRAKE results found.</p>
        ) : (
          sortedResults.map((videoResult, idx) => (
            <div
              key={videoResult.video_id || idx}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
            >
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">
                Video: {videoResult.video_id || `${videoResult.group_num}/${videoResult.video_num}`}
                <span className="ml-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                  Score: {Number(videoResult.dp_score ?? 0).toFixed(4)}
                </span>
              </h3>

              <div className="flex flex-row items-center gap-2 pb-2 overflow-x-auto">
                {videoResult.aligned_key_paths && videoResult.aligned_key_paths.length > 0 ? (
                  videoResult.aligned_key_paths.map((path, imgIdx) => {
                    const { video_name, name_img, key } = parseInfoFromPath(path);
                    const modalData = {
                      path: path,
                      score: videoResult.dp_score,
                      video_name: video_name,
                      name_img: name_img,
                      key: key, // Pass the key to modal data
                    };

                    return (
                      <div
                        key={imgIdx}
                        className="relative flex-shrink-0 cursor-pointer group"
                        onClick={() => openModal(modalData, `Video ${idx + 1} - Frame ${imgIdx + 1}`)}
                        title={`Video: ${video_name}, Frame: ${name_img}`}
                      >
                        <img
                          src={getImageSrc(path)}
                          alt={`Aligned keyframe ${imgIdx + 1} for video ${videoResult.video_id}`}
                          className="h-36 w-auto object-contain rounded-md bg-gray-100 dark:bg-gray-700 group-hover:scale-110 transition-transform duration-200"
                          onError={handleImageError}
                        />
                        <div className="absolute bottom-1 left-1 bg-black/50 text-white px-1 py-0.5 rounded text-xs font-mono">
                          {name_img}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">
                    No aligned keyframes found for this video result.
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    );
  } else {
    // Default grid view for semantic/OCR search
    const sortedResults = results?.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) || [];
    gridContent = (
       sortedResults.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4 col-span-full">No results found.</p>
       ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
            {sortedResults.map((result, i) => (
              <div
                key={result.key ? `key-${result.key}` : `idx-${i}`} // Use key if available for better stability
                className="relative aspect-square cursor-pointer group overflow-hidden rounded-md shadow-sm hover:shadow-md transition-all duration-200 bg-gray-100 dark:bg-gray-700"
                onClick={() => openModal(result, i + 1)}
                title={`Video: ${result.video_name}, Frame: ${result.name_img}, Score: ${Number(result.score ?? 0).toFixed(3)}`}
              >
                <img
                  src={getImageSrc(result.path)}
                  alt={`Keyframe ${result.name_img || i + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                  onError={handleImageError}
                />
                <div className="absolute top-1 right-1 bg-green-600/90 text-white px-1.5 py-0.5 rounded text-xs font-bold">
                  {Number(result.score ?? 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
       )
    );
  }

  // Common Modal Structure
  return (
    <>
      {gridContent}

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
              aria-label="Close modal"
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
                {/* Display keyframe key if available */}
                {selectedResult.key !== undefined && selectedResult.key !== null && (
                    <span className="bg-gray-500 text-white px-3 py-1 rounded-full text-sm font-mono">
                      Key: {selectedResult.key}
                    </span>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Image Display */}
                <div className="flex justify-center items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-2">
                  <img
                    src={getImageSrc(selectedResult.path)}
                    alt={`Keyframe ${selectedResult.name_img || selectedResult.index}`}
                    className="max-w-full max-h-96 object-contain rounded"
                    onError={handleImageError}
                  />
                </div>

                {/* Information and Actions */}
                <div className="flex flex-col space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Video Name</label>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg font-mono text-sm text-gray-900 dark:text-gray-100 break-all">
                      {selectedResult.video_name || "N/A"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Frame Number</label>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg font-mono text-sm text-gray-900 dark:text-gray-100">
                      {selectedResult.name_img ?? "N/A"}
                    </div>
                  </div>

                  {/* Optional OCR Text Display */}
                  {selectedResult?.ocr_text && (
                    <div>
                      <label className="block text-sm font-semibold mb-1 text-purple-600 dark:text-purple-400">OCR Text</label>
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-700 text-sm leading-relaxed max-h-32 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200">{selectedResult.ocr_text}</pre>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {!showVideo && (
                    <div className="flex items-center justify-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                        onClick={() => setShowVideo(true)}
                        disabled={!youtubeLinks[selectedResult.video_name]} // Disable if no link
                        title={!youtubeLinks[selectedResult.video_name] ? "YouTube link not available" : "Play video from this frame"}
                      >
                        ▶ Play YouTube
                      </button>
                      <button
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium disabled:bg-gray-400"
                        onClick={() => {
                           if (selectedResult.key !== undefined && selectedResult.key !== null && onSimilaritySearch) {
                                onSimilaritySearch(selectedResult.key, 100); // Defaulting to top_k=100
                                closeModal();
                           } else {
                                alert("Cannot perform similarity search: Keyframe key is missing.");
                           }
                        }}
                        disabled={selectedResult.key === undefined || selectedResult.key === null || !onSimilaritySearch} // Disable if key missing or function not passed
                        title={selectedResult.key === undefined || selectedResult.key === null ? "Keyframe key missing" : "Find visually similar images"}
                      >
                        ✨ Find Similar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* YouTube Player Area */}
              {showVideo && (
                <div className="flex justify-center mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  {youtubeLinks[selectedResult.video_name] && getVideoIdFromUrl(youtubeLinks[selectedResult.video_name]) ? (
                    <YoutubePlayerWithFrameCounter
                      videoId={getVideoIdFromUrl(youtubeLinks[selectedResult.video_name])}
                      startSeconds={Math.floor(getVideoTimeSeconds(selectedResult.name_img, selectedResult.video_name))}
                      fps={fpsMap[selectedResult.video_name] ?? 30} // Use 30 fps default
                    />
                  ) : (
                    <p className="text-red-600 dark:text-red-400 text-center py-4">
                      YouTube video link is not available or invalid for this keyframe.
                    </p>
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
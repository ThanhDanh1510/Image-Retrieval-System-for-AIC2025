import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import YoutubePlayerWithFrameCounter from "./YoutubePlayerWithFrameCounter";

// Helper function to extract info from image path
const parseInfoFromPath = (path) => {
  if (!path) return { video_name: null, name_img: null, key: null };
  // Regex tries to find the keyframe key (numeric part) at the end of the filename
  // Updated regex to handle potential padding zeros if keys are stored that way
  const keyMatch = path.match(/(\d+)\.webp$/);
  // Key extraction needs careful checking based on how keys are actually stored/generated
  // Assuming the filename IS the key for now. Adjust if keys are different.
  const key = keyMatch ? parseInt(keyMatch[1], 10) : null;

  const match = path.match(/(L\d{2}|K\d{2}|K0\d{1})\/(V\d{3})\/(\d+)\.webp$/);

  if (match) {
    const [, group, video, img] = match;
    // Attempt to use filename number as key if parsing succeeds
    const parsedKey = parseInt(img, 10);
    return {
      video_name: `${group}_${video}`,
      name_img: img,
      key: !isNaN(parsedKey) ? parsedKey : key, // Prefer key from path structure if valid
    };
  }

  console.warn("Could not parse path structure:", path);
  // Fallback to key derived from filename only if structure parsing fails
  return { video_name: null, name_img: null, key: key };
};


// Receive `onSimilaritySearch` prop
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
    // Prioritize key from API response, fallback to parsing from path
    let keyToUse = result.key;
    if (keyToUse === undefined || keyToUse === null) {
        keyToUse = parseInfoFromPath(result.path)?.key;
    }
    // Ensure result object passed to modal has the key
    const resultWithKey = { ...result, key: keyToUse };
    setSelectedResult({ ...resultWithKey, index }); // index is rank or sequential number
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
  const placeholderImage = "/placeholder.png"; // Add placeholder.png to your public folder

  const getImageSrc = (path) => {
    if (!path) return placeholderImage;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    // Assume relative path from API base URL if not absolute
    // Ensure REACT_APP_API_BASE_URL is set in .env for this to work correctly
    const baseUrl = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";
    // Check if path already includes the base image path segment
    if (path.startsWith('/images/')) {
        return `${baseUrl}${path}`;
    } else {
        // Assume path needs the '/images/' prefix
        return `${baseUrl}/images/${path.startsWith('/') ? path.substring(1) : path}`;
    }
  };


   const handleImageError = (e) => {
     if (e.target.src !== placeholderImage && !e.target.src.endsWith(placeholderImage)) { // Check if not already placeholder
        console.warn(`Failed to load image: ${e.target.currentSrc || e.target.src}. Showing placeholder.`);
        e.target.src = placeholderImage;
     }
      e.target.onerror = null; // Prevent infinite loop
   };

  const getVideoTimeSeconds = (name_img, video_name) => {
    const fps = fpsMap[video_name] ?? 30; // Default to 30 fps
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

  // --- UI CHANGE: TRAKE Mode displays Rank and Score prominently ---
  if (mode === "TRAKE") {
    // Ensure results is an array before sorting
    const sortedResults = Array.isArray(results) ? results.slice().sort((a, b) => (b.dp_score ?? 0) - (a.dp_score ?? 0)) : [];
    gridContent = (
      <div className="space-y-4">
        {sortedResults.length === 0 ? (
           <p className="text-gray-500 dark:text-gray-400 text-center py-4">No DANTE (TRAKE) results found.</p>
        ) : (
          sortedResults.map((videoResult, idx) => ( // Use index 'idx' for rank
            <div
              key={videoResult.video_id || idx}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
            >
              {/* --- 👇 MODIFIED THIS H3 TO SHOW RANK FIRST 👇 --- */}
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-3 flex-wrap">
                 {/* Rank Badge */}
                 <span className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2.5 py-1 rounded-full text-sm font-semibold font-mono" title="Rank">
                   #{idx + 1}
                 </span>
                 {/* Video ID */}
                 <span title="Video ID">{videoResult.video_id || `${videoResult.group_num}/${videoResult.video_num}`}</span>
                 {/* Score Badge */}
                 <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold" title="DP Score">
                   Score: {Number(videoResult.dp_score ?? 0).toFixed(4)}
                 </span>
              </h3>
              {/* --- END MODIFICATION --- */}


              {/* Horizontal scroll for keyframes */}
              <div className="flex flex-row items-center gap-2 pb-2 overflow-x-auto">
                {videoResult.aligned_frames && videoResult.aligned_frames.length > 0 ? (
                  
                  // 2. Lặp qua 'aligned_frames', mỗi 'frame' là một object { key: ..., path: ... }
                  videoResult.aligned_frames.map((frame, imgIdx) => {
                    
                    // 3. Vẫn dùng parseInfoFromPath để lấy 'name_img' (số frame) từ 'frame.path'
                    const { video_name, name_img } = parseInfoFromPath(frame.path);
                    
                    // 4. Tạo modalData, quan trọng nhất là 'key: frame.key'
                    const modalData = { 
                      path: frame.path,               // Lấy path từ 'frame'
                      score: videoResult.dp_score,    // Lấy score từ 'videoResult'
                      video_name: video_name,         // Lấy video_name từ 'parseInfo'
                      name_img: name_img,             // Lấy name_img từ 'parseInfo'
                      key: frame.key,                 // Lấy ID thật từ 'frame' (QUAN TRỌNG)
                      rank: idx + 1,
                    };

                    return (
                      <div
                        // 5. Dùng 'frame.key' làm key cho React
                        key={frame.key} 
                        className="relative flex-shrink-0 cursor-pointer group"
                        // 6. Hàm onClick giờ sẽ gửi 'modalData' với 'key' chính xác
                        onClick={() => openModal(modalData, `Rank #${idx + 1} Video - Frame ${imgIdx + 1}`)}
                        title={`Video: ${video_name}, Frame: ${name_img}, Key: ${frame.key}`} // Cập nhật title
                      >
                        <img
                          src={getImageSrc(frame.path)} // Dùng 'frame.path'
                          alt={`Aligned keyframe ${imgIdx + 1} for video ${videoResult.video_id}`}
                          className="h-36 w-auto object-contain rounded-md bg-gray-100 dark:bg-gray-700 group-hover:scale-110 transition-transform duration-200"
                          onError={handleImageError}
                        />
                        <div className="absolute bottom-1 left-1 bg-black/50 text-white px-1 py-0.5 rounded text-xs font-mono">
                          {name_img} {/* Hiển thị số frame (name_img) */}
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
  // --- END TRAKE UI ---
  } else {
    // Default grid view for Semantic/OCR/Similarity search
    const sortedResults = Array.isArray(results) ? results.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : [];
    gridContent = (
       sortedResults.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4 col-span-full">No results found.</p>
       ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
            {sortedResults.map((result, i) => (
              <div
                key={result.key ? `key-${result.key}` : `idx-${i}`}
                className="relative aspect-square cursor-pointer group overflow-hidden rounded-md shadow-sm hover:shadow-md transition-all duration-200 bg-gray-100 dark:bg-gray-700"
                onClick={() => openModal(result, i + 1)} // Index 'i' here is just sequential order
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

  // Common Modal Structure (remains mostly the same, check key existence)
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
              {/* Modal Title including Rank if available */}
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                 {typeof selectedResult.index === 'string' && selectedResult.index.includes('Rank')
                   ? `Details for ${selectedResult.index}`
                   : `Result Detail` } {/* Show Rank info if passed from TRAKE */}
              </h3>
              <div className="flex items-center gap-2 mb-4 flex-wrap"> {/* Added flex-wrap */}
                <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                  Score: {Number(selectedResult.score ?? 0).toFixed(4)}
                </span>
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
                  {/* Video Name */}
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Video Name</label>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg font-mono text-sm text-gray-900 dark:text-gray-100 break-all">
                      {selectedResult.video_name || "N/A"}
                    </div>
                  </div>
                  {/* Frame Number */}
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
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                        onClick={() => setShowVideo(true)}
                        disabled={!youtubeLinks[selectedResult.video_name]}
                        title={!youtubeLinks[selectedResult.video_name] ? "YouTube link not available" : "Play video from this frame"}
                      >
                        ▶ Play YouTube
                      </button>
                      <button
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => {
                           if (selectedResult.key !== undefined && selectedResult.key !== null && onSimilaritySearch) {
                                onSimilaritySearch(selectedResult.key, 100);
                                closeModal();
                           } else {
                                alert("Cannot perform similarity search: Keyframe key is missing or callback not provided.");
                           }
                        }}
                        disabled={selectedResult.key === undefined || selectedResult.key === null || !onSimilaritySearch}
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
                      fps={fpsMap[selectedResult.video_name] ?? 30}
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


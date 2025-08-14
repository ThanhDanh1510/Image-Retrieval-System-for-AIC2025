import React, { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export default function ResultsGrid({ results }) {
  const [selectedResult, setSelectedResult] = useState(null);

  const openModal = (result, index) => {
    setSelectedResult({ ...result, index });
  };

  const closeModal = () => {
    setSelectedResult(null);
  };

  // Handle ESC key và cleanup
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    if (selectedResult) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [selectedResult]);

  // 🔹 Cập nhật getImageSrc để ưu tiên HTTP URL
  const getImageSrc = (path) => {
    if (!path) return null;
    
    // Nếu đã là HTTP URL từ QueryController → dùng luôn
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    
    // Fallback cho Windows path (nếu API chưa convert)
    if (path.includes('\\') || path.match(/^[A-Z]:/)) {
      const normalizedPath = path.replace(/\\/g, '/');
      return `file:///${normalizedPath}`;
    }
    
    return path;
  };

  return (
    <>
      {/* Grid với nhiều cột hơn để hiển thị nhiều ảnh */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {results
          .slice()
          .sort((a, b) => b.score - a.score)
          .map((result, i) => (
            <div
              key={i}
              className="relative aspect-square cursor-pointer group overflow-hidden rounded-md shadow-sm hover:shadow-md transition-all duration-200"
              onClick={() => openModal(result, i + 1)}
            >
              {result.path ? (
                <img
                  src={getImageSrc(result.path)}
                  alt={`Keyframe ${i + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                  onError={(e) => {
                    console.error('Failed to load image:', result.path);
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
              
              {/* Score badge nhỏ hơn */}
              <div className="absolute top-1 right-1 bg-green-600/90 text-white px-1.5 py-0.5 rounded text-xs font-bold">
                {Number(result.score ?? 0).toFixed(2)}
              </div>
            </div>
          ))}
      </div>

      {/* Modal Overlay */}
      {selectedResult && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Nút đóng */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>

            <div className="p-6">
              {/* Header */}
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  Result #{selectedResult.index}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                    Score: {Number(selectedResult.score ?? 0).toFixed(3)}
                  </span>
                  {/* 🔹 Hiển thị thêm metadata nếu có */}
                  {selectedResult.group_id && (
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                      Group: {selectedResult.group_id}
                    </span>
                  )}
                  {selectedResult.video_id && (
                    <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                      Video: {selectedResult.video_id}
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Ảnh */}
                <div className="flex justify-center">
                  {selectedResult.path ? (
                    <img
                      src={getImageSrc(selectedResult.path)}
                      alt={`Keyframe ${selectedResult.index}`}
                      className="max-w-full max-h-96 object-contain rounded-lg shadow-md"
                      onError={(e) => {
                        console.error('Failed to load image in modal:', selectedResult.path);
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

                {/* Metadata */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      File Path
                    </label>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg font-mono text-sm text-gray-800 dark:text-gray-100 break-all">
                      {selectedResult.path || "-"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      File Name
                    </label>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg font-mono text-sm text-gray-800 dark:text-gray-100">
                      {selectedResult.path ? selectedResult.path.split(/[/\\]/).pop() : "-"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Similarity Score
                    </label>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-sm text-gray-800 dark:text-gray-100">
                      {Number(selectedResult.score ?? 0).toFixed(6)}
                    </div>
                  </div>

                  {/* 🔹 Group ID từ QueryController */}
                  {selectedResult.group_id && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Group ID
                      </label>
                      <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-sm text-gray-800 dark:text-gray-100">
                        L{String(selectedResult.group_id).padStart(2, '0')}
                      </div>
                    </div>
                  )}

                  {/* 🔹 Video ID từ QueryController */}
                  {selectedResult.video_id && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Video ID
                      </label>
                      <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-sm text-gray-800 dark:text-gray-100">
                        V{String(selectedResult.video_id).padStart(3, '0')}
                      </div>
                    </div>
                  )}

                  {/* 🔹 Keyframe ID nếu có */}
                  {selectedResult.keyframe_id && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Keyframe ID
                      </label>
                      <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-sm text-gray-800 dark:text-gray-100">
                        {String(selectedResult.keyframe_id).padStart(8, '0')}
                      </div>
                    </div>
                  )}

                  {selectedResult.timestamp && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Timestamp
                      </label>
                      <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-sm text-gray-800 dark:text-gray-100">
                        {selectedResult.timestamp}ms
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

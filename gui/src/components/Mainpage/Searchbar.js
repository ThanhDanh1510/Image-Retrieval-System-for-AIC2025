import React, { useEffect, useRef, useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  SparklesIcon, // Icon nút rewrite
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";

// Định nghĩa các loại search
const SEARCH_TYPES = {
  SEMANTIC: 'semantic',
  OCR: 'ocr',
  TRAKE: 'TRAKE', // Tên cho DANTE/TRAKE
};

// Định nghĩa các chế độ filter
const FILTER_MODE_OPTIONS = [
  { key: "Default", label: "Default Filter" },
  { key: "Exclude Groups", label: "Exclude Groups Filter" },
  { key: "Include Groups & Videos", label: "Include Groups/Videos Filter" },
];

// --- Hằng số và hàm cho slider Penalty (Log scale) ---
const SLIDER_MIN = 0;
const SLIDER_MAX = 100;
const PENALTY_MIN_LOG_VALUE = 0.001;
const PENALTY_MAX = 5.0;
const LOG_MIN = Math.log10(PENALTY_MIN_LOG_VALUE);
const LOG_MAX = Math.log10(PENALTY_MAX);
const LOG_SCALE = (LOG_MAX - LOG_MIN) / (SLIDER_MAX - 1.0);

const sliderToLogPenalty = (sliderValue) => {
  if (sliderValue <= SLIDER_MIN) return 0.0;
  const logVal = LOG_MIN + ((sliderValue - 1) * LOG_SCALE);
  return Math.pow(10, logVal);
};

const penaltyToLogSlider = (penalty) => {
  if (penalty <= 0) return SLIDER_MIN;
  if (penalty < PENALTY_MIN_LOG_VALUE) return 1;
  if (penalty >= PENALTY_MAX) return SLIDER_MAX;
  const logVal = Math.log10(penalty);
  const sliderVal = 1.0 + (logVal - LOG_MIN) / LOG_SCALE;
  return Math.round(sliderVal);
};
// --- Kết thúc helpers ---

// Component SearchBar
export default function SearchBar({ onSubmit, onImageSearch, initialMode = "Default" }) {
  const [value, setValue] = useState("");
  const [filterMode, setFilterMode] = useState(initialMode); // State cho chế độ filter
  const [searchType, setSearchType] = useState(SEARCH_TYPES.SEMANTIC); // State cho loại search
  const [excludeGroups, setExcludeGroups] = useState("");
  const [includeGroups, setIncludeGroups] = useState("");
  const [includeVideos, setIncludeVideos] = useState("");
  const [topK, setTopK] = useState(100);
  const [scoreThreshold, setScoreThreshold] = useState(0.0);
  const [penaltyWeight, setPenaltyWeight] = useState(0.5);
  const [isRewriting, setIsRewriting] = useState(false); // State loading cho nút rewrite

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Tự điều chỉnh chiều cao textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  }, [value]);

  // Helpers parse filter inputs
  const parseGroupIds = (str) => str.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
  const parseVideoIds = (str) => str.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n));

  // Hàm xử lý khi nhấn nút Search (MagnifyingGlassIcon)
  const handleSubmit = () => {
    if (isRewriting) return; // Không submit khi đang rewrite

    // Chuẩn bị filter options dựa trên filterMode
    const filterOptions =
      filterMode === "Exclude Groups"
        ? { exclude_groups: parseGroupIds(excludeGroups) }
        : filterMode === "Include Groups & Videos"
        ? {
            include_groups: parseGroupIds(includeGroups),
            include_videos: parseVideoIds(includeVideos),
          }
        : {};

    // Xử lý search TRAKE (DANTE)
    if (searchType === SEARCH_TYPES.TRAKE) {
      const events = value.split('\n').map(s => s.trim()).filter(Boolean);
      if (events.length === 0) {
        window.alert("Please enter at least one event for DANTE (TRAKE) mode, separated by new lines.");
        return;
      }
      onSubmit?.(events, filterMode, { ...filterOptions, top_k: topK, penalty_weight: Number(penaltyWeight) || 0 }, SEARCH_TYPES.TRAKE);
    }
    // Xử lý search Semantic/OCR
    else {
      const query = value.trim();
      if (!query) {
        window.alert(`Please enter text to search (${searchType}).`);
        return;
      }
      onSubmit?.(query, filterMode, { ...filterOptions, top_k: topK, score_threshold: scoreThreshold }, searchType);
    }
  };

  // --- ✨ HÀM XỬ LÝ KHI NHẤN NÚT REWRITE (SparklesIcon) ✨ ---
  const handleRewriteClick = async () => {
    const currentQuery = value.trim();
    // Vô hiệu hóa nếu query rỗng, đang rewrite, hoặc đang ở mode TRAKE
    if (!currentQuery || isRewriting || searchType === SEARCH_TYPES.TRAKE) {
      return;
    }
    setIsRewriting(true); // Bắt đầu loading
    try {
      // Lấy URL backend từ biến môi trường hoặc dùng default
      const apiUrl = `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000'}/api/v1/keyframe/rewrite`;
      console.log("Calling rewrite API:", apiUrl); // Log URL đang gọi

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: currentQuery }), // Gửi query hiện tại
      });

      // Kiểm tra response từ backend
      if (!response.ok) {
         const errorText = await response.text(); // Lấy text lỗi nếu có
         // Ném lỗi để hiển thị alert
        throw new Error(`Rewrite failed (${response.status}): ${response.statusText}. ${errorText}`);
      }

      // Parse kết quả JSON
      const data = await response.json();
      console.log("Rewrite response data:", data); // Log kết quả

      // Cập nhật ô search nếu có kết quả rewrite
      if (data && data.rewritten_query) {
        setValue(data.rewritten_query); // Thay thế query cũ bằng query mới
      } else {
        // Log và thông báo nếu response không đúng định dạng
        console.warn("Rewrite response missing rewritten_query:", data);
        alert("Rewrite successful, but response format unexpected. Original query kept.");
      }
    } catch (error) {
      // Log và hiển thị lỗi nếu có vấn đề
      console.error("Error during query rewrite:", error);
      alert(`Failed to rewrite query: ${error.message}`);
    } finally {
      setIsRewriting(false); // Kết thúc loading
    }
  };
  // --- ✨ KẾT THÚC HÀM REWRITE ✨ ---

  // Hàm xử lý khi chọn file ảnh (ArrowUpTrayIcon)
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && onImageSearch) {
      onImageSearch(file, topK); // Gọi hàm onImageSearch từ App.js
    }
    if (event.target) {
        event.target.value = null; // Reset input để có thể chọn lại cùng file
    }
  };

  // Helper xóa số 0 ở đầu (cho input number)
  const stripLeadingZeros = (val) => {
    if (val === "" || val === "0") return val;
    return val.replace(/^0+(\d)/, "$1");
  };

  // Handlers cho slider Penalty (TRAKE)
  const handleSliderChange = (e) => {
    const sliderVal = Number(e.target.value);
    const newPenalty = sliderToLogPenalty(sliderVal);
    const precision = newPenalty > 0 ? Math.max(3, -Math.floor(Math.log10(newPenalty))) : 3;
    setPenaltyWeight(Number(newPenalty.toFixed(precision)));
  };
  const handleNumberChange = (e) => {
     let valStr = e.target.value;
     if (valStr === "" || valStr === ".") { setPenaltyWeight(valStr); return; }
     if ((valStr.match(/\./g) || []).length > 1) return;
     if (!/^\d*\.?\d*$/.test(valStr)) return;
     setPenaltyWeight(valStr); // Giữ dạng chuỗi khi đang gõ
  };
   const handleNumberBlur = (e) => { // Validate khi bỏ focus
      let finalVal = parseFloat(penaltyWeight);
       if (isNaN(finalVal) || finalVal < 0) finalVal = 0;
       if (finalVal > PENALTY_MAX) finalVal = PENALTY_MAX;
       setPenaltyWeight(finalVal); // Set giá trị số đã chuẩn hóa
   };
  const getSliderValue = () => { // Tính giá trị cho slider từ state
    const penaltyNum = Number(penaltyWeight);
    if (isNaN(penaltyNum)) return SLIDER_MIN;
    return penaltyToLogSlider(penaltyNum);
  };

  // --- RENDER COMPONENT ---
  return (
    <div className="w-full max-w-3xl mx-auto space-y-3 p-2">

      {/* Hàng nút chọn Search Type & Upload */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {/* Nút Semantic */}
        <button
          onClick={() => setSearchType(SEARCH_TYPES.SEMANTIC)}
          className={`px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors duration-200 shadow ${
            searchType === SEARCH_TYPES.SEMANTIC ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        > Semantic </button>
        {/* Nút OCR */}
        <button
          onClick={() => setSearchType(SEARCH_TYPES.OCR)}
          className={`px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors duration-200 shadow ${
            searchType === SEARCH_TYPES.OCR ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        > OCR </button>
         {/* Nút DANTE (TRAKE) */}
        <button
          onClick={() => setSearchType(SEARCH_TYPES.TRAKE)}
          className={`px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors duration-200 shadow ${
            searchType === SEARCH_TYPES.TRAKE ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        > DANTE </button>
        {/* Nút Upload Image (disable khi chọn DANTE) */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={searchType === SEARCH_TYPES.TRAKE}
          className="px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors duration-200 bg-green-600 text-white shadow hover:bg-green-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          title={searchType === SEARCH_TYPES.TRAKE ? "Upload disabled in DANTE mode" : "Search by uploading an image"}
        > <ArrowUpTrayIcon className="w-4 h-4 inline-block mr-1 sm:mr-2" /> Upload Image </button>
        {/* Input file ẩn */}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
      </div>

      {/* Ô nhập liệu và các nút action */}
      <div className="relative">
        {/* Textarea nhập query/events */}
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={
            searchType === SEARCH_TYPES.TRAKE ? "Enter events, one per line..." : `Enter ${searchType} search query...`
          }
          className="pl-3 pr-32 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2 shadow-sm sm:text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-600 resize-none overflow-y-auto"
          style={{ minHeight: '42px', maxHeight: '150px' }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Submit bằng Enter (trừ DANTE và Shift+Enter)
            if (e.key === "Enter" && !e.shiftKey && searchType !== SEARCH_TYPES.TRAKE) { e.preventDefault(); handleSubmit(); }
            // Xóa bằng Escape
            if (e.key === "Escape") { e.preventDefault(); setValue(""); }
          }}
        />

        {/* Các nút icon bên phải ô nhập liệu */}
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {/* Nút Xóa (XMarkIcon) */}
          {value && (
            <button type="button" aria-label="Clear" onClick={() => setValue("")}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300"
            > <XMarkIcon className="w-4 h-4" /> </button>
          )}

          {/* Nút Rewrite (SparklesIcon) - disable khi đang rewrite hoặc chọn DANTE */}
          <button
            type="button" aria-label="Rewrite Query" onClick={handleRewriteClick}
            disabled={isRewriting || !value.trim() || searchType === SEARCH_TYPES.TRAKE}
            className={`p-1.5 rounded transition-colors ${ isRewriting ? "bg-gray-400 text-gray-600 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed" }`}
            title={searchType === SEARCH_TYPES.TRAKE ? "Rewrite unavailable in DANTE mode" : "Enhance query with AI"}
          > <SparklesIcon className={`w-4 h-4 ${isRewriting ? 'animate-spin' : ''}`} /> </button>

          {/* Nút Filter (FunnelIcon) */}
          <Menu as="div" className="relative">
            <MenuButton
              aria-label="Select Filter Mode"
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              title={`Current Filter: ${FILTER_MODE_OPTIONS.find(m => m.key === filterMode)?.label || filterMode}`}
            > <FunnelIcon className="w-4 h-4" /> </MenuButton>
            {/* Dropdown menu cho Filter */}
            <MenuItems anchor="bottom end" className="z-20 mt-2 w-64 origin-top-right rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg focus:outline-none">
              <div className="py-1">
                {FILTER_MODE_OPTIONS.map((m) => (
                  <MenuItem key={m.key}>
                    {({ active }) => (
                      <button type="button"
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${ active ? "bg-blue-50 dark:bg-gray-700" : ""} ${ filterMode === m.key ? "font-semibold text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-gray-100" } `}
                        onClick={() => { setFilterMode(m.key); setExcludeGroups(""); setIncludeGroups(""); setIncludeVideos(""); }}
                      > {m.label} </button>
                    )}
                  </MenuItem>
                ))}
              </div>
              {/* Ô nhập liệu cho Filter */}
              {filterMode === "Exclude Groups" && (
                 <div className="border-t border-gray-200 dark:border-gray-700 p-2">
                   <input className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs dark:bg-gray-700 dark:text-gray-100" placeholder="Exclude Groups (e.g. 1, 3)" value={excludeGroups} onChange={(e) => setExcludeGroups(e.target.value)} />
                 </div>
              )}
              {filterMode === "Include Groups & Videos" && (
                 <div className="border-t border-gray-200 dark:border-gray-700 p-2 space-y-1">
                   <input className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs dark:bg-gray-700 dark:text-gray-100" placeholder="Include Groups (e.g. 2, 4)" value={includeGroups} onChange={(e) => setIncludeGroups(e.target.value)} />
                   <input className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs dark:bg-gray-700 dark:text-gray-100" placeholder="Include Videos (e.g. 101, 102)" value={includeVideos} onChange={(e) => setIncludeVideos(e.target.value)} />
                 </div>
              )}
            </MenuItems>
          </Menu>

          {/* Nút Search (MagnifyingGlassIcon) */}
          <button
            type="button" aria-label="Search" onClick={handleSubmit} disabled={isRewriting}
            className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          > <MagnifyingGlassIcon className="w-4 h-4" /> </button>
        </div>
      </div>

      {/* Khu vực Sliders (hiển thị tùy theo searchType) */}
      <div className="flex flex-wrap items-center justify-start gap-x-4 gap-y-2 text-xs sm:text-sm text-gray-600 dark:text-gray-300 pt-1">
        {/* Slider Top K (luôn hiển thị) */}
        <div className="flex items-center gap-1 sm:gap-2">
          <label htmlFor="topKNum" className="whitespace-nowrap font-medium">Top K:</label>
          <input id="topKNum" type="number" min={1} max={200} value={topK}
            onChange={(e) => { const val = stripLeadingZeros(e.target.value); setTopK(val === "" ? "" : Math.max(1, Math.min(200, Number(val)))); }}
            onBlur={(e)=>{ if(e.target.value === "") setTopK(1);}}
            className="w-12 sm:w-14 p-0.5 text-center border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white [appearance:textfield]"
          />
          <input id="topKRange" type="range" min={1} max={200} value={topK} onChange={(e) => setTopK(Number(e.target.value))} className="w-20 sm:w-24 cursor-pointer" />
        </div>

        {/* Slider Score Threshold (ẩn khi chọn DANTE) */}
        {searchType !== SEARCH_TYPES.TRAKE && (
          <div className="flex items-center gap-1 sm:gap-2">
            <label htmlFor="scoreNum" className="whitespace-nowrap font-medium">Score ≥:</label>
            <input id="scoreNum" type="number" min={0} max={1} step={0.05} value={scoreThreshold}
              onChange={(e) => { /*...validation...*/ setScoreThreshold(Math.max(0, Math.min(1, parseFloat(e.target.value) || 0))); }}
              onBlur={(e)=>{ /*...final validation...*/ setScoreThreshold(parseFloat(e.target.value) || 0); }}
              className="w-12 sm:w-14 p-0.5 text-center border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white [appearance:textfield]"
            />
            <input id="scoreRange" type="range" min={0} max={1} step={0.05} value={scoreThreshold} onChange={(e) => setScoreThreshold(Number(e.target.value))} className="w-20 sm:w-24 cursor-pointer" />
          </div>
        )}

        {/* Slider Penalty Weight (chỉ hiển thị khi chọn DANTE) */}
        {searchType === SEARCH_TYPES.TRAKE && (
          <div className="flex items-center gap-1 sm:gap-2">
            <label htmlFor="penaltyNum" className="whitespace-nowrap font-medium">Penalty:</label>
            <input id="penaltyNum" type="number" min={0} max={PENALTY_MAX} step={0.001} value={penaltyWeight}
              onChange={handleNumberChange}
              onBlur={handleNumberBlur}
              className="w-12 sm:w-14 p-0.5 text-center border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white [appearance:textfield]"
            />
            <input id="penaltyRange" type="range" min={SLIDER_MIN} max={SLIDER_MAX} step={1} value={getSliderValue()} onChange={handleSliderChange} className="w-20 sm:w-24 cursor-pointer" />
          </div>
        )}
      </div>
    </div>
  );
}
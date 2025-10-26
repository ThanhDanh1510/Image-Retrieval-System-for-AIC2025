import React, { useEffect, useRef, useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  SparklesIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";

// Define search types - Add TRAKE here
const SEARCH_TYPES = {
  SEMANTIC: 'semantic',
  OCR: 'ocr',
  TRAKE: 'TRAKE', // Added TRAKE
};

// Define filter modes - These apply WITHIN Semantic/OCR/TRAKE
const FILTER_MODE_OPTIONS = [ // Renamed from MODE_OPTIONS
  { key: "Default", label: "Default Filter" },
  { key: "Exclude Groups", label: "Exclude Groups Filter" },
  { key: "Include Groups & Videos", label: "Include Groups/Videos Filter" },
];

// --- Constants and helpers for Log Slider ---
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
  if (penalty < PENALTY_MIN_LOG_VALUE) return 1; // Snap near min
  if (penalty >= PENALTY_MAX) return SLIDER_MAX;
  const logVal = Math.log10(penalty);
  const sliderVal = 1.0 + (logVal - LOG_MIN) / LOG_SCALE;
  return Math.round(sliderVal); // Round to nearest integer for slider value
};
// --- End Log Slider Helpers ---

// Main Component Definition
export default function SearchBar({ onSubmit, onImageSearch, initialMode = "Default" }) {
  const [value, setValue] = useState("");
  // --- STATE CHANGE: 'mode' is now filterMode ---
  const [filterMode, setFilterMode] = useState(initialMode); // Renamed from 'mode'
  // --- STATE CHANGE: Added searchType state ---
  const [searchType, setSearchType] = useState(SEARCH_TYPES.SEMANTIC); // semantic, ocr, TRAKE
  // --- END STATE CHANGE ---
  const [excludeGroups, setExcludeGroups] = useState("");
  const [includeGroups, setIncludeGroups] = useState("");
  const [includeVideos, setIncludeVideos] = useState("");
  const [topK, setTopK] = useState(100);
  const [scoreThreshold, setScoreThreshold] = useState(0.0);
  const [penaltyWeight, setPenaltyWeight] = useState(0.5);
  const [isRewriting, setIsRewriting] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Adjust textarea height
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto"; // Reset height
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`; // Set height based on content, max 150px
  }, [value]);

  // Helper functions for parsing filter inputs
  const parseGroupIds = (str) => str.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean); // Allow comma, semicolon, space separators
  const parseVideoIds = (str) => str.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n));

  // Handle Text/TRAKE Search Submission
  const handleSubmit = () => {
    if (isRewriting) return; // Don't submit while AI is rewriting

    // Prepare filter options based on the selected filterMode
    // These apply to Semantic, OCR, AND TRAKE searches
    const filterOptions =
      filterMode === "Exclude Groups"
        ? { exclude_groups: parseGroupIds(excludeGroups) }
        : filterMode === "Include Groups & Videos"
        ? {
            include_groups: parseGroupIds(includeGroups),
            include_videos: parseVideoIds(includeVideos),
          }
        : {}; // Default mode has no extra filters

    // Handle TRAKE search
    if (searchType === SEARCH_TYPES.TRAKE) {
      const events = value.split('\n').map(s => s.trim()).filter(Boolean);
      if (events.length === 0) {
        window.alert("Please enter at least one event for DANTE (TRAKE) mode, separated by new lines.");
        return;
      }
      // Pass events array, filterMode, combined options, and searchType 'TRAKE'
      onSubmit?.(events, filterMode, { ...filterOptions, top_k: topK, penalty_weight: Number(penaltyWeight) || 0 }, SEARCH_TYPES.TRAKE);
    }
    // Handle Semantic/OCR text search
    else {
      const query = value.trim();
      if (!query) {
        window.alert(`Please enter text to search (${searchType}).`);
        return;
      }
      // Pass query string, filterMode, combined options, and searchType (semantic/ocr)
      onSubmit?.(query, filterMode, { ...filterOptions, top_k: topK, score_threshold: scoreThreshold }, searchType);
    }
  };

  // Handle AI Query Rewrite
  const handleRewriteClick = async () => {
     const currentQuery = value.trim();
    if (!currentQuery || isRewriting || searchType === SEARCH_TYPES.TRAKE) { // Disable rewrite for TRAKE
      return;
    }
    setIsRewriting(true);
    try {
      const apiUrl = `${process.env.REACT_APP_API_BASE_URL || ''}/api/v1/keyframe/rewrite`;
      console.log("Attempting to fetch:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: currentQuery }),
      });
      if (!response.ok) {
         const errorText = await response.text();
        throw new Error(`Rewrite failed (${response.status}): ${response.statusText}. ${errorText}`);
      }
      const data = await response.json();
      if (data && data.rewritten_query) {
        setValue(data.rewritten_query);
      } else {
        console.warn("Rewrite response missing rewritten_query:", data);
        alert("Rewrite success, but response format unexpected. Original query kept.");
      }
    } catch (error) {
      console.error("Error during query rewrite:", error);
      alert(`Failed to rewrite query: ${error.message}`);
    } finally {
      setIsRewriting(false);
    }
  };


  // Handle Image File Selection for Search
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && onImageSearch) {
      onImageSearch(file, topK);
    }
    if (event.target) {
        event.target.value = null;
    }
  };

  // Helper for input number fields
  const stripLeadingZeros = (val) => {
    if (val === "" || val === "0") return val; // Allow "0"
    return val.replace(/^0+(\d)/, "$1");
  };

  // Handlers for TRAKE penalty slider/number input
  const handleSliderChange = (e) => {
    const sliderVal = Number(e.target.value);
    const newPenalty = sliderToLogPenalty(sliderVal);
    // Dynamic precision based on value magnitude for better display
    const precision = newPenalty > 0 ? Math.max(3, -Math.floor(Math.log10(newPenalty))) : 3;
    setPenaltyWeight(Number(newPenalty.toFixed(precision)));
  };
  const handleNumberChange = (e) => {
     let valStr = e.target.value;
     if (valStr === "" || valStr === ".") { setPenaltyWeight(valStr); return; }
     if ((valStr.match(/\./g) || []).length > 1) return;
     if (!/^\d*\.?\d*$/.test(valStr)) return;

     let numVal = parseFloat(valStr);
     if (isNaN(numVal)) { setPenaltyWeight(valStr); return; } // Still typing like "0."

     // Don't clamp here, allow temporary out-of-bounds typing
     setPenaltyWeight(valStr);
  };
   const handleNumberBlur = (e) => { // Final validation and clamping on blur
      let finalVal = parseFloat(penaltyWeight);
       if (isNaN(finalVal) || finalVal < 0) finalVal = 0;
       if (finalVal > PENALTY_MAX) finalVal = PENALTY_MAX;
       setPenaltyWeight(finalVal); // Set the clamped number value
   };
  const getSliderValue = () => {
    const penaltyNum = Number(penaltyWeight);
    if (isNaN(penaltyNum)) return SLIDER_MIN;
    return penaltyToLogSlider(penaltyNum);
  };


  // --- RENDER ---
  return (
    <div className="w-full max-w-3xl mx-auto space-y-3 p-2">

      {/* Search Type Buttons and Upload Button */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {/* Semantic Button */}
        <button
          onClick={() => setSearchType(SEARCH_TYPES.SEMANTIC)}
          className={`px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors duration-200 shadow ${
            searchType === SEARCH_TYPES.SEMANTIC
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Semantic
        </button>
        {/* OCR Button */}
        <button
          onClick={() => setSearchType(SEARCH_TYPES.OCR)}
          className={`px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors duration-200 shadow ${
            searchType === SEARCH_TYPES.OCR
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          OCR
        </button>
         {/* DANTE (TRAKE) Button */}
        <button
          onClick={() => setSearchType(SEARCH_TYPES.TRAKE)}
          className={`px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors duration-200 shadow ${
            searchType === SEARCH_TYPES.TRAKE
              ? 'bg-red-600 text-white' // Different color for DANTE
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          DANTE
        </button>
        {/* Upload Image Button (Disabled when DANTE active) */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={searchType === SEARCH_TYPES.TRAKE} // Disable upload for DANTE
          className="px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors duration-200 bg-green-600 text-white shadow hover:bg-green-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          title={searchType === SEARCH_TYPES.TRAKE ? "Upload disabled in DANTE mode" : "Search by uploading an image"}
        >
          <ArrowUpTrayIcon className="w-4 h-4 inline-block mr-1 sm:mr-2" />
          Upload Image
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
      </div>

      {/* Text Input Area and Action Buttons */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={ // Placeholder depends on searchType now
            searchType === SEARCH_TYPES.TRAKE
              ? "Enter events, one per line..."
              : `Enter ${searchType} search query...`
          }
          className="pl-3 pr-32 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2 shadow-sm sm:text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-600 resize-none overflow-y-auto"
          style={{ minHeight: '42px', maxHeight: '150px' }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { // Submit logic depends on searchType now
            if (e.key === "Enter" && !e.shiftKey && searchType !== SEARCH_TYPES.TRAKE) {
              e.preventDefault();
              handleSubmit();
            }
            if (e.key === "Escape") { e.preventDefault(); setValue(""); }
          }}
        />

        {/* Action Icons on the right */}
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {/* Clear Button */}
          {value && (
            <button type="button" aria-label="Clear" onClick={() => setValue("")}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}

          {/* Rewrite Button (Disabled for DANTE) */}
          <button
            type="button" aria-label="Rewrite Query" onClick={handleRewriteClick}
            disabled={isRewriting || !value.trim() || searchType === SEARCH_TYPES.TRAKE} // Use searchType here
            className={`p-1.5 rounded transition-colors ${
              isRewriting
                ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed"
            }`}
            title={searchType === SEARCH_TYPES.TRAKE ? "Rewrite unavailable in DANTE mode" : "Enhance query with AI"}
          >
            <SparklesIcon className={`w-4 h-4 ${isRewriting ? 'animate-spin' : ''}`} />
          </button>

          {/* Filter Mode Menu */}
          <Menu as="div" className="relative">
            <MenuButton
              aria-label="Select Filter Mode"
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              title={`Current Filter: ${FILTER_MODE_OPTIONS.find(m => m.key === filterMode)?.label || filterMode}`} // Use filterMode here
            >
              <FunnelIcon className="w-4 h-4" />
            </MenuButton>

            <MenuItems
              anchor="bottom end"
              className="z-20 mt-2 w-64 origin-top-right rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg focus:outline-none"
            >
              <div className="py-1">
                {FILTER_MODE_OPTIONS.map((m) => ( // Use FILTER_MODE_OPTIONS
                  <MenuItem key={m.key}>
                    {({ active }) => (
                      <button type="button"
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          active ? "bg-blue-50 dark:bg-gray-700" : ""
                        } ${filterMode === m.key ? "font-semibold text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-gray-100"} `} // Use filterMode
                        onClick={() => {
                          setFilterMode(m.key); // Set filterMode
                          setExcludeGroups("");
                          setIncludeGroups("");
                          setIncludeVideos("");
                        }}
                      >
                        {m.label}
                      </button>
                    )}
                  </MenuItem>
                ))}
              </div>
              {/* Filter Input Fields (logic based on filterMode) */}
              {filterMode === "Exclude Groups" && (
                 <div className="border-t border-gray-200 dark:border-gray-700 p-2">
                   <input className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs dark:bg-gray-700 dark:text-gray-100" placeholder="Exclude Groups (e.g. 1, 3)"
                     value={excludeGroups} onChange={(e) => setExcludeGroups(e.target.value)} />
                 </div>
              )}
              {filterMode === "Include Groups & Videos" && (
                 <div className="border-t border-gray-200 dark:border-gray-700 p-2 space-y-1">
                   <input className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs dark:bg-gray-700 dark:text-gray-100" placeholder="Include Groups (e.g. 2, 4)"
                     value={includeGroups} onChange={(e) => setIncludeGroups(e.target.value)} />
                   <input className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs dark:bg-gray-700 dark:text-gray-100" placeholder="Include Videos (e.g. 101, 102)"
                     value={includeVideos} onChange={(e) => setIncludeVideos(e.target.value)} />
                 </div>
              )}
            </MenuItems>
          </Menu>

          {/* Search Button */}
          <button
            type="button" aria-label="Search" onClick={handleSubmit} disabled={isRewriting}
            className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sliders Area (Conditional Display) */}
      <div className="flex flex-wrap items-center justify-start gap-x-4 gap-y-2 text-xs sm:text-sm text-gray-600 dark:text-gray-300 pt-1">

        {/* TopK Slider (Always visible) */}
        <div className="flex items-center gap-1 sm:gap-2">
          <label htmlFor="topKNum" className="whitespace-nowrap font-medium">Top K:</label>
          <input id="topKNum" type="number" min={1} max={200} value={topK}
            onChange={(e) => {
              const val = stripLeadingZeros(e.target.value);
              setTopK(val === "" ? "" : Math.max(1, Math.min(200, Number(val))));
            }}
             onBlur={(e)=>{ if(e.target.value === "") setTopK(1);}}
            className="w-12 sm:w-14 p-0.5 text-center border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white [appearance:textfield]"
          />
          <input id="topKRange" type="range" min={1} max={200} value={topK}
            onChange={(e) => setTopK(Number(e.target.value))} className="w-20 sm:w-24 cursor-pointer" />
        </div>

        {/* Score Threshold Slider (Hidden for DANTE) */}
        {searchType !== SEARCH_TYPES.TRAKE && (
          <div className="flex items-center gap-1 sm:gap-2">
            <label htmlFor="scoreNum" className="whitespace-nowrap font-medium">Score ≥:</label>
            <input id="scoreNum" type="number" min={0} max={1} step={0.05} value={scoreThreshold}
              onChange={(e) => {
                let valStr = e.target.value;
                 if (valStr === "" || valStr === ".") { setScoreThreshold(valStr); return; }
                 if ((valStr.match(/\./g) || []).length > 1) return;
                 if (!/^\d*\.?\d*$/.test(valStr)) return;
                 let numVal = parseFloat(valStr);
                 if (isNaN(numVal)) { setScoreThreshold(valStr); return; }
                 setScoreThreshold(Math.max(0, Math.min(1, numVal)));
              }}
               onBlur={(e)=>{
                   let finalVal = parseFloat(scoreThreshold);
                   if (isNaN(finalVal) || finalVal < 0) finalVal = 0;
                   if (finalVal > 1) finalVal = 1;
                   setScoreThreshold(finalVal);
               }}
              className="w-12 sm:w-14 p-0.5 text-center border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white [appearance:textfield]"
            />
            <input id="scoreRange" type="range" min={0} max={1} step={0.05} value={scoreThreshold}
              onChange={(e) => setScoreThreshold(Number(e.target.value))} className="w-20 sm:w-24 cursor-pointer" />
          </div>
        )}

        {/* Penalty Weight Slider (Only for DANTE) */}
        {searchType === SEARCH_TYPES.TRAKE && (
          <div className="flex items-center gap-1 sm:gap-2">
            <label htmlFor="penaltyNum" className="whitespace-nowrap font-medium">Penalty:</label>
            <input id="penaltyNum" type="number" min={0} max={PENALTY_MAX} step={0.001} value={penaltyWeight}
              onChange={handleNumberChange}
              onBlur={handleNumberBlur}
              className="w-12 sm:w-14 p-0.5 text-center border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white [appearance:textfield]"
            />
            <input id="penaltyRange" type="range" min={SLIDER_MIN} max={SLIDER_MAX} step={1}
              value={getSliderValue()}
              onChange={handleSliderChange}
              className="w-20 sm:w-24 cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
}

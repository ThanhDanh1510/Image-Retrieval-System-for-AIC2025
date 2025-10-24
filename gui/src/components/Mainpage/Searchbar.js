import React, { useEffect, useRef, useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  SparklesIcon,
  ArrowUpTrayIcon, // Icon for upload
} from "@heroicons/react/24/outline";

// Define search types
const SEARCH_TYPES = {
  SEMANTIC: 'semantic',
  OCR: 'ocr',
};

// Define filter modes
const MODE_OPTIONS = [
  { key: "Default", label: "Default Filter" }, // Renamed for clarity
  { key: "Exclude Groups", label: "Exclude Groups Filter" },
  { key: "Include Groups & Videos", label: "Include Groups/Videos Filter" },
  { key: "TRAKE", label: "TRAKE Sequence Search"} // Renamed for clarity
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
  const [mode, setMode] = useState(initialMode); // Filter mode (Default, Exclude, etc.) or TRAKE
  const [searchType, setSearchType] = useState(SEARCH_TYPES.SEMANTIC); // Search type (semantic, ocr)
  const [excludeGroups, setExcludeGroups] = useState("");
  const [includeGroups, setIncludeGroups] = useState("");
  const [includeVideos, setIncludeVideos] = useState("");
  const [topK, setTopK] = useState(100); // Default TopK increased
  const [scoreThreshold, setScoreThreshold] = useState(0.0);
  const [penaltyWeight, setPenaltyWeight] = useState(0.5);
  const [isRewriting, setIsRewriting] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null); // Ref for the hidden file input

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

    // TRAKE mode specific logic
    if (mode === "TRAKE") {
      const events = value.split('\n').map(s => s.trim()).filter(Boolean);
      if (events.length === 0) {
        window.alert("Please enter at least one event for TRAKE mode, separated by new lines.");
        return;
      }
      // Pass 'TRAKE' as searchType along with events
      onSubmit?.(events, mode, { top_k: topK, penalty_weight: Number(penaltyWeight) || 0 }, 'TRAKE'); // Added 'TRAKE' type
      return; // Exit after TRAKE submission
    }

    // Handle Semantic/OCR text search
    const query = value.trim();
    if (!query && searchType !== 'TRAKE') { // Don't require text for TRAKE
        window.alert(`Please enter text to search (${searchType}).`);
        return;
    }

    // Prepare filter options based on the selected mode
    const filterOptions =
      mode === "Exclude Groups"
        ? { exclude_groups: parseGroupIds(excludeGroups) }
        : mode === "Include Groups & Videos"
        ? {
            include_groups: parseGroupIds(includeGroups),
            include_videos: parseVideoIds(includeVideos),
          }
        : {}; // Default mode has no extra filters

    // Call the parent onSubmit function, passing the searchType
    onSubmit?.(query, mode, { ...filterOptions, top_k: topK, score_threshold: scoreThreshold }, searchType); // Pass searchType
  };

  // Handle AI Query Rewrite
  const handleRewriteClick = async () => {
    const currentQuery = value.trim();
    if (!currentQuery || isRewriting || mode === "TRAKE") { // Disable rewrite for TRAKE
      return;
    }
    setIsRewriting(true);
    try {
      const apiUrl = `${process.env.REACT_APP_API_BASE_URL || ''}/api/v1/keyframe/rewrite`; // Added fallback for env var
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
      // Call the parent onImageSearch function
      onImageSearch(file, topK);
    }
    // Reset file input to allow selecting the same file again
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
    setPenaltyWeight(Number(newPenalty.toFixed(Math.max(3, -Math.floor(Math.log10(newPenalty)))))); // Dynamic precision
  };
  const handleNumberChange = (e) => {
     let valStr = e.target.value;
     if (valStr === "" || valStr === ".") { setPenaltyWeight(valStr); return; } // Allow empty or "." temporarily
     if ((valStr.match(/\./g) || []).length > 1) return; // Prevent multiple dots
     if (!/^\d*\.?\d*$/.test(valStr)) return; // Allow only numbers and one dot

     let numVal = parseFloat(valStr);
     if (isNaN(numVal)) { setPenaltyWeight(valStr); return; } // Still typing like "0."

     if (numVal < 0) numVal = 0;
     if (numVal > PENALTY_MAX) numVal = PENALTY_MAX;

     setPenaltyWeight(valStr); // Keep string format while typing for better UX
  };
   const handleNumberBlur = (e) => { // Final validation on blur
      let finalVal = parseFloat(penaltyWeight);
       if (isNaN(finalVal) || finalVal < 0) finalVal = 0;
       if (finalVal > PENALTY_MAX) finalVal = PENALTY_MAX;
       setPenaltyWeight(finalVal);
   };
  const getSliderValue = () => {
    const penaltyNum = Number(penaltyWeight);
    if (isNaN(penaltyNum)) return SLIDER_MIN; // Handle invalid input state
    return penaltyToLogSlider(penaltyNum);
  };

  // --- RENDER ---
  return (
    <div className="w-full max-w-3xl mx-auto space-y-3 p-2"> {/* Increased max-width and added padding */}

      {/* Search Type Buttons and Upload Button */}
      <div className="flex flex-wrap items-center gap-2 mb-2"> {/* Added flex-wrap */}
        {/* Semantic Search Button */}
        <button
          onClick={() => setSearchType(SEARCH_TYPES.SEMANTIC)}
          disabled={mode === "TRAKE"} // Disable type change in TRAKE mode
          className={`px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors duration-200 shadow disabled:opacity-50 disabled:cursor-not-allowed ${
            searchType === SEARCH_TYPES.SEMANTIC && mode !== "TRAKE"
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Semantic
        </button>
        {/* OCR Search Button */}
        <button
          onClick={() => setSearchType(SEARCH_TYPES.OCR)}
          disabled={mode === "TRAKE"} // Disable type change in TRAKE mode
          className={`px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors duration-200 shadow disabled:opacity-50 disabled:cursor-not-allowed ${
            searchType === SEARCH_TYPES.OCR && mode !== "TRAKE"
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          OCR
        </button>
        {/* Upload Image Button */}
        <button
          onClick={() => fileInputRef.current?.click()} // Trigger hidden input
          disabled={mode === "TRAKE"} // Disable upload in TRAKE mode
          className="px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors duration-200 bg-green-600 text-white shadow hover:bg-green-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          title="Search by uploading an image"
        >
          <ArrowUpTrayIcon className="w-4 h-4 inline-block mr-1 sm:mr-2" />
          Upload Image
        </button>
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
        />
      </div>

      {/* Text Input Area and Action Buttons */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={
            mode === "TRAKE"
              ? "Enter events, one per line..."
              : `Enter ${searchType} search query...`
          }
          className="pl-3 pr-32 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2 shadow-sm sm:text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-600 resize-none overflow-y-auto" // Increased pr for more buttons
          style={{ minHeight: '42px', maxHeight: '150px' }} // Set min-height matching buttons
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Submit on Enter (except Shift+Enter or in TRAKE mode)
            if (e.key === "Enter" && !e.shiftKey && mode !== "TRAKE") {
              e.preventDefault();
              handleSubmit();
            }
            // Clear on Escape
            if (e.key === "Escape") {
                e.preventDefault();
                setValue("");
            }
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

          {/* Rewrite Button (Disabled in TRAKE mode) */}
          <button
            type="button" aria-label="Rewrite Query" onClick={handleRewriteClick}
            disabled={isRewriting || !value.trim() || mode === "TRAKE"}
            className={`p-1.5 rounded transition-colors ${
              isRewriting
                ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed"
            }`}
            title={mode === "TRAKE" ? "Rewrite unavailable in TRAKE mode" : "Enhance query with AI"}
          >
            <SparklesIcon className={`w-4 h-4 ${isRewriting ? 'animate-spin' : ''}`} /> {/* Spin on rewrite */}
          </button>

          {/* Filter Mode Menu */}
          <Menu as="div" className="relative">
            <MenuButton
              aria-label="Select Filter Mode"
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              title={`Current Filter: ${MODE_OPTIONS.find(m => m.key === mode)?.label || mode}`}
            >
              <FunnelIcon className="w-4 h-4" />
            </MenuButton>

            <MenuItems
              anchor="bottom end"
              className="z-20 mt-2 w-64 origin-top-right rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg focus:outline-none"
            >
              <div className="py-1">
                {MODE_OPTIONS.map((m) => (
                  <MenuItem key={m.key}>
                    {({ active }) => (
                      <button type="button"
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          active ? "bg-blue-50 dark:bg-gray-700" : ""
                        } ${mode === m.key ? "font-semibold text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-gray-100"} `}
                        onClick={(e) => {
                          setMode(m.key);
                          // Reset filters when changing mode
                          setExcludeGroups("");
                          setIncludeGroups("");
                          setIncludeVideos("");
                           // Automatically switch search type if needed
                           if (m.key === "TRAKE") setSearchType("TRAKE"); // Use a distinct type or handle in parent
                           else if (searchType === 'TRAKE') setSearchType(SEARCH_TYPES.SEMANTIC); // Revert from TRAKE
                        }}
                      >
                        {m.label}
                      </button>
                    )}
                  </MenuItem>
                ))}
              </div>
              {/* Filter Input Fields */}
              {mode === "Exclude Groups" && (
                 <div className="border-t border-gray-200 dark:border-gray-700 p-2">
                   <input className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs dark:bg-gray-700 dark:text-gray-100" placeholder="Exclude Groups (e.g. 1, 3)"
                     value={excludeGroups} onChange={(e) => setExcludeGroups(e.target.value)} />
                 </div>
              )}
              {mode === "Include Groups & Videos" && (
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
         {/* Filter Mode Display */}
         {/* <div>Mode: <span className="font-medium">{MODE_OPTIONS.find(m => m.key === mode)?.label || mode}</span></div> */}

        {/* TopK Slider (Always visible except maybe TRAKE needs different limits?) */}
        <div className="flex items-center gap-1 sm:gap-2">
          <label htmlFor="topKNum" className="whitespace-nowrap font-medium">Top K:</label>
          <input id="topKNum" type="number" min={1} max={200} value={topK}
            onChange={(e) => {
              const val = stripLeadingZeros(e.target.value);
              setTopK(val === "" ? "" : Math.max(1, Math.min(200, Number(val)))); // Clamp value
            }}
             onBlur={(e)=>{ if(e.target.value === "") setTopK(1);}} // Reset to 1 if empty on blur
            className="w-12 sm:w-14 p-0.5 text-center border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white [appearance:textfield]"
          />
          <input id="topKRange" type="range" min={1} max={200} value={topK}
            onChange={(e) => setTopK(Number(e.target.value))} className="w-20 sm:w-24 cursor-pointer" />
        </div>

        {/* Score Threshold Slider (Hidden in TRAKE mode) */}
        {mode !== "TRAKE" && (
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
                 setScoreThreshold(Math.max(0, Math.min(1, numVal))); // Clamp value
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

        {/* Penalty Weight Slider (Only for TRAKE mode) */}
        {mode === "TRAKE" && (
          <div className="flex items-center gap-1 sm:gap-2">
            <label htmlFor="penaltyNum" className="whitespace-nowrap font-medium">Penalty:</label>
            <input id="penaltyNum" type="number" min={0} max={PENALTY_MAX} step={0.001} value={penaltyWeight}
              onChange={handleNumberChange}
              onBlur={handleNumberBlur} // Use blur for final validation
              className="w-12 sm:w-14 p-0.5 text-center border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white [appearance:textfield]"
            />
            <input id="penaltyRange" type="range" min={SLIDER_MIN} max={SLIDER_MAX} step={1}
              value={getSliderValue()} // Use calculated slider value
              onChange={handleSliderChange} // Use custom handler
              className="w-20 sm:w-24 cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
}
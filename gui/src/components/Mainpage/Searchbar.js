import React, { useEffect, useRef, useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  SparklesIcon, // <-- NEW: Import icon for rewrite button
} from "@heroicons/react/24/outline";

const MODE_OPTIONS = [
  { key: "Default", label: "Default" },
  { key: "Exclude Groups", label: "Exclude Groups" },
  { key: "Include Groups & Videos", label: "Include Groups & Videos" },
  { key: "TRAKE", label: "TRAKE"}
];

// --- Constants and helpers for Log Slider (keep as is) ---
const SLIDER_MIN = 0;
const SLIDER_MAX = 100;
const PENALTY_MIN_LOG_VALUE = 0.001;
const PENALTY_MAX = 5.0;
const LOG_MIN = Math.log10(PENALTY_MIN_LOG_VALUE);
const LOG_MAX = Math.log10(PENALTY_MAX);
const LOG_SCALE = (LOG_MAX - LOG_MIN) / (SLIDER_MAX - 1.0);

const sliderToLogPenalty = (sliderValue) => {
  const logVal = LOG_MIN + ((sliderValue - 1) * LOG_SCALE);
  return Math.pow(10, logVal);
};

const penaltyToLogSlider = (penalty) => {
  if (penalty < PENALTY_MIN_LOG_VALUE) return 1;
  const logVal = Math.log10(penalty);
  const sliderVal = 1.0 + (logVal - LOG_MIN) / LOG_SCALE;
  return sliderVal;
};
// --- End Log Slider Helpers ---

export default function SearchBarIconMode({ onSubmit, initialMode = "Default" }) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState(initialMode);
  const [excludeGroups, setExcludeGroups] = useState("");
  const [includeGroups, setIncludeGroups] = useState("");
  const [includeVideos, setIncludeVideos] = useState("");
  const [topK, setTopK] = useState(40);
  const [scoreThreshold, setScoreThreshold] = useState(0.0);
  const [penaltyWeight, setPenaltyWeight] = useState(0.5);

  const [isRewriting, setIsRewriting] = useState(false); // <-- NEW: Loading state for rewrite

  const textareaRef = useRef(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  }, [value]);

  const parseGroupIds = (str) => str.split(",").map(s => s.trim()).filter(Boolean);
  const parseVideoIds = (str) => str.split(",").map(s => s.trim()).filter(Boolean).map(Number);

  const handleSubmit = () => {
    // Prevent search if currently rewriting
    if (isRewriting) return;

    if (mode === "TRAKE") {
      const events = value.split('\n').map(s => s.trim()).filter(Boolean);
      if (events.length === 0) {
        window.alert("Please enter at least one event for TRAKE mode, separated by new lines.");
        return;
      }
      onSubmit?.(events, mode, {
        top_k: topK,
        penalty_weight: Number(penaltyWeight) || 0,
      });
    } else {
      // Don't pass rewrite=true here, because the rewrite button handles it separately
      const extras =
        mode === "Exclude Groups"
          ? { exclude_groups: parseGroupIds(excludeGroups) }
          : mode === "Include Groups & Videos"
          ? {
              include_groups: parseGroupIds(includeGroups),
              include_videos: parseVideoIds(includeVideos),
            }
          : {};
      onSubmit?.(value, mode, { ...extras, top_k: topK, score_threshold: scoreThreshold });
    }
  };

  // --- ✨ NEW: Function to handle rewrite button click ---
  const handleRewriteClick = async () => {
    const currentQuery = value.trim();
    if (!currentQuery || isRewriting) {
      return; // Do nothing if input is empty or already rewriting
    }

    setIsRewriting(true);
    try {
      // --- IMPORTANT ---
      // This assumes you have a backend endpoint like POST /api/v1/rewrite
      // Request body: { "query": "your text" }
      // Response body: { "rewritten_query": "ai generated text" }
      // You NEED to add this endpoint to your backend (e.g., in keyframe_api.py)
      // for this button to work.
      const apiUrl = `${process.env.REACT_APP_API_BASE_URL}/api/v1/keyframe/rewrite`;
      const response = await fetch(apiUrl, { // Adjust URL if needed
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: currentQuery }),
      });

      if (!response.ok) {
        throw new Error(`Rewrite failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (data && data.rewritten_query) {
        setValue(data.rewritten_query); // Update textarea with rewritten text
      } else {
        console.warn("Rewrite response did not contain rewritten_query:", data);
        alert("Rewrite successful, but response format was unexpected.");
      }

    } catch (error) {
      console.error("Error during query rewrite:", error);
      alert(`Failed to rewrite query: ${error.message}`);
    } finally {
      setIsRewriting(false);
    }
  };
  // --- End Rewrite Handler ---


  const stripLeadingZeros = (val) => {
    if (val === "") return val;
    return val.replace(/^0+(\d)/, "$1");
  };

  const handleSliderChange = (e) => {
    const sliderVal = Number(e.target.value);
    if (sliderVal === SLIDER_MIN) {
      setPenaltyWeight(0.0);
    } else {
      const newPenalty = sliderToLogPenalty(sliderVal);
      setPenaltyWeight(Number(newPenalty.toFixed(3)));
    }
  };

  const handleNumberChange = (e) => {
     let valStr = e.target.value;
     if (valStr === "") {
       setPenaltyWeight("");
       return;
     }
     if (valStr.endsWith(".") || valStr === "0.") {
       setPenaltyWeight(valStr);
       return;
     }
     let numVal = Number(valStr);
     if (numVal < 0) numVal = 0;
     if (numVal > PENALTY_MAX) numVal = PENALTY_MAX;
     setPenaltyWeight(numVal);
  };

  const getSliderValue = () => {
    const penaltyNum = Number(penaltyWeight);
    if (penaltyNum === 0) return SLIDER_MIN;
    if (penaltyNum < PENALTY_MIN_LOG_VALUE) return 1;
    if (penaltyNum > PENALTY_MAX) return SLIDER_MAX;
    return penaltyToLogSlider(penaltyNum);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={
            mode === "TRAKE"
              ? "Nhập các sự kiện, mỗi sự kiện 1 dòng..."
              : "Nhập nội dung tìm kiếm..."
          }
          className="pl-3 pr-28 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2 shadow-sm sm:text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-600 resize-none overflow-y-auto" // Increased pr-*
          style={{ minHeight: 40, maxHeight: 150 }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && mode !== "TRAKE") {
              e.preventDefault();
              handleSubmit();
            }
            if (e.key === "Escape") setValue("");
          }}
        />

        {/* Icons bên phải */}
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => setValue("")}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}

          {/* ---  Rewrite Button --- */}
          <button
            type="button"
            aria-label="Rewrite Query"
            onClick={handleRewriteClick}
            disabled={isRewriting || !value.trim()}
            className={`p-1.5 rounded ${
              isRewriting
                ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
            }`}
            title="Enhance query with AI"
          >
            <SparklesIcon className={`w-4 h-4 ${isRewriting ? 'animate-pulse' : ''}`} />
          </button>
          {/* --- End Rewrite Button --- */}


          <Menu as="div" className="relative">
            {/* ... (MenuButton and MenuItems remain unchanged) ... */}
            <MenuButton
              aria-label="Chọn chế độ search"
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              title={`Mode: ${mode}`}
            >
              <FunnelIcon className="w-4 h-4" />
            </MenuButton>

            <MenuItems
              anchor="bottom end"
              className="z-20 mt-2 w-64 origin-top-right rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg focus:outline-none"
            >
              {/* ... (Existing MenuItems code remains unchanged) ... */}
              <div className="py-1">
                {MODE_OPTIONS.map((m) => (
                  <MenuItem key={m.key}>
                    {({ active }) => (
                      <button
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          active
                            ? "bg-blue-50 dark:bg-gray-700"
                            : "bg-transparent"
                        } ${mode === m.key ? "font-semibold" : ""}
                        text-gray-800 dark:text-gray-100`}
                        onClick={(e) => {
                          setMode(m.key);
                          setExcludeGroups("");
                          setIncludeGroups("");
                          setIncludeVideos("");
                          if (m.key !== "Default") {
                            e.preventDefault();
                          }
                        }}
                      >
                        {m.label}
                      </button>
                    )}
                  </MenuItem>
                ))}
              </div>

              {mode === "Exclude Groups" && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-3">
                  <label className="block text-xs mb-1 text-gray-600 dark:text-gray-300">
                    Group IDs to exclude
                  </label>
                  <input
                    className="w-full rounded border px-2 py-1 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                    placeholder="e.g., 1, 3, 7"
                    value={excludeGroups}
                    onChange={(e) => setExcludeGroups(e.target.value)}
                  />
                </div>
              )}

              {mode === "Include Groups & Videos" && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-2">
                  <div>
                    <label className="block text-xs mb-1 text-gray-600 dark:text-gray-300">
                      Group IDs to include
                    </label>
                    <input
                      className="w-full rounded border px-2 py-1 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                      placeholder="e.g., 2, 4, 6"
                      value={includeGroups}
                      onChange={(e) => setIncludeGroups(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1 text-gray-600 dark:text-gray-300">
                      Video IDs to include
                    </label>
                    <input
                      className="w-full rounded border px-2 py-1 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                      placeholder="e.g., 101, 102, 203"
                      value={includeVideos}
                      onChange={(e) => setIncludeVideos(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </MenuItems>
          </Menu>

          <button
            type="button"
            aria-label="Search"
            onClick={handleSubmit}
            disabled={isRewriting} // Disable search while rewriting
            className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400"
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ... (Rest of the component displaying sliders remains unchanged) ... */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <div>
          Mode: <span className="font-medium">{mode}</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="whitespace-nowrap">📊 TopK:</label>
          <input
            type="number"
            min={1}
            max={200}
            value={topK}
            onChange={(e) => {
              const val = stripLeadingZeros(e.target.value);
              setTopK(val === "" ? "" : Number(val));
            }}
            className="w-14 p-0.5 text-center border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white [appearance:textfield]"
          />
          <input
            type="range"
            min={1}
            max={200}
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="w-24"
          />
        </div>

        {mode !== "TRAKE" && (
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap">🎯 Score:</label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={scoreThreshold}
              onChange={(e) => {
                let val = stripLeadingZeros(e.target.value);
                if (val.startsWith(".")) val = "0" + val;
                setScoreThreshold(val === "" ? "" : Number(val));
              }}
              className="w-14 p-0.5 text-center border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white [appearance:textfield]"
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={scoreThreshold}
              onChange={(e) => setScoreThreshold(Number(e.target.value))}
              className="w-24"
            />
          </div>
        )}

        {mode === "TRAKE" && (
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap">⚖️ Penalty:</label>
            <input
              type="number"
              min={0}
              max={PENALTY_MAX}
              step={0.001}
              value={penaltyWeight}
              onChange={handleNumberChange}
              onBlur={() => {
                if (penaltyWeight === "") setPenaltyWeight(0);
                setPenaltyWeight(Number(penaltyWeight) || 0);
              }}
              className="w-14 p-0.5 text-center border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white [appearance:textfield]"
            />
            <input
              type="range"
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={1}
              value={getSliderValue()}
              onChange={handleSliderChange}
              className="w-24"
            />
          </div>
        )}
      </div>
    </div>
  );
}
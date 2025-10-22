import React, { useEffect, useRef, useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const MODE_OPTIONS = [
  { key: "Default", label: "Default" },
  { key: "Exclude Groups", label: "Exclude Groups" },
  { key: "Include Groups & Videos", label: "Include Groups & Videos" },
  { key: "TRAKE", label: "TRAKE"}
];

// --- 🔹 CÁC HÀM VÀ HẰNG SỐ CHO LOG SLIDER ---
const SLIDER_MIN = 0;
const SLIDER_MAX = 100;
const PENALTY_MIN_LOG_VALUE = 0.001; // Giá trị nhỏ nhất (lớn hơn 0)
const PENALTY_MAX = 5.0;

// Tính toán các hằng số cho thang đo loga
const LOG_MIN = Math.log10(PENALTY_MIN_LOG_VALUE); // -3
const LOG_MAX = Math.log10(PENALTY_MAX);     // ~0.699
// Chúng ta map 99 bước (từ 1-100)
const LOG_SCALE = (LOG_MAX - LOG_MIN) / (SLIDER_MAX - 1.0); // (~3.699 / 99)

/**
 * Chuyển giá trị thanh trượt (1-100) sang giá trị penalty (0.001 - 5.0)
 */
const sliderToLogPenalty = (sliderValue) => {
  const logVal = LOG_MIN + ((sliderValue - 1) * LOG_SCALE);
  return Math.pow(10, logVal);
};

/**
 * Chuyển giá trị penalty (0.001 - 5.0) sang giá trị thanh trượt (1-100)
 */
const penaltyToLogSlider = (penalty) => {
  if (penalty < PENALTY_MIN_LOG_VALUE) return 1;
  const logVal = Math.log10(penalty);
  const sliderVal = 1.0 + (logVal - LOG_MIN) / LOG_SCALE;
  return sliderVal;
};
// ---------------------------------------------


export default function SearchBarIconMode({ onSubmit, initialMode = "Default" }) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState(initialMode);

  const [excludeGroups, setExcludeGroups] = useState("");
  const [includeGroups, setIncludeGroups] = useState("");
  const [includeVideos, setIncludeVideos] = useState("");

  const [topK, setTopK] = useState(40);
  const [scoreThreshold, setScoreThreshold] = useState(0.0);
  const [penaltyWeight, setPenaltyWeight] = useState(0.5);


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
    if (mode === "TRAKE") {
      const events = value.split('\n').map(s => s.trim()).filter(Boolean);
      if (events.length === 0) {
        window.alert("Please enter at least one event for TRAKE mode, separated by new lines.");
        return;
      }
      onSubmit?.(events, mode, {
        top_k: topK,
        // Đảm bảo penaltyWeight là số
        penalty_weight: Number(penaltyWeight) || 0,
      });
    } else {
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


  const stripLeadingZeros = (val) => {
    if (val === "") return val;
    return val.replace(/^0+(\d)/, "$1");
  };

  // --- 🔹 HÀM CẬP NHẬT SLIDER MỚI ---
  /**
   * Được gọi khi thanh trượt (range input) thay đổi.
   * Cập nhật penaltyWeight state.
   */
  const handleSliderChange = (e) => {
    const sliderVal = Number(e.target.value);
    if (sliderVal === SLIDER_MIN) {
      setPenaltyWeight(0.0);
    } else {
      const newPenalty = sliderToLogPenalty(sliderVal);
      // Làm tròn để hiển thị đẹp hơn trong ô số
      setPenaltyWeight(Number(newPenalty.toFixed(3)));
    }
  };
  
  /**
   * Được gọi khi ô số (number input) thay đổi.
   * Cập nhật penaltyWeight state.
   */
  const handleNumberChange = (e) => {
     let valStr = e.target.value;
     if (valStr === "") {
       setPenaltyWeight("");
       return;
     }
     
     // Cho phép nhập "0."
     if (valStr.endsWith(".") || valStr === "0.") {
       setPenaltyWeight(valStr);
       return;
     }

     let numVal = Number(valStr);
     if (numVal < 0) numVal = 0;
     if (numVal > PENALTY_MAX) numVal = PENALTY_MAX;
     
     setPenaltyWeight(numVal);
  };
  
  /**
   * Tính toán giá trị của thanh trượt (0-100) dựa trên penaltyWeight
   */
  const getSliderValue = () => {
    const penaltyNum = Number(penaltyWeight);
    if (penaltyNum === 0) return SLIDER_MIN;
    if (penaltyNum < PENALTY_MIN_LOG_VALUE) return 1; // Snap về 1
    if (penaltyNum > PENALTY_MAX) return SLIDER_MAX;
    
    return penaltyToLogSlider(penaltyNum);
  };
  // --------------------------------------

  return (
    <div className="w-full max-w-2xl mx-auto space-y-2">
      <div className="relative">
        {/* ... (textarea và các icon giữ nguyên) ... */}
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={
            mode === "TRAKE"
              ? "Nhập các sự kiện, mỗi sự kiện 1 dòng..."
              : "Nhập nội dung tìm kiếm..."
          }
          className="pl-3 pr-20 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2 shadow-sm sm:text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-600 resize-none overflow-y-auto"
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

          <Menu as="div" className="relative">
            {/* ... (MenuButton và MenuItems giữ nguyên) ... */}
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
            className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white"
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
          </button>
        </div>
      </div>


      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <div>
          Mode: <span className="font-medium">{mode}</span>
        </div>

        {/* TopK (giữ nguyên) */}
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

        {/* Threshold (giữ nguyên) */}
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

        {/* --- 🔹 SỬA ĐỔI PHẦN PENALTY WEIGHT --- */}
        {mode === "TRAKE" && (
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap">⚖️ Penalty:</label>
            {/* Ô nhập số */}
            <input
              type="number"
              min={0}
              max={PENALTY_MAX}
              step={0.001} // Cho phép nhập số lẻ nhỏ
              value={penaltyWeight}
              onChange={handleNumberChange}
              onBlur={() => {
                // Khi bỏ focus, đảm bảo nó là một số hợp lệ
                if (penaltyWeight === "") setPenaltyWeight(0);
                setPenaltyWeight(Number(penaltyWeight) || 0);
              }}
              className="w-14 p-0.5 text-center border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white [appearance:textfield]"
            />
            {/* Thanh trượt (slider) */}
            <input
              type="range"
              min={SLIDER_MIN} // 0
              max={SLIDER_MAX} // 100
              step={1} // Tăng từng 1
              value={getSliderValue()} // Tính toán vị trí slider
              onChange={handleSliderChange} // Dùng hàm custom
              className="w-24"
            />
          </div>
        )}
      </div>
    </div>
  );
}
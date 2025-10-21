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

export default function SearchBarIconMode({ onSubmit, initialMode = "Default" }) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState(initialMode);

  const [excludeGroups, setExcludeGroups] = useState("");
  const [includeGroups, setIncludeGroups] = useState("");
  const [includeVideos, setIncludeVideos] = useState("");

  const [topK, setTopK] = useState(40);
  const [scoreThreshold, setScoreThreshold] = useState(0.0);


  const textareaRef = useRef(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  }, [value]);

// Giữ nguyên chuỗi cho groups (cho phép chữ số và dấu như 25_a1)
// Cắt bỏ khoảng trắng và bỏ rỗng
  const parseGroupIds = (str) => str.split(",").map(s => s.trim()).filter(Boolean);

  // Videos vẫn parse số nguyên
  const parseVideoIds = (str) => str.split(",").map(s => s.trim()).filter(Boolean).map(Number);


  const handleSubmit = () => {
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
  };


  const stripLeadingZeros = (val) => {
    if (val === "") return val;
    // Giữ "0" nếu muốn nhập 0 threshold, còn lại thì bỏ 0 ở đầu
    return val.replace(/^0+(\d)/, "$1");
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Nhập nội dung tìm kiếm..."
          className="pl-3 pr-20 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2 shadow-sm sm:text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-600 resize-none overflow-y-auto"
          style={{ minHeight: 40, maxHeight: 150 }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
            if (e.key === "Escape") setValue("");
          }}
        />

        {/* Icon bên phải */}
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {/* Xóa nhanh textarea */}
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

          {/* Mode selector */}
          <Menu as="div" className="relative">
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
              {/* Danh sách mode */}
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

              {/* Input phụ cho Exclude Groups */}
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

              {/* Input phụ cho Include Groups & Videos */}
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

          {/* Nút search */}
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

        {/* TopK */}
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

        {/* Threshold */}
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
              // threshold cho phép 0.x thì không xóa số 0 trước dấu .
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
      </div>



    </div>
  );
}

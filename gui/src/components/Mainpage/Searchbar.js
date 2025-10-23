import React, { useEffect, useRef, useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";

const MODE_OPTIONS = [
  { key: "Default", label: "Default" },
  { key: "Exclude Groups", label: "Exclude Groups" },
  { key: "Include Groups & Videos", label: "Include Groups & Videos" },
];

export default function SearchBar({ onSubmit, onImageSearch, initialMode = "Default" }) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState(initialMode);
  const [searchType, setSearchType] = useState("semantic"); 

  const [excludeGroups, setExcludeGroups] = useState("");
  const [includeGroups, setIncludeGroups] = useState("");
  const [includeVideos, setIncludeVideos] = useState("");
  const [topK, setTopK] = useState(40);
  const [scoreThreshold, setScoreThreshold] = useState(0.0);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  }, [value]);

  const parseGroupIds = (str) => str.split(",").map(s => s.trim()).filter(Boolean);
  const parseVideoIds = (str) => str.split(",").map(s => s.trim()).filter(Boolean).map(Number).filter(id => !isNaN(id));

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
    onSubmit?.(value, mode, { ...extras, top_k: topK, score_threshold: scoreThreshold }, searchType);
  };
  
  const stripLeadingZeros = (val) => {
    if (val === "") return val;
    return val.replace(/^0+(\d)/, "$1");
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && onImageSearch) {
      onImageSearch(file, topK);
    }
    event.target.value = null; 
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-2">
      <div className="flex items-center space-x-3">
        <div className="flex space-x-2 flex-shrink-0">
          <button
            onClick={() => setSearchType("semantic")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              searchType === "semantic" 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Semantic Search
          </button>
          <button
            onClick={() => setSearchType("ocr")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              searchType === "ocr" 
                ? 'bg-purple-600 text-white shadow-md' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            OCR Search
          </button>

          {/* >>> VỊ TRÍ 1: NÚT UPLOAD MỚI <<< */}
          <button
            onClick={() => fileInputRef.current.click()} // Kích hoạt input ẩn
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 bg-green-600 text-white shadow-md hover:bg-green-700 flex items-center"
          >
            <ArrowUpTrayIcon className="w-5 h-5 inline-block mr-2" />
            Upload Image
          </button>
          
          {/* >>> VỊ TRÍ 2: INPUT FILE ẨN <<< */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png, image/jpeg, image/webp" // Giới hạn loại file
            className="hidden"
          />
        </div>
      </div>
      
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Enter search query..."
          className="pl-3 pr-20 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2 shadow-sm sm:text-sm resize-none"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
          }}
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {value && (
            <button type="button" onClick={() => setValue("")}>
              <XMarkIcon className="w-4 h-4 text-gray-500" />
            </button>
          )}
          <Menu as="div" className="relative">
            <MenuButton className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title={`Mode: ${mode}`}>
              <FunnelIcon className="w-4 h-4" />
            </MenuButton>
            <MenuItems anchor="bottom end" className="z-20 mt-2 w-64 origin-top-right rounded-md border bg-white dark:bg-gray-800 shadow-lg">
              <div className="py-1">
                {MODE_OPTIONS.map((m) => (
                  <MenuItem key={m.key}>
                    {({ active }) => (
                      <button type="button"
                        className={`w-full text-left px-3 py-2 text-sm ${active ? "bg-blue-50 dark:bg-gray-700" : ""} ${mode === m.key ? "font-semibold" : ""}`}
                        onClick={(e) => {
                          setMode(m.key);
                          setExcludeGroups("");
                          setIncludeGroups("");
                          setIncludeVideos("");
                          if (m.key !== "Default") { e.preventDefault(); }
                        }}>
                        {m.label}
                      </button>
                    )}
                  </MenuItem>
                ))}
              </div>
              {mode === "Exclude Groups" && (
                <div className="border-t p-3">
                  <input className="w-full rounded border px-2 py-1 text-sm" placeholder="Groups to exclude: 1, 3"
                    value={excludeGroups} onChange={(e) => setExcludeGroups(e.target.value)} />
                </div>
              )}
              {mode === "Include Groups & Videos" && (
                <div className="border-t p-3 space-y-2">
                  <input className="w-full rounded border px-2 py-1 text-sm" placeholder="Groups to include: 2, 4"
                    value={includeGroups} onChange={(e) => setIncludeGroups(e.target.value)} />
                  <input className="w-full rounded border px-2 py-1 text-sm" placeholder="Videos to include: 101, 102"
                    value={includeVideos} onChange={(e) => setIncludeVideos(e.target.value)} />
                </div>
              )}
            </MenuItems>
          </Menu>
          <button type="button" onClick={handleSubmit} className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white">
            <MagnifyingGlassIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
        <div>Mode: <span className="font-medium">{mode}</span></div>
        <div className="flex items-center gap-2">
          <label className="whitespace-nowrap">📊 TopK:</label>
          <input type="number" min={1} max={200} value={topK}
            onChange={(e) => {
              const val = stripLeadingZeros(e.target.value);
              setTopK(val === "" ? "" : Number(val));
            }}
            className="w-14 p-0.5 text-center border rounded"/>
          <input type="range" min={1} max={200} value={topK}
            onChange={(e) => setTopK(Number(e.target.value))} className="w-24" />
        </div>
        <div className="flex items-center gap-2">
          <label className="whitespace-nowrap">🎯 Score:</label>
          <input type="number" min={0} max={1} step={0.1} value={scoreThreshold}
            onChange={(e) => {
              let val = stripLeadingZeros(e.target.value);
              if (val.startsWith(".")) val = "0" + val;
              setScoreThreshold(val === "" ? "" : Number(val));
            }}
            className="w-14 p-0.5 text-center border rounded"/>
          <input type="range" min={0} max={1} step={0.1} value={scoreThreshold}
            onChange={(e) => setScoreThreshold(Number(e.target.value))} className="w-24" />
        </div>
      </div>
    </div>
  );
}
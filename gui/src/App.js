import React, { useState } from "react"; // Import React
import { ThemeProvider } from "./context/ThemeContext";
import ThemeToggle from "./components/Mainpage/ToggleDarkLight";
import Sidebar from "./components/Sidebar/Sidebar";
import SearchBar from "./components/Mainpage/Searchbar"; // Ensure correct path
import ResultsGrid from "./components/Mainpage/ResultsGrid"; // Ensure correct path

function App() {
  const [isExpanded, setIsExpanded] = useState(true);
  const mainMarginLeft = isExpanded ? "" : "ml-14";

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // Use environment variable, fallback to localhost:8000
  const apiUrl = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

  const [lastSearchMode, setLastSearchMode] = useState("Default"); // Store mode for ResultsGrid

  // --- 👇 UPDATED handleSearch signature and logic 👇 ---
  const handleSearch = async (queryOrEvents, mode, extras, searchType) => { // Added searchType
    // Basic validation
    if (mode !== "TRAKE" && typeof queryOrEvents === 'string' && !queryOrEvents.trim()) {
      alert("Please enter a search query.");
      return;
    }
    if (mode !== "TRAKE" && typeof queryOrEvents === 'string' && queryOrEvents.length > 1000) {
      alert("Query is too long (max 1000 characters).");
      return;
    }

    console.log("Starting search:", { queryOrEvents, mode, extras, searchType });
    setLoading(true);
    setResults([]);
    setErrorMsg("");
    setLastSearchMode(mode);

    let endpoint = "";
    let payload = {};

    try {
      // Determine endpoint based on searchType and mode
      if (mode === "TRAKE") {
        endpoint = `${apiUrl}/api/v1/video/rank-by-events`;
        payload = {
          events: queryOrEvents, // Array of strings
          top_k: extras.top_k ?? 100,
          penalty_weight: extras.penalty_weight ?? 0.5,
        };
      } else {
        // Base path depends on search type
        let basePath = "/api/v1/keyframe";
        if (searchType === 'ocr') {
            basePath += "/search/ocr";
        } else { // Default to semantic
            basePath += "/search";
        }

        // Append filter path
        if (mode === "Exclude Groups") {
            endpoint = `${basePath}/exclude-groups`;
            payload = {
                query: queryOrEvents, // String
                top_k: extras.top_k ?? 100,
                score_threshold: extras.score_threshold ?? 0.0,
                exclude_groups: extras.exclude_groups || [],
            };
        } else if (mode === "Include Groups & Videos") {
            endpoint = `${basePath}/selected-groups-videos`;
             payload = {
                query: queryOrEvents, // String
                top_k: extras.top_k ?? 100,
                score_threshold: extras.score_threshold ?? 0.0,
                include_groups: extras.include_groups || [],
                include_videos: extras.include_videos || [],
            };
        } else { // Default mode
            endpoint = basePath;
             payload = {
                query: queryOrEvents, // String
                top_k: extras.top_k ?? 100,
                score_threshold: extras.score_threshold ?? 0.0,
            };
        }
      }

      console.log("Calling API:", endpoint, "Payload:", JSON.stringify(payload));

      // --- SỬA LỖI 404 Ở ĐÂY ---
      // Đảm bảo URL cuối cùng luôn bao gồm 'apiUrl',
      // trừ trường hợp TRAKE đã tự thêm vào (ở dòng 48)
      const finalEndpoint = mode === "TRAKE" ? endpoint : `${apiUrl}${endpoint}`;

      const res = await fetch(finalEndpoint, { // <<< Sử dụng finalEndpoint
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // --- KẾT THÚC SỬA LỖI ---

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error (${res.status}): ${errorText || res.statusText}`);
      }

      const data = await res.json();
      console.log("API Response Data:", data);
      setResults(data.results || []);

    } catch (e) {
      console.error("Search failed:", e);
      setErrorMsg(`Search failed: ${e.message}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };
  // --- END UPDATED handleSearch ---


  // Handler for finding similar images from a keyframe key
  const handleSimilaritySearch = async (key, top_k = 100) => {
    if (key === undefined || key === null) {
        setErrorMsg("Cannot perform similarity search: Keyframe key is missing.");
        return;
    }
    console.log(`Finding images similar to key: ${key} with top_k: ${top_k}`);
    setLoading(true);
    setErrorMsg("");
    setResults([]);
    setLastSearchMode("Default"); // Similarity results use default grid view

    const endpoint = `${apiUrl}/api/v1/keyframe/search/similar/${key}?top_k=${top_k}`;

    try {
      console.log("Calling API:", endpoint);
      const res = await fetch(endpoint, { method: "GET" });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error (${res.status}): ${errorText || res.statusText}`);
      }
      const data = await res.json();
      console.log("API Response Data:", data);
      setResults(data.results || []);

    } catch (e) {
      console.error("Similarity search failed:", e);
      setErrorMsg(`Similarity search failed: ${e.message}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Handler for searching by uploaded image
  const handleImageSearch = async (imageFile, top_k = 100) => {
    console.log(`Searching by uploaded image: ${imageFile?.name}, top_k: ${top_k}`);
    setLoading(true);
    setErrorMsg("");
    setResults([]);
    setLastSearchMode("Default"); // Upload results use default grid view

    const endpoint = `${apiUrl}/api/v1/keyframe/search/similar/upload`;
    const formData = new FormData();
    formData.append("file", imageFile);
    formData.append("top_k", top_k);

    try {
      console.log("Calling API:", endpoint);
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error (${res.status}): ${errorText || res.statusText}`);
      }
      const data = await res.json();
      console.log("API Response Data:", data);
      setResults(data.results || []);

    } catch (e) {
      console.error("Image upload search failed:", e);
      setErrorMsg(`Image upload search failed: ${e.message}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // --- JSX Structure (Giữ nguyên cấu trúc gốc của bạn) ---
  return (
    <ThemeProvider>
      <div className="flex h-screen bg-indigo-50 dark:bg-gray-900">
        <Sidebar isExpanded={isExpanded} setIsExpanded={setIsExpanded} />

        <div
          className={`flex-1 p-4 relative text-black dark:text-white ${mainMarginLeft} flex flex-col`}
        >
          {/* ThemeToggle ở vị trí cũ */}
          <div className="absolute bottom-4 right-4 z-20">
            <ThemeToggle />
          </div>

          {/* Nội dung chính */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="text-center font-semibold dark:text-white">
                🔍 Searching...
              </div>
            )}
            {errorMsg && (
              <div className="text-red-600 font-semibold mt-2 text-center">
                Error: {errorMsg} {/* Display error message */}
              </div>
            )}

            {/* Results Grid */}
            {results.length > 0 && !loading && (
              <div className="mt-4">
                <ResultsGrid
                  results={results}
                  onSimilaritySearch={handleSimilaritySearch} // Pass correct handler
                  mode={lastSearchMode} // Pass correct mode
                />
              </div>
            )}

            {/* Placeholder */}
            {!results.length && !loading && !errorMsg && (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">
                  Enter a query to begin searching.
                </p>
              </div>
            )}
          </div>

          {/* Thanh search ở dưới */}
          <div className="mt-auto pb-1">
             {/* Truyền các props cần thiết vào SearchBar */}
            <SearchBar
                onSubmit={handleSearch}
                onImageSearch={handleImageSearch}
                initialMode="Default"
             />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
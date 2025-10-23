import { useState } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import ThemeToggle from "./components/Mainpage/ToggleDarkLight";
import Sidebar from "./components/Sidebar/Sidebar";
import SearchBar from "./components/Mainpage/Searchbar";
// <<< THAY ĐỔI 1: Xóa import ResultsMetrics không còn sử dụng >>>
// import ResultsMetrics from "./components/Mainpage/ResultsMetrics";
import ResultsGrid from "./components/Mainpage/ResultsGrid";

function App() {
  const [isExpanded, setIsExpanded] = useState(true);
  const mainMarginLeft = isExpanded ? "" : "ml-14";

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const apiUrl = "http://localhost:8000";


  // 🔹 THÊM MỚI: Lưu lại mode của lần search cuối
  const [lastSearchMode, setLastSearchMode] = useState("Default");

  const parseIds = (str) =>
    str.split(",").map((s) => s.trim()).filter(Boolean).map(Number);

  // 🔹 SỬA ĐỔI: 'query' giờ có thể là string (query) hoặc string[] (events)
  const handleSearch = async (queryOrEvents, mode, extras) => {
    
    // 🔹 SỬA ĐỔI: Validate cho TRAKE
    if (mode !== "TRAKE" && typeof queryOrEvents === 'string' && !queryOrEvents.trim()) {
      window.alert("Please enter a search query");
      return;
    }
    if (mode !== "TRAKE" && typeof queryOrEvents === 'string' && queryOrEvents.length > 1000) {
      window.alert("Query too long. Please keep it under 1000 characters.");
      return;
    }
    // (Validation cho TRAKE đã được xử lý trong Searchbar.js)

    setLoading(true);
    setResults([]);
    setErrorMsg("");

    const baseEndpoint =
      searchType === "ocr"
        ? `${apiUrl}/api/v1/keyframe/search/ocr`
        : `${apiUrl}/api/v1/keyframe/search`;

    let endpoint = "";
    let payload = {};

    // 🔹 SỬA ĐỔI: Thêm logic cho TRAKE
    if (mode === "TRAKE") {
      endpoint = `${apiUrl}/api/v1/video/rank-by-events`;
      payload = {
        events: queryOrEvents, // Đây là một mảng string
        top_k: extras.top_k ?? 10,
        penalty_weight: extras.penalty_weight ?? 0.5
      };
    } else if (mode === "Default") {
      endpoint = `${apiUrl}/api/v1/keyframe/search`;
      payload = {
        query: queryOrEvents, // Đây là một string
        top_k: extras.top_k ?? 10,
        score_threshold: extras.score_threshold ?? 0.0,
      };
    } else if (mode === "Exclude Groups") {
      endpoint = `${apiUrl}/api/v1/keyframe/search/exclude-groups`;
      payload = {
        query: queryOrEvents,
        top_k: extras.top_k ?? 10,
        score_threshold: extras.score_threshold ?? 0.0,
        exclude_groups: extras.exclude_groups || [],
      };
    } else if (mode === "Include Groups & Videos") {
      endpoint = `${apiUrl}/api/v1/keyframe/search/selected-groups-videos`;
      payload = {
        query: queryOrEvents,
        top_k: extras.top_k ?? 10,
        score_threshold: extras.score_threshold ?? 0.0,
        include_groups: extras.include_groups || [],
        include_videos: extras.include_videos || [],
      };
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setLastSearchMode(mode); // 🔹 CẬP NHẬT: Lưu lại mode
      } else {
        window.alert(`API Error: ${res.status} - ${await res.text()}`);
      }
    } catch (e) {
      window.alert(`Connection Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleSimilaritySearch = async (key, top_k) => {
    console.log(`Finding images similar to key: ${key} with top_k: ${top_k}`);
    setLoading(true);
    setErrorMsg("");
    setResults([]);

    // SỬA LỖI 1: Xây dựng URL với query parameter
    const endpoint = `${apiUrl}/api/v1/keyframe/search/similar/${key}?top_k=${top_k}`;

    try {
      // SỬA LỖI 2: Thay đổi phương thức fetch
      const res = await fetch(endpoint, {
        method: "GET", // Đổi từ "POST" sang "GET"
        // Không cần headers và body cho request GET
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      } else {
        setErrorMsg(`API Error: ${res.status} - ${await res.text()}`);
      }
    } catch (e) {
      setErrorMsg(`Connection Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleImageSearch = async (imageFile, top_k) => {
    console.log(`Searching by uploaded image, top_k: ${top_k}`);
    setLoading(true);
    setErrorMsg("");
    setResults([]);

    const endpoint = `${apiUrl}/api/v1/keyframe/search/similar/upload`;
    
    // 1. Tạo FormData để gửi file
    const formData = new FormData();
    formData.append("file", imageFile);
    formData.append("top_k", top_k);

    try {
      // 2. Gửi request với FormData
      const res = await fetch(endpoint, {
        method: "POST",
        // QUAN TRỌNG: KHÔNG set 'Content-Type', trình duyệt sẽ tự làm
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      } else {
        setErrorMsg(`API Error: ${res.status} - ${await res.text()}`);
      }
    } catch (e) {
      setErrorMsg(`Connection Error: ${e.message}`);
    }
    setLoading(false);
  };
  const avgScore = results.length
    ? (results.reduce((a, b) => a + (b.score ?? b.dp_score ?? 0), 0) / results.length).toFixed(3)
    : "-";
  const maxScore = results.length
    ? Math.max(...results.map((r) => r.score ?? r.dp_score ?? 0)).toFixed(3)
    : "-";

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-indigo-50 dark:bg-gray-900">
        <Sidebar isExpanded={isExpanded} setIsExpanded={setIsExpanded} />

        <div
          className={`flex-1 p-4 relative text-black dark:text-white ${mainMarginLeft} flex flex-col`}
        >
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
                {errorMsg}
              </div>
            )}

            {results.length > 0 && !loading && (
              <div className="mt-4">
                <ResultsGrid
                  results={results}
                  onSimilaritySearch={handleSimilaritySearch}
                  mode={lastSearchMode}
                />
              </div>
            )}

            {!results.length && !loading && !errorMsg && (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">
                  Enter a query to begin searching.
                </p>
              </div>
            )}
          </div>

          {/* Thanh search mới ở dưới */}
          <div className="mt-auto pb-1">
            <SearchBar onSubmit={handleSearch} onImageSearch={handleImageSearch} />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
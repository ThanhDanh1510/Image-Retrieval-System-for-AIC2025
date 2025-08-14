import { useState } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import ThemeToggle from "./components/Mainpage/ToggleDarkLight";
import Sidebar from './components/Sidebar/Sidebar';

import SearchBar from "./components/Mainpage/Searchbar";
import ResultsMetrics from "./components/Mainpage/ResultsMetrics";
import ResultsGrid from "./components/Mainpage/ResultsGrid";

function App() {
  const [isExpanded, setIsExpanded] = useState(true);
  const mainMarginLeft = isExpanded ? '' : 'ml-14';

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const defaultApiUrl = "http://localhost:8000";
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);

  const parseIds = (str) =>
    str.split(",").map((s) => s.trim()).filter(Boolean).map(Number);

  const handleSearch = async (query, mode, extras) => {
    if (!query.trim()) {
      window.alert("Please enter a search query");
      return;
    }
    if (query.length > 1000) {
      window.alert("Query too long. Please keep it under 1000 characters.");
      return;
    }

    setLoading(true);

    let endpoint = "";
    let payload = {
      query,
      top_k: extras.top_k ?? 10,
      score_threshold: extras.score_threshold ?? 0.0,
    };

    if (mode === "Default") {
      endpoint = `${apiUrl}/api/v1/keyframe/search`;
    } else if (mode === "Exclude Groups") {
      endpoint = `${apiUrl}/api/v1/keyframe/search/exclude-groups`;
      payload.exclude_groups = extras.exclude_groups || [];
    } else if (mode === "Include Groups & Videos") {
      endpoint = `${apiUrl}/api/v1/keyframe/search/selected-groups-videos`;
      payload.include_groups = extras.include_groups || [];
      payload.include_videos = extras.include_videos || [];
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
      } else {
        window.alert(`API Error: ${res.status} - ${await res.text()}`);
      }
    } catch (e) {
      // ⚡ Không setErrorMsg nữa, chỉ hiện pop-up
      window.alert(`Connection Error: ${e.message}`);
    }
    setLoading(false);
  };



  const avgScore = results.length
    ? (results.reduce((a, b) => a + b.score, 0) / results.length).toFixed(3)
    : "-";
  const maxScore = results.length
    ? Math.max(...results.map((r) => r.score)).toFixed(3)
    : "-";

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-indigo-50 dark:bg-gray-900">
        <Sidebar isExpanded={isExpanded} setIsExpanded={setIsExpanded} />

        <div className={`flex-1 p-4 relative text-black dark:text-white ${mainMarginLeft} flex flex-col`}>
          <div className="absolute bottom-4 right-4 z-20">
            <ThemeToggle />
          </div>

          {/* Nội dung chính */}
          <div className="flex-1 overflow-y-auto">

            {/* {loading && <div className="text-white font-semibold">🔍 Searching...</div>} */}
            {errorMsg && <div className="text-red-600 font-semibold mt-2">{errorMsg}</div>}

            {results.length > 0 && (
              <div className="mt-4">
                <ResultsGrid results={results} />
              </div>
            )}
          </div>

          {/* Thanh search mới ở dưới */}
          <div className="mt-auto pb-1">
            <SearchBar onSubmit={handleSearch} />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;

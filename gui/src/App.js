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

  // State to determine how ResultsGrid should render (TRAKE list or Default grid)
  const [lastSearchModeForGrid, setLastSearchModeForGrid] = useState("Default");

  // Handler for text, OCR, and TRAKE searches initiated from SearchBar
  const handleSearch = async (queryOrEvents, filterMode, extras, searchType) => {
    // Basic validation
    if (searchType !== "TRAKE" && typeof queryOrEvents === 'string' && !queryOrEvents.trim()) {
      alert("Please enter a search query.");
      return;
    }
     if (searchType === "TRAKE" && Array.isArray(queryOrEvents) && queryOrEvents.length === 0) {
      alert("Please enter at least one event for DANTE (TRAKE) mode.");
      return;
    }
    if (typeof queryOrEvents === 'string' && queryOrEvents.length > 1000) {
      alert("Query is too long (max 1000 characters).");
      return;
    }


    console.log("Starting search:", { queryOrEvents, filterMode, extras, searchType });
    setLoading(true);
    setResults([]); // Clear previous results
    setErrorMsg("");
    // Set grid display mode based on the search type being performed
    setLastSearchModeForGrid(
      searchType === 'TRAKE' ? 'TRAKE' : 
      searchType === 'ASR' ? 'ASR' : 
      'Default'
    );

    let endpoint = "";
    let payload = {};

    try {
      // Determine endpoint and payload based on searchType and filterMode
      if (searchType === 'TRAKE') {
        endpoint = `${apiUrl}/api/v1/video/rank-by-events`; // TRAKE endpoint
        payload = {
          events: queryOrEvents, // Expecting array of strings
          top_k: extras.top_k ?? 100,
          penalty_weight: extras.penalty_weight ?? 0.5,
          // Include filter options if provided by SearchBar
          ...(extras.exclude_groups && { exclude_groups: extras.exclude_groups }),
          ...(extras.include_groups && { include_groups: extras.include_groups }),
          ...(extras.include_videos && { include_videos: extras.include_videos }),
        };
      } else if (searchType === 'ASR') {
      // THÊM XỬ LÝ ASR
      endpoint = `${apiUrl}/api/v1/keyframe/search/asr`;
      payload = {
        query: queryOrEvents, // String query
        top_k: extras.top_k ?? 100,
        // Include filter options nếu cần
        ...(extras.exclude_groups && { exclude_groups: extras.exclude_groups }),
        ...(extras.include_groups && { include_groups: extras.include_groups }),
        ...(extras.include_videos && { include_videos: extras.include_videos }),
      };
    } else { // Semantic or OCR
        // Determine base API path
        let basePath = `${apiUrl}/api/v1/keyframe`; // Start with apiUrl
        basePath += (searchType === 'ocr' ? "/search/ocr" : "/search");

        // Determine full endpoint based on filterMode
        if (filterMode === "Exclude Groups") {
            endpoint = `${basePath}/exclude-groups`;
        } else if (filterMode === "Include Groups & Videos") {
            endpoint = `${basePath}/selected-groups-videos`;
        } else { // Default filter mode
            endpoint = basePath;
        }

        // Construct payload for Semantic/OCR
        payload = {
          query: queryOrEvents, // Expecting string
          top_k: extras.top_k ?? 100,
          score_threshold: extras.score_threshold ?? 0.0,
          // Include filter options if provided by SearchBar
          ...(extras.exclude_groups && { exclude_groups: extras.exclude_groups }),
          ...(extras.include_groups && { include_groups: extras.include_groups }),
          ...(extras.include_videos && { include_videos: extras.include_videos }),
        };
      }

      console.log("Calling API:", endpoint, "Payload:", JSON.stringify(payload));

      const res = await fetch(endpoint, { // Use the determined endpoint
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error (${res.status}): ${errorText || res.statusText}`);
      }

      const data = await res.json();
      console.log("API Response Data:", data);
      setResults(data.results || []); // Update results state

    } catch (e) {
      console.error("Search failed:", e); // Log the full error
      setErrorMsg(`Search failed: ${e.message}`);
      setResults([]); // Clear results on error
    } finally {
      setLoading(false);
    }
  };

  // Handler for finding similar images based on a keyframe's key (from ResultsGrid modal)
  const handleSimilaritySearch = async (key, top_k = 100) => {
    if (key === undefined || key === null) {
        setErrorMsg("Cannot perform similarity search: Keyframe key is missing.");
        return;
    }
    console.log(`Finding images similar to key: ${key} with top_k: ${top_k}`);
    setLoading(true);
    setErrorMsg("");
    setResults([]);
    setLastSearchModeForGrid("Default"); // Similarity results use default grid view

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

  // Handler for searching by uploaded image (from SearchBar)
  const handleImageSearch = async (imageFile, top_k = 100) => {
    console.log(`Searching by uploaded image: ${imageFile?.name}, top_k: ${top_k}`);
    setLoading(true);
    setErrorMsg("");
    setResults([]);
    setLastSearchModeForGrid("Default"); // Upload results use default grid view

    const endpoint = `${apiUrl}/api/v1/keyframe/search/similar/upload`;
    const formData = new FormData();
    formData.append("file", imageFile);
    formData.append("top_k", top_k);

    try {
      console.log("Calling API:", endpoint);
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData, // Let browser set Content-Type for FormData
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

  // --- JSX Structure (Kept original structure) ---
  return (
    <ThemeProvider>
      <div className="flex h-screen bg-indigo-50 dark:bg-gray-900"> {/* Original background */}
        <Sidebar isExpanded={isExpanded} setIsExpanded={setIsExpanded} />

        <div
          className={`flex-1 p-4 relative text-black dark:text-white ${mainMarginLeft} flex flex-col`}
        >
          {/* ThemeToggle */}
          <div className="absolute bottom-4 right-4 z-20">
            <ThemeToggle />
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto">
            {/* Loading Indicator */}
            {loading && (
              <div className="text-center font-semibold dark:text-white pt-4"> {/* Added padding top */}
                🔍 Searching...
              </div>
            )}
            {/* Error Message */}
            {errorMsg && (
              <div className="text-red-600 font-semibold mt-2 text-center p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded"> {/* Improved styling */}
                Error: {errorMsg}
              </div>
            )}

            {/* Results Grid - Conditional Rendering */}
            {/* Show grid only if NOT loading, NO error, and results EXIST */}
            {!loading && !errorMsg && results.length > 0 && (
              <div className="mt-4">
                <ResultsGrid
                  results={results}
                  onSimilaritySearch={handleSimilaritySearch} // Pass similarity search handler
                  mode={lastSearchModeForGrid} // Pass the mode determined by the search type
                />
              </div>
            )}

            {/* Placeholder - Show if NOT loading, NO error, and NO results */}
            {!loading && !errorMsg && results.length === 0 && (
              <div className="flex items-center justify-center h-full text-center">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  Enter a query, upload an image, or click ✨ on a result to search.
                </p>
              </div>
            )}
          </div>

          {/* Search Bar at the bottom */}
          <div className="mt-auto pb-1 pt-2 border-t border-gray-200 dark:border-gray-700 bg-indigo-50 dark:bg-gray-900"> {/* Added styling */}
             {/* Pass necessary handlers to SearchBar */}
            <SearchBar
                onSubmit={handleSearch} // Handles Text, OCR, TRAKE
                onImageSearch={handleImageSearch} // Handles Image Upload
                initialMode="Default" // Initial filter mode
             />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;

import React, { useState } from 'react';

const defaultApiUrl = "http://localhost:8000";

export default function MainPage() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(10);
  const [scoreThreshold, setScoreThreshold] = useState(0.0);
  const [searchMode, setSearchMode] = useState('Default');
  const [excludeGroups, setExcludeGroups] = useState('');
  const [includeGroups, setIncludeGroups] = useState('');
  const [includeVideos, setIncludeVideos] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Helper to parse comma-separated IDs
  const parseIds = (str) => str.split(',').map(s => s.trim()).filter(Boolean).map(Number);

  // API request handler
  const handleSearch = async () => {
    setErrorMsg('');
    if (!query.trim()) {
      setErrorMsg('Please enter a search query');
      return;
    }
    if (query.length > 1000) {
      setErrorMsg('Query too long. Please keep it under 1000 characters.');
      return;
    }
    setLoading(true);
    let endpoint = '';
    let payload = {};
    if (searchMode === 'Default') {
      endpoint = `${apiUrl}/api/v1/keyframe/search`;
      payload = { query, top_k: topK, score_threshold: scoreThreshold };
    } else if (searchMode === 'Exclude Groups') {
      endpoint = `${apiUrl}/api/v1/keyframe/search/exclude-groups`;
      payload = { query, top_k: topK, score_threshold: scoreThreshold, exclude_groups: parseIds(excludeGroups) };
    } else {
      endpoint = `${apiUrl}/api/v1/keyframe/search/selected-groups-videos`;
      payload = {
        query,
        top_k: topK,
        score_threshold: scoreThreshold,
        include_groups: parseIds(includeGroups),
        include_videos: parseIds(includeVideos)
      };
    }
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

  // Metrics
  const avgScore = results.length ? (results.reduce((a, b) => a + b.score, 0) / results.length).toFixed(3) : '-';
  const maxScore = results.length ? Math.max(...results.map(r => r.score)).toFixed(3) : '-';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-400 to-purple-600 pb-8">
      {/* Header */}
      <div className="search-container bg-gradient-to-r from-indigo-500 to-purple-700 p-8 rounded-xl mb-8 text-white shadow-lg">
        <h1 className="text-4xl font-bold mb-2 flex items-center">🔍 Keyframe Search</h1>
        <p className="opacity-90 text-lg">Search through video keyframes using semantic similarity</p>
      </div>

      {/* API Config */}
      <div className="bg-white/10 p-4 rounded-lg mb-4 max-w-xl mx-auto">
        <label className="block font-semibold mb-2">API Base URL</label>
        <input
          className="w-full p-2 rounded border"
          value={apiUrl}
          onChange={e => setApiUrl(e.target.value)}
        />
      </div>

      {/* Main Search Interface */}
      <div className="flex flex-col md:flex-row gap-8 max-w-5xl mx-auto">
        {/* Left: Search Form */}
        <div className="flex-1 bg-white/80 p-6 rounded-xl shadow">
          <label className="block font-semibold mb-2">🔍 Search Query</label>
          <input
            className="w-full p-2 rounded border mb-4"
            placeholder="Enter your search query (e.g., 'person walking in the park')"
            value={query}
            onChange={e => setQuery(e.target.value)}
            maxLength={1000}
          />
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block mb-1">📊 Max Results: {topK}</label>
              <input
                type="range"
                min={1}
                max={200}
                value={topK}
                onChange={e => setTopK(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label className="block mb-1">🎯 Min Score: {scoreThreshold}</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={scoreThreshold}
                onChange={e => setScoreThreshold(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Right: Mode Selector */}
        <div className="flex-1 bg-white/80 p-6 rounded-xl shadow">
          <label className="block font-semibold mb-2">🎛️ Search Mode</label>
          <select
            className="w-full p-2 rounded border mb-4"
            value={searchMode}
            onChange={e => setSearchMode(e.target.value)}
          >
            <option>Default</option>
            <option>Exclude Groups</option>
            <option>Include Groups & Videos</option>
          </select>
          {searchMode === 'Exclude Groups' && (
            <div>
              <label className="block mb-1">🚫 Group IDs to exclude</label>
              <input
                className="w-full p-2 rounded border"
                placeholder="Enter group IDs separated by commas (e.g., 1, 3, 7)"
                value={excludeGroups}
                onChange={e => setExcludeGroups(e.target.value)}
              />
            </div>
          )}
          {searchMode === 'Include Groups & Videos' && (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block mb-1">✅ Group IDs to include</label>
                <input
                  className="w-full p-2 rounded border"
                  placeholder="e.g., 2, 4, 6"
                  value={includeGroups}
                  onChange={e => setIncludeGroups(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block mb-1">🎬 Video IDs to include</label>
                <input
                  className="w-full p-2 rounded border"
                  placeholder="e.g., 101, 102, 203"
                  value={includeVideos}
                  onChange={e => setIncludeVideos(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search Button & Error */}
      <div className="max-w-5xl mx-auto mt-8 flex flex-col items-center">
        <button
          className="bg-gradient-to-r from-indigo-500 to-purple-700 text-white px-8 py-3 rounded-full font-semibold shadow hover:scale-105 transition mb-2"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? "🔍 Searching..." : "🚀 Search"}
        </button>
        {errorMsg && <div className="text-red-600 font-semibold mt-2">{errorMsg}</div>}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="max-w-5xl mx-auto mt-12">
          <hr className="mb-8"/>
          <h2 className="text-2xl font-bold mb-6">📋 Search Results</h2>
          {/* Metrics */}
          <div className="flex gap-4 mb-8">
            <div className="metric-container bg-white/90 p-4 rounded-lg text-center flex-1">
              <div className="font-bold text-lg">Total Results</div>
              <div className="text-2xl">{results.length}</div>
            </div>
            <div className="metric-container bg-white/90 p-4 rounded-lg text-center flex-1">
              <div className="font-bold text-lg">Average Score</div>
              <div className="text-2xl">{avgScore}</div>
            </div>
            <div className="metric-container bg-white/90 p-4 rounded-lg text-center flex-1">
              <div className="font-bold text-lg">Best Score</div>
              <div className="text-2xl">{maxScore}</div>
            </div>
          </div>
          {/* Results Grid */}
          <div className="grid md:grid-cols-2 gap-8">
            {results
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((result, i) => (
                <div key={i} className="result-card bg-white p-4 rounded-lg shadow border-l-4 border-indigo-500 flex gap-4">
                  <div className="w-40 flex-shrink-0 flex items-center justify-center">
                    {result.path ? (
                      <img
                        src={result.path}
                        alt={`Keyframe ${i+1}`}
                        className="rounded-lg w-full h-auto object-cover"
                        onError={e => { e.target.onerror = null; e.target.src = ''; }}
                      />
                    ) : (
                      <div className="bg-gray-100 h-32 w-full rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-300 text-gray-500">
                        <span className="text-3xl">🖼️</span>
                        <span>Image Preview<br/>Not Available</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-lg text-gray-800">Result #{i+1}</h4>
                      <span className="score-badge bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                        Score: {result.score.toFixed(3)}
                      </span>
                    </div>
                    <div className="mb-2 text-gray-600"><strong>Path:</strong> {result.path}</div>
                    <div className="bg-gray-100 p-2 rounded font-mono text-sm">{result.path?.split('/').pop()}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-16 text-center text-gray-600">
        <hr className="mb-4"/>
        <p>🎥 Keyframe Search Application | Built with React & TailwindCSS</p>
      </div>
    </div>
  );
}

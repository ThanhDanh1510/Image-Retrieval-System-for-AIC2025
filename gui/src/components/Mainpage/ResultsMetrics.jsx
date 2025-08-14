import React from "react";

export default function ResultsMetrics({ results, avgScore, maxScore }) {
  return (
    <div className="flex gap-4 mb-8">
      <div className="bg-white/90 dark:bg-gray-800 p-4 rounded-lg text-center flex-1">
        <div className="font-bold text-lg">Total Results</div>
        <div className="text-2xl">{results.length}</div>
      </div>
      <div className="bg-white/90 dark:bg-gray-800 p-4 rounded-lg text-center flex-1">
        <div className="font-bold text-lg">Average Score</div>
        <div className="text-2xl">{avgScore}</div>
      </div>
      <div className="bg-white/90 dark:bg-gray-800 p-4 rounded-lg text-center flex-1">
        <div className="font-bold text-lg">Best Score</div>
        <div className="text-2xl">{maxScore}</div>
      </div>
    </div>
  );
}

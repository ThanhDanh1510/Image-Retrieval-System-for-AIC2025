// hooks/useApi.js
import { useState } from 'react';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const apiRequest = async (url, method = "GET", body = null) => {
    const options = {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    return response.json();
  };

  const login = async (username, password) => {
    const url = "https://eventretrieval.one/api/v2/login";
    const body = { username, password };
    const data = await apiRequest(url, "POST", body);
    return data.sessionId;
  };

  const getEvaluationID = async (sessionID) => {
    const url = `https://eventretrieval.one/api/v2/client/evaluation/list?session=${sessionID}`;
    const evaluations = await apiRequest(url);
    if (evaluations && evaluations.length > 0) {
      return evaluations[0].id;
    } else {
      throw new Error("No evaluations found.");
    }
  };

  const submitQA = async (sessionID, evaluationID, answerQA, videoID, timeMs) => {
    const url = `https://eventretrieval.one/api/v2/submit/${evaluationID}?session=${sessionID}`;
    const body = {
      answerSets: [
        {
          answers: [
            {
              text: `${answerQA}-${videoID}-${timeMs}`,
            },
          ],
        },
      ],
    };
    return await apiRequest(url, "POST", body);
  };

  const submitKIS = async (sessionID, evaluationID, videoID, timeMs) => {
    const url = `https://eventretrieval.one/api/v2/submit/${evaluationID}?session=${sessionID}`;
    const body = {
      answerSets: [
        {
          answers: [
            {
              mediaItemName: videoID,
              start: timeMs,
              end: timeMs,
            },
          ],
        },
      ],
    };
    return await apiRequest(url, "POST", body);
  };

  const handleSubmit = async (videoID, timeMs, answerQA) => {
    const username = "team40";
    const password = "HD8WD3zCqx";

    setLoading(true);
    setResult("Submitting...");

    try {
      const sessionID = await login(username, password);
      const evaluationID = await getEvaluationID(sessionID);

      let result;
      if (answerQA.trim() === "") {
        result = await submitKIS(sessionID, evaluationID, videoID, timeMs);
      } else {
        result = await submitQA(sessionID, evaluationID, answerQA, videoID, timeMs);
      }

      setResult(`Submission successful: ${JSON.stringify(result)}`);
    } catch (error) {
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return { loading, result, handleSubmit };
};

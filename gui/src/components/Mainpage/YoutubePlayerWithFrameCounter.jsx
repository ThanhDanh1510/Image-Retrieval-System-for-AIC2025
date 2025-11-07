import React, { useEffect, useRef, useState } from "react";

// Đảm bảo đã tải YouTube API script trước: https://www.youtube.com/iframe_api

export default function YoutubePlayerWithFrameCounter({ 
  videoId, 
  startSeconds, 
  fps, 
  onFrameChange 
}) {
  const playerRef = useRef(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    // Hàm callback khi API ready
    const onYouTubeIframeAPIReady = () => {
      const newPlayer = new window.YT.Player(playerRef.current, {
        height: "360",
        width: "640",
        videoId,
        playerVars: {
          autoplay: 1,
          start: startSeconds,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            newPlayer.playVideo();
            setPlayer(newPlayer);
          },
        },
      });
    };

    // Nếu API chưa có, load script và đặt callback
    if (!window.YT) {
      // Load script
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
    } else {
      onYouTubeIframeAPIReady();
    }

    // Cleanup khi unmount
    return () => {
      if (player) {
        player.destroy();
      }
    };
  }, [videoId, startSeconds, player]); // <-- ĐÃ THÊM 'player' VÀO ĐÂY

  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      const currentTime = player.getCurrentTime();
      const frame = Math.round(currentTime * fps);
      setFrameIdx(frame);

      if (onFrameChange) {
        onFrameChange(frame);
      }
    }, 200); // cập nhật mỗi 200ms

    return () => clearInterval(interval);
  }, [player, fps, onFrameChange]); // (useEffect thứ 2 này đã đúng)

  return (
    <div>
      <div ref={playerRef} />
      <div style={{ marginTop: 8, fontWeight: "bold" }}>FPS: {fps}</div>
      <div>Current Frame Index: {frameIdx}</div>
    </div>
  );
}
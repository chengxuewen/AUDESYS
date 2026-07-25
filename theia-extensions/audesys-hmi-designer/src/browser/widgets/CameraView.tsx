import { useRef, useEffect, useCallback, useState } from "react";

// ponytail: CameraView widget — MJPEG stream over <img> (browser-native MJPEG support).
// StreamChannel subscription not implemented yet; waits for P2 push-mode SignalBridge.
// Add WebSocket/StreamChannel decoder when real-time data path lands.

interface CameraViewProps {
  id: string;
  label: string;
  signal?: string;
  config: Record<string, unknown>;
  width: number;
  height: number;
  isSelected: boolean;
  isPreview: boolean;
  signalValue?: number | boolean | string | null;
  error?: string | null;
  onDismissError?: () => void;
}

type CameraState = "disconnected" | "connecting" | "streaming" | "frozen" | "error" | "recording";

function useCameraStream(streamUrl: string | undefined, refreshRate: number, isPreview: boolean) {
  const [state, setState] = useState<CameraState>("disconnected");
  const [fps, setFps] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(performance.now());
  const frozenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxFrameInterval = 1000 / Math.max(refreshRate, 1);

  const resetFrozen = useCallback(() => {
    if (frozenTimer.current) clearTimeout(frozenTimer.current);
    frozenTimer.current = setTimeout(() => {
      setState((s) => (s === "streaming" ? "frozen" : s));
    }, maxFrameInterval * 3);
  }, [maxFrameInterval]);

  useEffect(() => {
    if (!isPreview || !streamUrl) {
      setState("disconnected");
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    imgRef.current = img;
    setState("connecting");

    let lastFrameTime = performance.now();
    let aborted = false;

    const onLoad = () => {
      if (aborted) return;
      const now = performance.now();
      // Drop frame if it arrived too fast (avoid browser decode pile-up)
      if (now - lastFrameTime < maxFrameInterval * 0.5) {
        // Still count as "streaming" but skip fast refresh
        requestAnimationFrame(() => {
          if (!aborted && imgRef.current === img) {
            img.src = streamUrl + (streamUrl.includes("?") ? "&" : "?") + "_t=" + Date.now();
          }
        });
        return;
      }
      lastFrameTime = now;
      frameCount.current++;
      resetFrozen();

      if (state !== "streaming" && state !== "recording") {
        setState("streaming");
      }

      // FPS counter: update every 500ms
      if (now - lastFpsUpdate.current >= 500) {
        const elapsed = (now - lastFpsUpdate.current) / 1000;
        setFps(Math.round(frameCount.current / elapsed));
        frameCount.current = 0;
        lastFpsUpdate.current = now;
      }

      // Re-trigger img load for next MJPEG frame
      // ponytail: browser re-decodes MJPEG on .src change with cache-buster
      if (!aborted) {
        frameTimeout.current = setTimeout(() => {
          if (!aborted && imgRef.current === img) {
            img.src = streamUrl + (streamUrl.includes("?") ? "&" : "?") + "_t=" + Date.now();
          }
        }, maxFrameInterval);
      }
    };

    const onError = () => {
      if (aborted) return;
      setState("error");
    };

    img.onload = onLoad;
    img.onerror = onError;
    img.src = streamUrl + (streamUrl.includes("?") ? "&" : "?") + "_t=" + Date.now();

    return () => {
      aborted = true;
      img.onload = null;
      img.onerror = null;
      if (frameTimeout.current) clearTimeout(frameTimeout.current);
      if (frozenTimer.current) clearTimeout(frozenTimer.current);
      // Stop loading
      img.src = "";
    };
  }, [streamUrl, isPreview, maxFrameInterval, resetFrozen, state]);

  return { state, fps, imgRef };
}

const STATE_CLASSES: Record<CameraState, string> = {
  disconnected: "camera-disconnected",
  connecting: "camera-connecting",
  streaming: "camera-streaming",
  frozen: "camera-frozen",
  error: "camera-error",
  recording: "camera-recording",
};

const STATE_LABELS: Record<CameraState, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting...",
  streaming: "Live",
  frozen: "Frozen",
  error: "Stream Error",
  recording: "Recording",
};

export function CameraView({
  id,
  label,
  config,
  width,
  height,
  isSelected,
  isPreview,
}: CameraViewProps) {
  const streamUrl = typeof config.streamUrl === "string" ? config.streamUrl : undefined;
  const refreshRate = typeof config.refreshRate === "number" ? config.refreshRate : 30;
  const showFps = config.showFps !== false && config.showFps !== "false";

  const { state, fps, imgRef } = useCameraStream(streamUrl, refreshRate, isPreview);

  // Status badge color
  const stateColors: Record<CameraState, string> = {
    disconnected: "#a0a0b0",
    connecting: "#FFB800",
    streaming: "#00D26A",
    frozen: "#FFB800",
    error: "#FF4444",
    recording: "#FF0000",
  };

  return (
    <div
      id={id}
      className={`camera-view ${STATE_CLASSES[state]}`}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        backgroundColor: "#0a0a0b",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* MJPEG stream image */}
      <img
        ref={(el) => {
          // ponytail: sync external imgRef for the effect to use without React re-render on every frame
          (imgRef as React.MutableRefObject<HTMLImageElement | null>).current = el;
        }}
        alt={`Camera: ${label}`}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: state === "streaming" || state === "recording" || state === "frozen" ? "block" : "none",
        }}
      />

      {/* Placeholder when no stream */}
      {(state === "disconnected" || state === "connecting" || state === "error") && (
        <div style={{ textAlign: "center", color: "#a0a0b0", fontSize: 12, padding: 8 }}>
          {state === "disconnected" && (
            <>
              <div style={{ fontSize: 32, marginBottom: 4 }}>📷</div>
              <div>No stream configured</div>
              {!isPreview && <div style={{ fontSize: 10, marginTop: 4 }}>Set streamUrl in properties</div>}
            </>
          )}
          {state === "connecting" && (
            <>
              <div style={{ fontSize: 14, color: "#FFB800" }}>⟳ Connecting...</div>
            </>
          )}
          {state === "error" && (
            <>
              <div style={{ fontSize: 32, marginBottom: 4 }}>⚠️</div>
              <div style={{ color: "#FF4444" }}>Stream error</div>
            </>
          )}
        </div>
      )}

      {/* Frozen overlay */}
      {state === "frozen" && (
        <div style={{
          position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)",
          padding: "2px 8px", borderRadius: 3, backgroundColor: "rgba(255,184,0,0.85)",
          fontSize: 10, color: "#0a0a0b", fontWeight: 600,
        }}>
          ⏸ Frozen
        </div>
      )}

      {/* State badge */}
      <div style={{
        position: "absolute", top: 4, right: 4,
        padding: "1px 6px", borderRadius: 3,
        backgroundColor: `${stateColors[state]}22`,
        border: `1px solid ${stateColors[state]}44`,
        fontSize: 9, color: stateColors[state], fontWeight: 500,
        textTransform: "uppercase", letterSpacing: 0.5,
      }}>
        {STATE_LABELS[state]}
      </div>

      {/* FPS counter */}
      {showFps && (state === "streaming" || state === "recording") && (
        <div style={{
          position: "absolute", bottom: 4, right: 4,
          padding: "1px 6px", borderRadius: 3,
          backgroundColor: "rgba(10,10,11,0.75)",
          fontSize: 10, color: "#00D26A", fontWeight: 600,
          fontFamily: "JetBrains Mono, monospace",
        }}>
          {fps} FPS
        </div>
      )}

      {/* Recording indicator */}
      {state === "recording" && (
        <div style={{
          position: "absolute", top: 4, left: 4,
          display: "flex", alignItems: "center", gap: 4,
          padding: "1px 8px", borderRadius: 3,
          backgroundColor: "rgba(255,0,0,0.85)",
          fontSize: 10, color: "#fff", fontWeight: 600,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", backgroundColor: "#fff",
            animation: "camera-rec-blink 1s ease-in-out infinite",
          }} />
          REC
        </div>
      )}

      {/* CSS-in-JS keyframe for recording blink (ponytail: inserted once via style tag) */}
      <style>{`
        @keyframes camera-rec-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

export default CameraView;

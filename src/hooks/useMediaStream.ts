
import { useState, useCallback } from "react";

export const useMediaStream = ({
  userId,
  localVideoRef,
  onError,
}) => {
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [localPreviewActive, setLocalPreviewActive] = useState(false);

  // Defensive: only stop preview if it's actually a preview stream (do not clear if being reused for call)
  const startLocalPreview = useCallback(async () => {
    if (localPreviewActive || mediaStream) return;
    setMediaLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 400 } },
        audio: true,
      });
      setMediaStream(stream);
      setLocalPreviewActive(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.onloadedmetadata = () => {
          localVideoRef.current?.play();
        };
      }
      setMediaLoading(false);
      console.debug("MediaStream: started preview stream");
    } catch (err: any) {
      setMediaLoading(false);
      if (err.name === "NotAllowedError") {
        onError?.("Camera/mic permission denied. Please allow access in your browser (Preview).");
      } else {
        onError?.("Could not access camera or microphone (Preview).");
      }
      console.error("Failed to access camera/mic (Preview)", err);
    }
  }, [localPreviewActive, localVideoRef, mediaStream, onError, userId]);

  const stopLocalPreview = useCallback(() => {
    // Only stop if preview flag set
    if (!localPreviewActive) return;
    if (mediaStream) {
      console.debug("MediaStream: stopping preview stream (not main call)");
      mediaStream.getTracks().forEach((t) => t.stop());
    }
    setMediaStream(null);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setLocalPreviewActive(false);
    setMediaLoading(false);
  }, [localPreviewActive, mediaStream, localVideoRef, userId]);

  // This is used for the actual main call, after preview
  const startLocalMedia = useCallback(async () => {
    setMediaLoading(true);
    try {
      console.debug("MediaStream: starting main camera for call");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 400 } },
        audio: true,
      });
      setMediaStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.onloadedmetadata = () => {
          localVideoRef.current?.play();
        };
      }
      setMediaLoading(false);
    } catch (err: any) {
      setMediaLoading(false);
      if (err.name === "NotAllowedError") {
        onError?.("Camera/mic permission denied. Please allow access in your browser.");
      } else {
        onError?.("Could not access camera or microphone.");
      }
      console.error("Failed to access camera/mic", err);
    }
  }, [localVideoRef, onError, userId]);

  return {
    mediaStream,
    mediaLoading,
    localPreviewActive,
    startLocalPreview,
    stopLocalPreview,
    startLocalMedia,
    setMediaStream,
  };
};

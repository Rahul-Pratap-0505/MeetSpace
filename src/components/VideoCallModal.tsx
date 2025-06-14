
import React, { useRef, useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Video, PhoneCall } from "lucide-react";
import VideoCallRenderer from "./VideoCallRenderer";
import { useVideoCall } from "@/hooks/useVideoCall";

type VideoCallModalProps = {
  open: boolean;
  onClose: () => void;
  roomId: string;
  userId: string;
  presentUsers?: string[];
  callSession?: string; // ISO call session started time, for modal sync
};

const VideoCallModal: React.FC<VideoCallModalProps> = ({
  open,
  onClose,
  roomId,
  userId,
  presentUsers = [],
  callSession = "",
}) => {
  const [error, setError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // NEW: Always start preview when modal opens, and cleanup when closes
  const [previewActive, setPreviewActive] = useState(false);

  const {
    callStatus,
    inviteUsers,
    acceptCall,
    declineCall,
    cleanup,
    peers,
    inviter,
    ready,
    mediaLoading,
    initializeMediaAndSignaling,
    startLocalPreview,
    stopLocalPreview,
  } = useVideoCall({
    roomId,
    userId,
    localVideoRef,
    onError: (msg) => setError(msg),
    manual: true,
  });

  // ====== FIX: Derive showPrompt directly from callSession
  const showPrompt = useMemo(() => !!callSession, [callSession]);
  // Clear error only when callSession changes
  useEffect(() => {
    if (error) setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callSession]);

  // Is user present in room?
  const isUserPresent = presentUsers?.includes?.(userId);

  // Accept/join: join call with media/signaling
  const handleAccept = async () => {
    if (previewActive) {
      stopLocalPreview && stopLocalPreview();
      setPreviewActive(false);
    }
    await new Promise((res) => setTimeout(res, 100));
    await initializeMediaAndSignaling();
    await acceptCall();
  };

  // End/cut: cleanup and close prompt (user explicit close)
  const handleDeclineOrCut = () => {
    cleanup();
    setPreviewActive(false);
    onClose();
  };

  // ====== FIX: Only start/stop preview according to actual entering/leaving preview
  useEffect(() => {
    // If not supposed to show, make sure preview is off
    if (!open || !showPrompt || callStatus === "connected") {
      if (previewActive) {
        stopLocalPreview && stopLocalPreview();
        setPreviewActive(false);
      }
      return;
    }
    // Start preview only if entering preview mode
    if (!previewActive) {
      startLocalPreview && startLocalPreview();
      setPreviewActive(true);
    }
    // Cleanup preview on unmount just in case
    return () => {
      if (previewActive) {
        stopLocalPreview && stopLocalPreview();
        setPreviewActive(false);
      }
    };
    // eslint-disable-next-line
  }, [open, showPrompt, callStatus]);

  return (
    <Dialog open={open && showPrompt && isUserPresent} onOpenChange={handleDeclineOrCut}>
      <DialogContent className="max-w-xl p-0 border-0 rounded-xl overflow-hidden shadow-2xl flex flex-col bg-white animate-scale-in">
        <DialogTitle className="sr-only">Video Call</DialogTitle>
        <DialogDescription className="sr-only">Group or one-on-one video call modal</DialogDescription>
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 py-2 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold text-lg">
            <Video className="w-5 h-5" />
            Video Call
          </div>
          <Button
            variant="destructive"
            size="icon"
            className="border-white hover:bg-red-600"
            onClick={handleDeclineOrCut}
          >
            <PhoneCall className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center p-3 gap-3 bg-gray-50 transition-all">
          {/* Show local camera preview on open, before Join */}
          {callStatus === "" && previewActive && (
            <div className="flex flex-col items-center gap-3 mt-3">
              <div className="w-52 h-40 bg-gray-200 rounded-lg shadow flex items-center justify-center overflow-hidden ring-2 ring-blue-300 relative mb-2">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ background: "#ccc" }}
                />
                <span className="absolute bottom-1 left-1 bg-black bg-opacity-30 px-2 rounded text-xs text-white">
                  You (Preview)
                </span>
              </div>
              <Video className="h-10 w-10 text-blue-600 mb-2 animate-pulse" />
              <div className="text-lg font-medium text-gray-700">
                Ready to join the group video call?
              </div>
              <Button
                onClick={handleAccept}
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={mediaLoading}
              >
                {mediaLoading ? "Connecting..." : "Join Call"}
              </Button>
              <div className="text-xs text-gray-400">
                You will be prompted to grant camera/mic access after joining.
              </div>
            </div>
          )}
          {(callStatus === "connected" || callStatus === "connecting") && ready && (
            <VideoCallRenderer
              callStatus={callStatus}
              peers={peers}
              inviter={inviter}
              localVideoRef={localVideoRef}
            />
          )}
        </div>
        <div className="flex flex-col gap-1 px-6 pb-4 text-center">
          {error && <div className="text-red-700 text-sm font-medium animate-pulse">{error}</div>}
          {callStatus === "connecting" && (
            <div className="text-blue-700 text-sm font-semibold animate-pulse">Connecting...</div>
          )}
          {callStatus === "connected" && (
            <div className="text-green-700 text-sm font-semibold animate-fade-in">You are live!</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoCallModal;

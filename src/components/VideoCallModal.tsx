import React, { useRef, useState, useEffect } from "react";
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
  const [showPrompt, setShowPrompt] = useState(false);
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
  } = useVideoCall({
    roomId,
    userId,
    localVideoRef,
    onError: (msg) => setError(msg),
    manual: true,
  });

  // Only show modal when there is a new call
  useEffect(() => {
    if (callSession) {
      setShowPrompt(true);
    } else {
      setShowPrompt(false);
    }
    setError(null);
    // CLEANUP: remove auto-calling cleanup here: only explicitly call it on user actions
    // eslint-disable-next-line
  }, [callSession, roomId]);

  // Helper: is user present in the room now?
  const isUserPresent = presentUsers?.includes?.(userId);

  // Prompt for all present users except the initiator, until declined or accepted
  const handleAccept = async () => {
    await initializeMediaAndSignaling();
    await acceptCall();
  };

  // End/cut: cleanup and close prompt (user explicit close)
  const handleDeclineOrCut = () => {
    setShowPrompt(false);
    cleanup();
    onClose();
  };

  // Remove: do not cleanup on unmount (anyone else leaving will not kill local video)
  // useEffect(() => {
  //   return () => {
  //     cleanup();
  //   };
  //   // eslint-disable-next-line
  // }, []);

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
          {callStatus === "" && (
            <div className="flex flex-col items-center gap-3 mt-3">
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
              <div className="text-xs text-gray-400">You will be prompted to grant camera/mic access after joining.</div>
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

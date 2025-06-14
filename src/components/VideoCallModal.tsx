
import React, { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Video, PhoneCall } from "lucide-react";
import VideoCallRenderer from "./VideoCallRenderer";
import { useVideoCall } from "@/hooks/useVideoCall";

// Extend props to control when to start the call (media access)
type VideoCallModalProps = {
  open: boolean;
  onClose: () => void;
  roomId: string;
  userId: string;
  allowMediaAccess?: boolean; // Only access camera/mic if this is true
  onStartCall?: () => void;   // Optional: callback for "Start Call" button
};

const VideoCallModal: React.FC<VideoCallModalProps> = ({
  open,
  onClose,
  roomId,
  userId,
  allowMediaAccess = false,
  onStartCall,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState("");
  const [inviter, setInviter] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const {
    callStatus: realStatus,
    inviteUsers,
    acceptCall,
    declineCall,
    cleanup,
    peers,
    inviter: realInviter,
    ready, // NEW: Is signaling/media ready
    initializeMediaAndSignaling, // NEW: trigger the setup on demand
  } = useVideoCall({
    roomId,
    userId,
    localVideoRef,
    onError: (msg) => setError(msg),
    onStatusChange: (status) => setCallStatus(status),
    onInviterChange: (id) => setInviter(id),
    manual: true, // NEW: manual mode
  });

  // Play sound when call is ringing or incoming
  const ringingAudio = useRef<HTMLAudioElement>(null);
  React.useEffect(() => {
    if ((realStatus === "incoming" || realStatus === "ringing") && ringingAudio.current) {
      ringingAudio.current.play();
    } else if (ringingAudio.current) {
      ringingAudio.current.pause();
      ringingAudio.current.currentTime = 0;
    }
  }, [realStatus]);

  // Only start signaling/media if user explicitly starts the call/accepts
  React.useEffect(() => {
    if (open && allowMediaAccess) {
      initializeMediaAndSignaling();
    }
    // Don't run on close
    // eslint-disable-next-line
  }, [open, allowMediaAccess]);

  // The UI: Show a button to initiate the call if not connected
  return (
    <Dialog open={open} onOpenChange={() => { onClose(); cleanup(); }}>
      <DialogContent className="max-w-xl p-0 border-0 rounded-xl overflow-hidden shadow-2xl flex flex-col bg-white animate-scale-in">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 py-2 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold text-lg">
            <Video className="w-5 h-5" />
            Video Call
          </div>
          <Button
            variant="destructive"
            size="icon"
            className="border-white hover:bg-red-600"
            onClick={() => { onClose(); cleanup(); }}
          >
            <PhoneCall className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center p-3 gap-3 bg-gray-50 transition-all">
          {allowMediaAccess && ready && (
            <VideoCallRenderer
              callStatus={realStatus}
              peers={peers}
              inviter={realInviter}
              localVideoRef={localVideoRef}
            />
          )}
          {/* Prompt to start call */}
          {!allowMediaAccess && !realStatus && (
            <div className="flex flex-col items-center gap-3 mt-3">
              <Video className="h-10 w-10 text-blue-600 mb-2 animate-pulse" />
              <div className="text-lg font-medium text-gray-700">
                Ready to start a video call?
              </div>
              <Button
                onClick={() => {
                  onStartCall?.(); // Tell parent to flip flag and prompt media
                  setTimeout(() => inviteUsers(), 200); // Slight delay to let media/signaling initialize
                }}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Start Call &amp; Invite
              </Button>
              <div className="text-xs text-gray-400">You will be prompted to grant camera/mic access after pressing.</div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 px-6 pb-4 text-center">
          {error && <div className="text-red-700 text-sm font-medium animate-pulse">{error}</div>}
          {realStatus === "ringing" && <div className="text-blue-700 text-sm font-semibold animate-pulse">Calling other users...</div>}
          {realStatus === "incoming" && (
            <div className="text-yellow-800 font-semibold animate-pulse flex flex-col items-center gap-2">
              <span>Incoming call...</span>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => { onStartCall?.(); setTimeout(() => acceptCall(), 200); }} className="bg-green-600 text-white hover:bg-green-700">Accept</Button>
                <Button onClick={declineCall} variant="destructive">Decline</Button>
              </div>
            </div>
          )}
          {realStatus === "connecting" && <div className="text-blue-700 text-sm font-semibold animate-pulse">Connecting...</div>}
          {realStatus === "connected" && <div className="text-green-700 text-sm font-semibold animate-fade-in">You are live!</div>}
          {realStatus === "ended" && <div className="text-gray-700 text-sm font-semibold animate-fade-in">Call Ended</div>}
        </div>
        <audio ref={ringingAudio} src="https://assets.mixkit.co/sfx/preview/mixkit-classic-alarm-995.mp3" loop hidden />
      </DialogContent>
    </Dialog>
  );
};
export default VideoCallModal;

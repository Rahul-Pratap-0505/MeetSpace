
import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
    ready,
    mediaLoading,
    initializeMediaAndSignaling,
  } = useVideoCall({
    roomId,
    userId,
    localVideoRef,
    onError: (msg) => setError(msg),
    onStatusChange: (status) => setCallStatus(status),
    onInviterChange: (id) => setInviter(id),
    manual: true, // keep manual, only trigger when needed
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

  // The UI: Show a button to initiate the call if not connected
  // Now: require user to first click to start setup, THEN invite/connect
  const [preparing, setPreparing] = useState(false);

  const handleStartCallClick = async () => {
    setPreparing(true);
    await initializeMediaAndSignaling(); // Step 1: start media+signaling
    // Wait for camera to be ready
    const waitReady = () =>
      new Promise<void>((resolve) => {
        if (!mediaLoading && ready) return resolve();
        const int = setInterval(() => {
          if (!mediaLoading && ready) {
            clearInterval(int);
            resolve();
          }
        }, 50);
      });
    await waitReady();
    setPreparing(false);
    onStartCall?.();
    setTimeout(() => inviteUsers(), 100); // Step 2: send invitations
  };

  const handleAcceptClick = async () => {
    setPreparing(true);
    await initializeMediaAndSignaling();
    const waitReady = () =>
      new Promise<void>((resolve) => {
        if (!mediaLoading && ready) return resolve();
        const int = setInterval(() => {
          if (!mediaLoading && ready) {
            clearInterval(int);
            resolve();
          }
        }, 50);
      });
    await waitReady();
    setPreparing(false);
    onStartCall?.();
    setTimeout(() => acceptCall(), 100);
  };

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); cleanup(); }}>
      <DialogContent className="max-w-xl p-0 border-0 rounded-xl overflow-hidden shadow-2xl flex flex-col bg-white animate-scale-in">
        {/* Added mandatory title and description for a11y */}
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
            onClick={() => { onClose(); cleanup(); }}
          >
            <PhoneCall className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center p-3 gap-3 bg-gray-50 transition-all">
          {/* Only show video UI if camera is ready */}
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
                onClick={handleStartCallClick}
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={preparing || mediaLoading}
              >
                {preparing || mediaLoading ? "Preparing..." : "Start Call & Invite"}
              </Button>
              <div className="text-xs text-gray-400">You will be prompted to grant camera/mic access after pressing.</div>
            </div>
          )}
          {(realStatus === "incoming" && !ready) && (
            <div className="flex flex-col items-center gap-3 mt-3">
              <Video className="h-10 w-10 text-yellow-600 mb-2 animate-pulse" />
              <div className="text-lg font-medium text-yellow-700">
                Incoming call... Accept and connect?
              </div>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleAcceptClick} className="bg-green-600 text-white hover:bg-green-700" disabled={preparing || mediaLoading}>
                  {preparing || mediaLoading ? "Connecting..." : "Accept"}
                </Button>
                <Button onClick={declineCall} variant="destructive" disabled={preparing}>
                  Decline
                </Button>
              </div>
              <div className="text-xs text-gray-400">Camera/mic access will be requested after accepting.</div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 px-6 pb-4 text-center">
          {error && <div className="text-red-700 text-sm font-medium animate-pulse">{error}</div>}
          {realStatus === "ringing" && <div className="text-blue-700 text-sm font-semibold animate-pulse">Calling other users...</div>}
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

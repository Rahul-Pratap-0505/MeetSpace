
import React, { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Video, PhoneCall } from "lucide-react";
import VideoCallRenderer from "./VideoCallRenderer";
import { useVideoCall } from "@/hooks/useVideoCall";

type VideoCallModalProps = {
  open: boolean;
  onClose: () => void;
  roomId: string;
  userId: string;
};

const VideoCallModal: React.FC<VideoCallModalProps> = ({
  open,
  onClose,
  roomId,
  userId,
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
  } = useVideoCall({
    roomId,
    userId,
    localVideoRef,
    onError: (msg) => setError(msg),
    onStatusChange: (status) => setCallStatus(status),
    onInviterChange: (id) => setInviter(id),
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
          <VideoCallRenderer
            callStatus={realStatus}
            peers={peers}
            inviter={realInviter}
            localVideoRef={localVideoRef}
          />
        </div>
        <div className="flex flex-col gap-1 px-6 pb-4 text-center">
          {error && <div className="text-red-700 text-sm font-medium animate-pulse">{error}</div>}
          {realStatus === "ringing" && <div className="text-blue-700 text-sm font-semibold animate-pulse">Calling other users...</div>}
          {realStatus === "incoming" && (
            <div className="text-yellow-800 font-semibold animate-pulse flex flex-col items-center gap-2">
              <span>Incoming call...</span>
              <div className="flex gap-3 justify-center">
                <Button onClick={acceptCall} className="bg-green-600 text-white hover:bg-green-700">Accept</Button>
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

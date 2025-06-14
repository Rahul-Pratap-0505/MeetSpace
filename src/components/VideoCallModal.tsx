
import React, { useRef, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Video, VideoOff, PhoneCall } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * This component establishes a WebRTC connection and uses
 * Supabase Realtime channels for signaling between two peers.
 * For demo purposes, users join the same room and the first to "call" acts as initiator.
 */

type VideoCallModalProps = {
  open: boolean;
  onClose: () => void;
  roomId: string;
  userId: string;
};

type SignalData = {
  sdp?: any;
  candidate?: any;
  sender: string;
};

const VideoCallModal: React.FC<VideoCallModalProps> = ({
  open,
  onClose,
  roomId,
  userId,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "connected" | "ended">("idle");
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const signalChannelRef = useRef<any>(null);

  // Make sure to only allow 2 participants for demo
  const SIGNAL_CHANNEL = `video-signal-${roomId}`;

  // --- WebRTC config ---
  const RTC_CONFIG = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  };

  useEffect(() => {
    if (open) {
      setCallStatus("connecting");
      startLocalMedia().then(() => {
        createOrJoin();
      });
    }

    return () => {
      cleanup();
    };
    // eslint-disable-next-line
  }, [open]);

  // Setup local media
  const startLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 400 } },
        audio: true,
      });
      setMediaStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setError("Could not access camera or microphone.");
      setCallStatus("ended");
    }
  };

  const cleanup = () => {
    peerConnectionRef.current?.close();
    mediaStream?.getTracks().forEach((track) => track.stop());
    setRemoteStream(null);
    setMediaStream(null);

    if (signalChannelRef.current)
      supabase.removeChannel(signalChannelRef.current);
    setCallStatus("ended");
    setError(null);
  };

  // Set up signaling channel and handle WebRTC
  const createOrJoin = async () => {
    // Only one channel per room
    const channel = supabase.channel(SIGNAL_CHANNEL, {
      config: { broadcast: { ack: true } },
    });

    channel
      .on("broadcast", { event: "signal" }, async (payload) => {
        const { sdp, candidate, sender } = payload.payload as SignalData;
        // Ignore self-sent
        if (sender === userId) return;
        // Lazy create peer connect if doesn't exist
        if (!peerConnectionRef.current) {
          await createPeerConnection(false);
        }

        // If offer received, set as remote and answer
        if (sdp) {
          await peerConnectionRef.current!.setRemoteDescription(
            new RTCSessionDescription(sdp)
          );
          if (sdp.type === "offer") {
            const answer = await peerConnectionRef.current!.createAnswer();
            await peerConnectionRef.current!.setLocalDescription(answer);
            // Send answer
            channel.send({
              type: "broadcast",
              event: "signal",
              payload: { sdp: answer, sender: userId },
            });
          }
        }
        // If ICE candidate received, add to pc
        if (candidate) {
          try {
            await peerConnectionRef.current!.addIceCandidate(candidate);
          } catch (e) {
            // Ignore duplicate/invalid candidates
          }
        }
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") {
          signalChannelRef.current = channel;
          // If first to join, be the caller (initiator)
          createPeerConnection(true);
        }
      });
  };

  const createPeerConnection = async (isInitiator: boolean) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionRef.current = pc;

    // Add local stream
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => pc.addTrack(track, mediaStream));
    }
    // Remote stream
    const remoteStreamObj = new MediaStream();
    setRemoteStream(remoteStreamObj);
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        event.streams[0] &&
          (remoteVideoRef.current.srcObject = event.streams[0]);
      }
    };

    // Handle ICE
    pc.onicecandidate = (event) => {
      if (event.candidate && signalChannelRef.current) {
        signalChannelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: {
            candidate: event.candidate,
            sender: userId,
          },
        });
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallStatus("connected");
      } else if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected" ||
        pc.connectionState === "closed"
      ) {
        setCallStatus("ended");
      }
    };

    // --- Initiator logic: send offer
    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (signalChannelRef.current) {
        signalChannelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: { sdp: offer, sender: userId },
        });
      }
    }
  };

  // --- Modal Content UI ---
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 border-0 rounded-xl overflow-hidden shadow-2xl flex flex-col bg-white animate-scale-in">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 py-2 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold text-lg">
            <Video className="w-5 h-5" />
            Video Call
          </div>
          <Button
            variant="destructive"
            size="icon"
            className="border-white hover:bg-red-600"
            onClick={onClose}
          >
            <PhoneCall className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center p-3 gap-3 bg-gray-50 sm:flex-row sm:gap-6 transition-all">
          {/* Video Containers */}
          <div className="w-56 h-40 bg-gray-200 rounded-lg shadow flex items-center justify-center overflow-hidden ring-2 ring-blue-300 animate-fade-in">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ background: "#ccc" }}
            />
          </div>
          <div className={`w-56 h-40 bg-gray-200 rounded-lg shadow flex items-center justify-center overflow-hidden ring-2 ring-purple-300 animate-fade-in ${callStatus === "idle" ? "opacity-40" : "opacity-100"}`}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={{ background: "#ccc" }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 px-6 pb-4 text-center">
          {error && (
            <div className="text-red-700 text-sm font-medium animate-pulse">{error}</div>
          )}
          {callStatus === "connecting" && (
            <div className="text-blue-700 text-sm font-semibold animate-pulse">Connecting...</div>
          )}
          {callStatus === "connected" && (
            <div className="text-green-700 text-sm font-semibold animate-fade-in">You are live!</div>
          )}
          {callStatus === "ended" && (
            <div className="text-gray-700 text-sm font-semibold animate-fade-in">Call Ended</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoCallModal;

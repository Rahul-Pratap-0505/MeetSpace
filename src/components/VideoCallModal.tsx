
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

type GroupSignalData = {
  type: "invite" | "accept" | "decline" | "signal";
  sender: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  target?: string;
};

type PeerInfo = {
  id: string;
  pc: RTCPeerConnection;
  stream?: MediaStream;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
};

const VideoCallModal: React.FC<VideoCallModalProps> = ({
  open,
  onClose,
  roomId,
  userId,
}) => {
  const [callStatus, setCallStatus] = useState<"idle" | "ringing" | "incoming" | "connecting" | "connected" | "ended">("idle");
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<{ [id: string]: PeerInfo }>({});
  const [inviter, setInviter] = useState<string | null>(null); // Who is calling you?
  const [acceptVisible, setAcceptVisible] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const callChannelRef = useRef<any>(null);
  const peerRefs = useRef<{ [id: string]: PeerInfo }>({}); // for stable refs

  // Call sound
  const ringingAudio = useRef<HTMLAudioElement>(null);

  const SIGNAL_CHANNEL = `video-signal-${roomId}`;

  const RTC_CONFIG = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  // --- SETUP & CLEANUP ---
  useEffect(() => {
    if (open) {
      startLocalMedia().then(() => setupSignaling());
    }
    return () => cleanup();
    // eslint-disable-next-line
  }, [open]);

  // Play sound when call is ringing
  useEffect(() => {
    if (callStatus === "incoming" && ringingAudio.current) {
      ringingAudio.current.play();
    } else if (ringingAudio.current) {
      ringingAudio.current.pause();
      ringingAudio.current.currentTime = 0;
    }
  }, [callStatus]);

  // --- Media setup ---
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

  // --- Signaling setup (Supabase realtime channel) ---
  const setupSignaling = async () => {
    const channel = supabase.channel(SIGNAL_CHANNEL, {
      config: { broadcast: { ack: true } }
    });

    channel
      .on("broadcast", { event: "groupcall" }, async (payload) => {
        const msg: GroupSignalData = payload.payload;
        if (msg.sender === userId) return; // Don't handle self-sent
        if (!mediaStream) return;

        if (msg.type === "invite" && callStatus === "idle") {
          setInviter(msg.sender);
          setCallStatus("incoming");
          setAcceptVisible(true);
        }

        if (msg.type === "decline" && callStatus === "ringing") {
          setCallStatus("ended");
          setError("User declined.");
        }

        if (msg.type === "accept" && callStatus === "ringing") {
          // Start peer connection to that user
          await connectToPeer(msg.sender, true);
          setCallStatus("connecting");
        }

        if (msg.type === "signal") {
          await handleSignal(msg.sender, msg);
        }
      })
      .subscribe((s: any) => {
        if (s === "SUBSCRIBED") {
          callChannelRef.current = channel;
        }
      });
  };

  // --- INVITE LOGIC: handles both group & direct calls ---
  const inviteUsers = async () => {
    if (!callChannelRef.current) return;
    setCallStatus("ringing");
    callChannelRef.current.send({
      type: "broadcast",
      event: "groupcall",
      payload: {
        type: "invite",
        sender: userId,
      },
    });
  };

  // --- Accept/Decline handlers ---
  const acceptCall = async () => {
    setAcceptVisible(false);
    setCallStatus("connecting");
    // Notify inviter (and others) you accepted
    callChannelRef.current?.send({
      type: "broadcast",
      event: "groupcall",
      payload: {
        type: "accept",
        sender: userId,
      },
    });
    // Connect with all other participants (mesh)
    await connectToPeer(inviter!, false);
  };
  const declineCall = () => {
    setAcceptVisible(false);
    setCallStatus("ended");
    callChannelRef.current?.send({
      type: "broadcast",
      event: "groupcall",
      payload: {
        type: "decline",
        sender: userId,
        target: inviter,
      },
    });
    cleanup();
    onClose();
  };

  // --- PEER CONNECTION MANAGEMENT (Group mesh) ---
  const connectToPeer = async (peerId: string, isInitiator: boolean) => {
    if (peerRefs.current[peerId]) return; // Already connected

    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Attach local tracks
    mediaStream?.getTracks().forEach((track) => pc.addTrack(track, mediaStream));

    // Display remote stream
    const remoteVideo = React.createRef<HTMLVideoElement>();
    pc.ontrack = (event) => {
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = event.streams[0];
      }
    };

    // ICE handling
    pc.onicecandidate = (event) => {
      if (event.candidate && callChannelRef.current) {
        callChannelRef.current.send({
          type: "broadcast",
          event: "groupcall",
          payload: {
            type: "signal",
            sender: userId,
            candidate: event.candidate,
            target: peerId,
          },
        });
      }
    };

    // State changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallStatus("connected");
      }
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected" ||
        pc.connectionState === "closed"
      ) {
        setCallStatus("ended");
        setPeers((p) => {
          delete p[peerId];
          return { ...p };
        });
      }
    };

    peerRefs.current[peerId] = { id: peerId, pc, remoteVideoRef: remoteVideo };
    setPeers((p) => ({ ...p, [peerId]: { id: peerId, pc, remoteVideoRef: remoteVideo } }));

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      callChannelRef.current?.send({
        type: "broadcast",
        event: "groupcall",
        payload: {
          type: "signal",
          sdp: offer,
          sender: userId,
          target: peerId,
        },
      });
    }
  };

  // --- Handle incoming offer/answer/ICE ---
  const handleSignal = async (peerId: string, msg: GroupSignalData) => {
    // Setup peer connection if not exists
    if (!peerRefs.current[peerId]) {
      await connectToPeer(peerId, false);
    }
    const pc = peerRefs.current[peerId]?.pc;
    if (!pc) return;

    if (msg.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp!));
      if (msg.sdp!.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        callChannelRef.current?.send({
          type: "broadcast",
          event: "groupcall",
          payload: {
            type: "signal",
            sdp: answer,
            sender: userId,
            target: peerId,
          },
        });
      }
    }
    if (msg.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      } catch (e) { }
    }
  };

  // --- CLEANUP ---
  const cleanup = () => {
    Object.values(peerRefs.current).forEach(({ pc }) => pc.close());
    setPeers({});
    mediaStream?.getTracks().forEach((t) => t.stop());
    setMediaStream(null);
    if (callChannelRef.current) supabase.removeChannel(callChannelRef.current);
    setAcceptVisible(false);
    setInviter(null);
    setCallStatus("ended");
    setError(null);
  };

  // --- UI rendering for group: local + remote videos ---
  const renderVideos = () => {
    const peerVideos = Object.values(peers).map(({ id, remoteVideoRef }) => (
      <div key={id} className="w-52 h-40 bg-gray-200 rounded-lg shadow flex items-center justify-center overflow-hidden ring-2 ring-purple-300 animate-fade-in mx-2">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          style={{ background: "#ccc" }}
        />
        <span className="absolute bottom-1 left-1 bg-black bg-opacity-30 px-2 rounded text-xs text-white">{id === inviter ? "Caller" : "User"}</span>
      </div>
    ));

    return (
      <div className="flex flex-wrap gap-3 items-center justify-center">
        {/* Local video always first */}
        <div className="w-52 h-40 bg-gray-200 rounded-lg shadow flex items-center justify-center overflow-hidden ring-2 ring-blue-300 animate-fade-in relative">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ background: "#ccc" }}
          />
          <span className="absolute bottom-1 left-1 bg-black bg-opacity-30 px-2 rounded text-xs text-white">You</span>
        </div>
        {peerVideos}
      </div>
    );
  };

  // --- Modal UI ---
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
          {renderVideos()}
        </div>
        <div className="flex flex-col gap-1 px-6 pb-4 text-center">
          {error && <div className="text-red-700 text-sm font-medium animate-pulse">{error}</div>}
          {callStatus === "ringing" && <div className="text-blue-700 text-sm font-semibold animate-pulse">Calling other users...</div>}
          {callStatus === "incoming" && (
            <div className="text-yellow-800 font-semibold animate-pulse flex flex-col items-center gap-2">
              <span>Incoming call...</span>
              <div className="flex gap-3 justify-center">
                <Button onClick={acceptCall} className="bg-green-600 text-white hover:bg-green-700">Accept</Button>
                <Button onClick={declineCall} variant="destructive">Decline</Button>
              </div>
            </div>
          )}
          {callStatus === "connecting" && <div className="text-blue-700 text-sm font-semibold animate-pulse">Connecting...</div>}
          {callStatus === "connected" && <div className="text-green-700 text-sm font-semibold animate-fade-in">You are live!</div>}
          {callStatus === "ended" && <div className="text-gray-700 text-sm font-semibold animate-fade-in">Call Ended</div>}
        </div>
        {/* Ringing Sound */}
        <audio ref={ringingAudio} src="https://assets.mixkit.co/sfx/preview/mixkit-classic-alarm-995.mp3" loop hidden />
      </DialogContent>
    </Dialog>
  );
};

export default VideoCallModal;


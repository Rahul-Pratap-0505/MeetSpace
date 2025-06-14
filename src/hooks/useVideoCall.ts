import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type GroupSignalData = {
  type: "invite" | "accept" | "decline" | "signal";
  sender: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  target?: string;
};

export type PeerInfo = {
  id: string;
  pc: RTCPeerConnection;
  stream?: MediaStream;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
};

type UseVideoCallOptions = {
  roomId: string;
  userId: string;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  onError?: (msg: string) => void;
  onStatusChange?: (status: string) => void;
  onInviterChange?: (id: string | null) => void;
  manual?: boolean;
};

export const useVideoCall = ({
  roomId,
  userId,
  localVideoRef,
  onError,
  onStatusChange,
  onInviterChange,
  manual = false,
}: UseVideoCallOptions) => {
  const [callStatus, setCallStatus] = useState<"idle" | "ringing" | "incoming" | "connecting" | "connected" | "ended" | "">(manual ? "" : "idle");
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<{ [id: string]: PeerInfo }>({});
  const [inviter, setInviter] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const callChannelRef = useRef<any>(null);
  const peerRefs = useRef<{ [id: string]: PeerInfo }>({});
  const [connectedPeers, setConnectedPeers] = useState<Set<string>>(new Set());

  const SIGNAL_CHANNEL = `video-signal-${roomId}`;
  const RTC_CONFIG = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  // --- PEER CONNECTION MANAGEMENT ---
  const connectToPeer = useCallback(async (peerId: string, isInitiator: boolean) => {
    if (peerRefs.current[peerId]) return;
    console.log(`Connecting to peer: ${peerId} as ${isInitiator ? "initiator" : "callee"}`);
    const pc = new RTCPeerConnection(RTC_CONFIG);

    mediaStream?.getTracks().forEach((track) => pc.addTrack(track, mediaStream));
    const remoteVideo = { current: document.createElement("video") } as React.RefObject<HTMLVideoElement>;

    pc.ontrack = (event) => {
      console.log("Received remote track from", peerId);
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = event.streams[0];
      }
    };

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

    pc.onconnectionstatechange = () => {
      console.log(`PeerConnection with ${peerId} state:`, pc.connectionState);
      if (pc.connectionState === "connected") {
        setConnectedPeers(prev => new Set([...prev, peerId]));
        setCallStatus("connected");
      }
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected" ||
        pc.connectionState === "closed"
      ) {
        setConnectedPeers(prev => {
          const newSet = new Set(prev);
          newSet.delete(peerId);
          return newSet;
        });
        setPeers((p) => {
          delete p[peerId];
          return { ...p };
        });
        delete peerRefs.current[peerId];
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
  }, [mediaStream, userId]);

  // --- Handle incoming offer/answer/ICE ---
  const handleSignal = useCallback(async (peerId: string, msg: GroupSignalData) => {
    if (!peerRefs.current[peerId]) {
      await connectToPeer(peerId, false);
    }
    const pc = peerRefs.current[peerId]?.pc;
    if (!pc) return;
    console.log("Handling signal from", peerId, msg.type);

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
      } catch (e) {
        console.error("Failed to add ICE candidate", e);
      }
    }
  }, [connectToPeer, userId]);

  // --- CLEANUP ---
  const cleanup = useCallback(() => {
    Object.values(peerRefs.current).forEach(({ pc }) => pc.close());
    setPeers({});
    peerRefs.current = {};
    setConnectedPeers(new Set());
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
    }
    setMediaStream(null);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (callChannelRef.current) {
      supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
    }
    setInviter(null);
    setReady(false);
    setCallStatus(manual ? "" : "ended");
    setMediaLoading(false);
    console.log("Cleaned up call state");
  }, [mediaStream, manual, localVideoRef]);

  // --- Local preview-only logic (camera only, no signaling) ---
  const [localPreviewActive, setLocalPreviewActive] = useState(false);
  const startLocalPreview = useCallback(async () => {
    // If already previewing or already have a stream, do nothing
    if (localPreviewActive || mediaStream) return;
    setMediaLoading(true);
    try {
      console.log("Starting local PREVIEW for user:", userId);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 400 } },
        audio: true,
      });
      setMediaStream(stream); // (just like main logic)
      setLocalPreviewActive(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.onloadedmetadata = () => {
          console.log("Local video preview loaded metadata, attempting to play...");
          localVideoRef.current?.play();
        };
      }
      setMediaLoading(false);
      console.log("Started local preview for:", userId);
    } catch (err: any) {
      setMediaLoading(false);
      if (err.name === "NotAllowedError") {
        onError?.("Camera/mic permission denied. Please allow access in your browser (Preview).");
      } else {
        onError?.("Could not access camera or microphone (Preview).");
      }
      setCallStatus("ended");
      console.error("Failed to access camera/mic (Preview)", err);
    }
  }, [localPreviewActive, localVideoRef, mediaStream, onError, userId]);

  const stopLocalPreview = useCallback(() => {
    if (!localPreviewActive) return;
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
    }
    setMediaStream(null);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setLocalPreviewActive(false);
    setMediaLoading(false);
    console.log("Stopped local preview for:", userId);
  }, [localPreviewActive, mediaStream, localVideoRef, userId]);

  // --- Media setup ---
  const startLocalMedia = useCallback(async () => {
    setMediaLoading(true);
    try {
      console.log("Starting local media for user:", userId);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 400 } },
        audio: true,
      });
      setMediaStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.onloadedmetadata = () => {
          console.log("Local video loaded metadata, attempting to play...");
          localVideoRef.current?.play();
        };
        console.log("Assigned webcam stream to video element");
      }
      setMediaLoading(false);
      console.log("Got user media for:", userId);
    } catch (err: any) {
      setMediaLoading(false);
      if (err.name === "NotAllowedError") {
        onError?.("Camera/mic permission denied. Please allow access in your browser.");
      } else {
        onError?.("Could not access camera or microphone.");
      }
      setCallStatus("ended");
      console.error("Failed to access camera/mic", err);
    }
  }, [localVideoRef, onError, userId]);

  // --- Signaling setup ---
  const setupSignaling = useCallback(async () => {
    console.log("Setting up signaling for", SIGNAL_CHANNEL, "user:", userId);
    if (callChannelRef.current) {
      try { supabase.removeChannel(callChannelRef.current); } catch {}
    }
    const channel = supabase.channel(SIGNAL_CHANNEL, {
      config: { broadcast: { ack: true } }
    });

    channel
      .on("broadcast", { event: "groupcall" }, async (payload) => {
        const msg: GroupSignalData = payload.payload;
        if (msg.sender === userId) return;
        if (!mediaStream) {
          console.log("No local media yet, skipping signaling event", msg);
          return;
        }
        console.log("Signaling event received:", msg, "Current status:", callStatus);
        
        if (msg.type === "invite" && (callStatus === "idle" || callStatus === "")) {
          setInviter(msg.sender);
          setCallStatus("incoming");
        }
        if (msg.type === "decline" && callStatus === "ringing") {
          setCallStatus("ended");
          onError?.("User declined.");
          // DO NOT call cleanup(); local user keeps their camera open until they close/leave the call
        }
        if (msg.type === "accept" && callStatus === "ringing") {
          console.log("Peer accepted, connecting to:", msg.sender);
          await connectToPeer(msg.sender, true);
          setCallStatus("connecting");
        }
        if (msg.type === "signal") {
          if (msg.target === userId || !msg.target) {
            await handleSignal(msg.sender, msg);
          }
        }
      })
      .subscribe((s: any) => {
        if (s === "SUBSCRIBED") {
          callChannelRef.current = channel;
          console.log("Subscribed to signaling channel");
        }
      });
  }, [SIGNAL_CHANNEL, userId, mediaStream, callStatus, onError, connectToPeer, handleSignal]);

  // --- Manual trigger logic ---
  const initializeMediaAndSignaling = useCallback(async () => {
    if (!ready) {
      console.log("Initializing media & signaling for user:", userId);
      // Do NOT start local preview again if already active.
      if (!mediaStream) {
        await startLocalMedia();
      }
      await setupSignaling();
      setReady(true);
      setLocalPreviewActive(false); // switch from preview to call
      console.log("Media and signaling ready");
    }
  }, [ready, startLocalMedia, setupSignaling, userId, mediaStream]);

  // --- INVITE LOGIC ---
  const inviteUsers = useCallback(async () => {
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
    console.log("Sent invite (ringing) from", userId);
  }, [userId]);

  // --- Accept/Decline handlers ---
  const acceptCall = useCallback(async () => {
    setCallStatus("connecting");
    if (callChannelRef.current && inviter) {
      callChannelRef.current.send({
        type: "broadcast",
        event: "groupcall",
        payload: {
          type: "accept",
          sender: userId,
        },
      });
      console.log("Accepted call, connecting as callee", userId);
      // Connect to the inviter
      await connectToPeer(inviter, false);
    }
  }, [userId, inviter, connectToPeer]);

  const declineCall = useCallback(() => {
    setCallStatus("ended");
    if (callChannelRef.current) {
      callChannelRef.current.send({
        type: "broadcast",
        event: "groupcall",
        payload: {
          type: "decline",
          sender: userId,
          target: inviter,
        },
      });
    }
    // CLEANUP only on user action (not when remote peer triggers "decline")
    cleanup();
    console.log("Declined call:", userId);
  }, [userId, inviter, cleanup]);

  // Expose state for parent
  useEffect(() => { onStatusChange?.(callStatus); }, [callStatus, onStatusChange]);
  useEffect(() => { onInviterChange?.(inviter); }, [inviter, onInviterChange]);

  // -- Automatic start for open, UNLESS in manual mode
  useEffect(() => {
    if (!manual) {
      startLocalMedia().then(() => {
        setupSignaling().then(() => setReady(true));
      });
      return cleanup;
    }
    return cleanup;
  }, [manual, startLocalMedia, setupSignaling, cleanup]);

  return {
    callStatus,
    peers,
    inviter,
    mediaStream,
    inviteUsers,
    acceptCall,
    declineCall,
    cleanup,
    ready,
    mediaLoading,
    initializeMediaAndSignaling,
    startLocalPreview,
    stopLocalPreview,
  };
};

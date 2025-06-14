
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
  manual?: boolean; // new prop - if true: do not initialize signaling/media until requested
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
  const [ready, setReady] = useState(false); // mark when both signaling & media ready
  const [mediaLoading, setMediaLoading] = useState(false); // NEW: Track if camera is loading
  const callChannelRef = useRef<any>(null);
  const peerRefs = useRef<{ [id: string]: PeerInfo }>({});

  const SIGNAL_CHANNEL = `video-signal-${roomId}`;
  const RTC_CONFIG = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  // Expose state for parent
  useEffect(() => { onStatusChange?.(callStatus); }, [callStatus]);
  useEffect(() => { onInviterChange?.(inviter); }, [inviter]);

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
      // set the srcObject even if already set
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setMediaLoading(false);
      console.log("Got user media for:", userId);
    } catch (err) {
      setMediaLoading(false);
      onError?.("Could not access camera or microphone.");
      setCallStatus("ended");
      console.error("Failed to access camera/mic", err);
    }
  }, [localVideoRef, onError, userId]);

  // --- Signaling setup ---
  const setupSignaling = useCallback(async () => {
    console.log("Setting up signaling for", SIGNAL_CHANNEL, "user:", userId);
    // Clean old channel if exists
    if (callChannelRef.current) {
      try { supabase.removeChannel(callChannelRef.current); } catch {}
    }
    const channel = supabase.channel(SIGNAL_CHANNEL, {
      config: { broadcast: { ack: true } }
    });

    channel
      .on("broadcast", { event: "groupcall" }, async (payload) => {
        const msg: GroupSignalData = payload.payload;
        if (msg.sender === userId) return; // Don't process own events
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
        }
        if (msg.type === "accept" && callStatus === "ringing") {
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
  }, [SIGNAL_CHANNEL, userId, mediaStream, callStatus, onError, connectToPeer, handleSignal]);

  // --- Manual trigger logic ---
  const initializeMediaAndSignaling = useCallback(async () => {
    if (!ready) {
      console.log("Initializing media & signaling for user:", userId);
      await startLocalMedia();
      await setupSignaling();
      setReady(true);
      console.log("Media and signaling ready");
    }
  }, [ready, startLocalMedia, setupSignaling, userId]);

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
    if (callChannelRef.current) {
      callChannelRef.current.send({
        type: "broadcast",
        event: "groupcall",
        payload: {
          type: "accept",
          sender: userId,
        },
      });
    }
    console.log("Accepted call, connecting as callee", userId);
    await connectToPeer(inviter!, false);
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
    cleanup();
    console.log("Declined call:", userId);
  }, [userId, inviter, cleanup]);

  // --- PEER CONNECTION MANAGEMENT --- (add log, same logic)
  const connectToPeer = useCallback(async (peerId: string, isInitiator: boolean) => {
    if (peerRefs.current[peerId]) return;
    console.log(`Connecting to peer: ${peerId} as ${isInitiator ? "initiator" : "callee"}`);
    const pc = new RTCPeerConnection(RTC_CONFIG);

    mediaStream?.getTracks().forEach((track) => pc.addTrack(track, mediaStream));
    const remoteVideo = { current: document.createElement("video") } as React.RefObject<HTMLVideoElement>;

    pc.ontrack = (event) => {
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
      console.log("PeerConnection state:", pc.connectionState);
      if (pc.connectionState === "connected") setCallStatus("connected");
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
  }, [mediaStream, userId]);

  // --- Handle incoming offer/answer/ICE --- (add log, same logic)
  const handleSignal = useCallback(async (peerId: string, msg: GroupSignalData) => {
    if (!peerRefs.current[peerId]) {
      await connectToPeer(peerId, false);
    }
    const pc = peerRefs.current[peerId]?.pc;
    if (!pc) return;
    console.log("Handling signal from", peerId, msg);

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
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
    }
    setMediaStream(null);
    if (callChannelRef.current) {
      supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
    }
    setInviter(null);
    setReady(false);
    setCallStatus(manual ? "" : "ended");
    setMediaLoading(false);
    console.log("Cleaned up call state");
  }, [mediaStream, manual]);

  // -- Automatic start for open, UNLESS in manual mode
  useEffect(() => {
    if (!manual) {
      startLocalMedia().then(() => {
        setupSignaling().then(() => setReady(true));
      });
      return cleanup;
    }
    // otherwise only run cleanup on unmount
    return cleanup;
    // eslint-disable-next-line
  }, []);

  // Expose mediaLoading to UI
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
  };
};

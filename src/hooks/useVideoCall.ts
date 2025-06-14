
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
};

export const useVideoCall = ({
  roomId,
  userId,
  localVideoRef,
  onError,
  onStatusChange,
  onInviterChange,
}: UseVideoCallOptions) => {
  const [callStatus, setCallStatus] = useState<"idle" | "ringing" | "incoming" | "connecting" | "connected" | "ended">("idle");
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<{ [id: string]: PeerInfo }>({});
  const [inviter, setInviter] = useState<string | null>(null);
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 400 } },
        audio: true,
      });
      setMediaStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      onError?.("Could not access camera or microphone.");
      setCallStatus("ended");
    }
  }, [localVideoRef, onError]);

  // --- Signaling setup ---
  const setupSignaling = useCallback(async () => {
    const channel = supabase.channel(SIGNAL_CHANNEL, {
      config: { broadcast: { ack: true } }
    });

    channel
      .on("broadcast", { event: "groupcall" }, async (payload) => {
        const msg: GroupSignalData = payload.payload;
        if (msg.sender === userId) return;
        if (!mediaStream) return;
        if (msg.type === "invite" && callStatus === "idle") {
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
  }, [SIGNAL_CHANNEL, userId, mediaStream, callStatus, onError]);

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
  }, [userId]);

  // --- Accept/Decline handlers ---
  const acceptCall = useCallback(async () => {
    setCallStatus("connecting");
    callChannelRef.current?.send({
      type: "broadcast",
      event: "groupcall",
      payload: {
        type: "accept",
        sender: userId,
      },
    });
    await connectToPeer(inviter!, false);
  }, [userId, inviter]);

  const declineCall = useCallback(() => {
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
  }, [userId, inviter]);

  // --- PEER CONNECTION MANAGEMENT ---
  const connectToPeer = useCallback(async (peerId: string, isInitiator: boolean) => {
    if (peerRefs.current[peerId]) return;
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

  // --- Handle incoming offer/answer/ICE ---
  const handleSignal = useCallback(async (peerId: string, msg: GroupSignalData) => {
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
      } catch (e) {}
    }
  }, [connectToPeer, userId]);

  // --- CLEANUP ---
  const cleanup = useCallback(() => {
    Object.values(peerRefs.current).forEach(({ pc }) => pc.close());
    setPeers({});
    mediaStream?.getTracks().forEach((t) => t.stop());
    setMediaStream(null);
    if (callChannelRef.current) supabase.removeChannel(callChannelRef.current);
    setInviter(null);
    setCallStatus("ended");
  }, [mediaStream]);

  // -- Automatic start for open
  useEffect(() => {
    startLocalMedia().then(setupSignaling);
    return cleanup;
  }, []);

  return {
    callStatus,
    peers,
    inviter,
    mediaStream,
    inviteUsers,
    acceptCall,
    declineCall,
    cleanup,
  };
};

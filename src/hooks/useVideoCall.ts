
// Consolidates all video call logic by composing small hooks.
// Now much shorter and easier to maintain.

import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  PeerInfo,
  GroupSignalData,
  UseVideoCallOptions,
} from "./videoCallTypes";
import { usePeerConnections } from "./usePeerConnections";
import { useSignaling } from "./useSignaling";
import { useMediaStream } from "./useMediaStream";

export const useVideoCall = ({
  roomId,
  userId,
  localVideoRef,
  onError,
  onStatusChange,
  onInviterChange,
  manual = false,
}: UseVideoCallOptions) => {
  const [callStatus, setCallStatus] = useState<
    "idle" | "ringing" | "incoming" | "connecting" | "connected" | "ended" | ""
  >(manual ? "" : "idle");
  const [inviter, setInviter] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const callChannelRef = useRef<any>(null);
  const SIGNAL_CHANNEL = `video-signal-${roomId}`;
  const RTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  // --- MEDIA STREAM ---
  const {
    mediaStream,
    mediaLoading,
    localPreviewActive,
    startLocalPreview,
    stopLocalPreview,
    startLocalMedia,
    setMediaStream,
  } = useMediaStream({ userId, localVideoRef, onError });

  // --- PEERS ---
  const [connectedPeers, setConnectedPeers] = useState<Set<string>>(new Set());
  const {
    peers,
    peerRefs,
    connectToPeer,
    cleanupPeers,
    setPeers,
  } = usePeerConnections({
    userId,
    RTC_CONFIG,
    mediaStream,
    callChannelRef,
    onPeerConnected: (peerId) => {
      setConnectedPeers((prev) => new Set([...prev, peerId]));
      setCallStatus("connected");
    },
    onPeerDisconnected: (peerId) => {
      setConnectedPeers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(peerId);
        return newSet;
      });
    },
  });

  // --- SIGNALING ---
  const handleSignal = useCallback(
    async (peerId: string, msg: GroupSignalData) => {
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
        } catch (e) {
          console.error("Failed to add ICE candidate", e);
        }
      }
    },
    [peerRefs, connectToPeer, userId]
  );

  const { setupSignaling } = useSignaling({
    SIGNAL_CHANNEL,
    userId,
    mediaStream,
    callStatus,
    callChannelRef,
    onInvite: (sender) => {
      setInviter(sender);
      setCallStatus("incoming");
    },
    onDecline: (msg) => {
      setCallStatus("ended");
      onError?.("User declined.");
    },
    onAccept: async (sender) => {
      await connectToPeer(sender, true);
      setCallStatus("connecting");
    },
    onSignal: handleSignal,
    onSubscribed: () => {
      callChannelRef.current = callChannelRef.current;
      // Already handled
    },
    onError,
  });

  // --- CLEANUP ---
  const cleanup = useCallback(() => {
    cleanupPeers();
    setPeers({});
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
    // mediaLoading set by hook
  }, [cleanupPeers, setPeers, mediaStream, manual, localVideoRef, setMediaStream]);

  // --- Manual trigger logic ---
  const initializeMediaAndSignaling = useCallback(async () => {
    if (!ready) {
      if (!mediaStream) {
        await startLocalMedia();
      }
      await setupSignaling();
      setReady(true);
      // localPreviewActive managed by the hook
    }
  }, [ready, startLocalMedia, setupSignaling, mediaStream]);

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
    if (callChannelRef.current && inviter) {
      callChannelRef.current.send({
        type: "broadcast",
        event: "groupcall",
        payload: {
          type: "accept",
          sender: userId,
        },
      });
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
    cleanup();
  }, [userId, inviter, cleanup]);

  // Callbacks
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

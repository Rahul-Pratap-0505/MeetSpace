
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { GroupSignalData } from "./videoCallTypes";

// Sets up and manages Supabase real-time signaling channel
export const useSignaling = ({
  SIGNAL_CHANNEL,
  userId,
  mediaStream,
  callStatus,
  callChannelRef,
  onInvite,
  onDecline,
  onAccept,
  onSignal,
  onSubscribed,
  onError,
}) => {
  const setupSignaling = useCallback(async () => {
    if (callChannelRef.current) {
      try {
        supabase.removeChannel(callChannelRef.current);
      } catch { }
    }
    const channel = supabase.channel(SIGNAL_CHANNEL, {
      config: { broadcast: { ack: true } }
    });

    channel
      .on("broadcast", { event: "groupcall" }, async (payload) => {
        const msg: GroupSignalData = payload.payload;
        if (msg.sender === userId) return;
        if (!mediaStream) return;
        if (msg.type === "invite" && (callStatus === "idle" || callStatus === "")) onInvite(msg.sender);
        if (msg.type === "decline" && callStatus === "ringing") onDecline(msg);
        if (msg.type === "accept" && callStatus === "ringing") onAccept(msg.sender);
        if (msg.type === "signal") onSignal(msg.sender, msg);
      })
      .subscribe((s: any) => {
        if (s === "SUBSCRIBED") {
          callChannelRef.current = channel;
          onSubscribed();
        }
      });
  }, [
    SIGNAL_CHANNEL, userId, mediaStream, callStatus,
    callChannelRef, onInvite, onDecline, onAccept, onSignal, onSubscribed
  ]);

  return { setupSignaling };
};


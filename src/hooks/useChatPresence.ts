
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type UseChatPresenceOptions = {
  currentRoom: string;
  user: any;
};

export function useChatPresence({ currentRoom, user }: UseChatPresenceOptions) {
  const [presentUsers, setPresentUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<any>(null);

  // Presence/typing real-time logic
  useEffect(() => {
    if (!currentRoom || !user) return;
    const channel = supabase.channel(`presence-chat-${currentRoom}`, {
      config: { presence: { key: user.id } }
    });

    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      channel.track({ user_id: user.id, typing: false });
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as { [userId: string]: Array<{ user_id: string, typing?: boolean }> };
      const userStates = Object.values(state).flat();
      setPresentUsers(userStates.map((u) => u.user_id).filter(Boolean));
      setTypingUsers(userStates.filter((u) => u.typing && u.user_id !== user.id).map((u) => u.user_id));
    });

    channel.on("presence", { event: "join" }, ({ newPresences }) => {
      setPresentUsers((prev) =>
        Array.from(new Set([...prev, ...newPresences.map((p: any) => p.user_id)])));
    });
    channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
      setPresentUsers((prev) =>
        prev.filter(id => !leftPresences.some((lp: any) => lp.user_id === id))
      );
      setTypingUsers((prev) =>
        prev.filter(id => !leftPresences.some((lp: any) => lp.user_id === id))
      );
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom, user]);

  // For triggering own typing change
  const emitTyping = useCallback((isTyping: boolean) => {
    if (!currentRoom || !user) return;
    if (!typingChannelRef.current) {
      typingChannelRef.current = supabase.channel(`presence-chat-${currentRoom}`);
    }
    typingChannelRef.current.track({ user_id: user.id, typing: isTyping });
  }, [currentRoom, user]);

  const handleTypingStart = useCallback(() => {
    emitTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitTyping(false);
    }, 2500);
  }, [emitTyping]);

  const handleTypingStop = useCallback(() => {
    emitTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [emitTyping]);

  return {
    presentUsers,
    typingUsers,
    handleTypingStart,
    handleTypingStop,
  };
}

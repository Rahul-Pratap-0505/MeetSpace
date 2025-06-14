
import { useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

function isMessageObj(
  msg: any
): msg is { id: string; sender_id: string; content: string } {
  return (
    typeof msg === "object" &&
    msg !== null &&
    typeof msg.id === "string" &&
    "sender_id" in msg &&
    "content" in msg
  );
}

export function useSubscribeRoomMessages(setMessages: any) {
  const channelRef = useRef<any>(null);

  // Helper: safely checks message shape for optimistic replacement
  function isOptimisticMatch(msg: any, newMessage: any) {
    return (
      typeof msg === "object" &&
      msg &&
      typeof msg.id === "string" &&
      msg.id.startsWith("optimistic") &&
      "sender_id" in msg &&
      "content" in msg &&
      msg.sender_id === newMessage.sender_id &&
      msg.content === newMessage.content
    );
  }

  const subscribeToMessages = useCallback((currentRoom: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    if (!currentRoom) return;
    const channel = supabase
      .channel(`messages-${currentRoom}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${currentRoom}`,
        },
        async (payload) => {
          // Fetch profile for sender
          const { data: profileData } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", payload.new.sender_id)
            .single();

          const newMessage = {
            ...payload.new,
            profiles: profileData,
          };

          setMessages((prev: any[]) => {
            // Only run optimistic check for array entries that are real message objects
            const optimisticIdx = prev.findIndex(
              (msg) => isOptimisticMatch(msg, newMessage)
            );
            if (optimisticIdx !== -1) {
              return [
                ...prev.slice(0, optimisticIdx),
                newMessage,
                ...prev.slice(optimisticIdx + 1),
              ];
            } else {
              return [...prev, newMessage];
            }
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${currentRoom}`,
        },
        (payload) => {
          setMessages((prev: any[]) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [setMessages]);

  return subscribeToMessages;
}


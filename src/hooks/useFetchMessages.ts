
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  room_id: string;
  profiles?: {
    id: string;
    username: string;
    avatar_url: string | null;
  } | null;
};

export const useFetchMessages = (currentRoom: string) => {
  const fetchMessages = useCallback(async (prevMessages: Message[], setMessages: (cb: (msgs: Message[]) => Message[]) => void) => {
    if (!currentRoom) return;

    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", currentRoom)
        .order("created_at", { ascending: false });

      if (messagesError) throw messagesError;

      const senderIds = [...new Set(messagesData?.map((m) => m.sender_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", senderIds);

      if (profilesError) throw profilesError;

      let messagesWithProfiles =
        messagesData?.map((message) => ({
          ...message,
          profiles:
            profilesData?.find((profile) => profile.id === message.sender_id) || {
              id: message.sender_id,
              username: "Unknown",
              avatar_url: null,
            },
        })) || [];

      setMessages((prev) => {
        const optimistic = prev.filter((msg) => msg.id.startsWith("optimistic"));
        let updated = [...messagesWithProfiles];
        optimistic.forEach((optimisticMsg) => {
          const matchIdx = updated.findIndex(
            (m) =>
              m.sender_id === optimisticMsg.sender_id &&
              m.content === optimisticMsg.content
          );
          if (matchIdx === -1) {
            updated.unshift({
              ...optimisticMsg,
              profiles: {
                id: optimisticMsg.profiles?.id || optimisticMsg.sender_id,
                username: optimisticMsg.profiles?.username || "You",
                avatar_url: optimisticMsg.profiles?.avatar_url ?? null,
              },
            });
          }
        });
        updated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return updated;
      });
    } catch (err: any) {
      toast.error("Error fetching messages: " + err.message);
    }
  }, [currentRoom]);
  return fetchMessages;
};

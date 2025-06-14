
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function useFetchRoomMessages(setMessages: any) {
  return useCallback(async (currentRoom: string) => {
    if (!currentRoom) return;

    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", currentRoom)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      const senderIds = [
        ...new Set(messagesData?.map((m) => m.sender_id) || []),
      ];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", senderIds);

      if (profilesError) throw profilesError;

      let messagesWithProfiles =
        messagesData?.map((message) => ({
          ...message,
          file_url: message.file_url ?? null,
          file_type: message.file_type ?? null,
          profiles:
            profilesData?.find((profile) => profile.id === message.sender_id) || {
              id: message.sender_id,
              username: "Unknown",
              avatar_url: null,
            },
        })) || [];

      setMessages((prev: any[]) => {
        // retain optimistic
        const optimistic = prev.filter((msg) => msg.id.startsWith("optimistic"));
        let updated = [...messagesWithProfiles];
        optimistic.forEach((optimisticMsg) => {
          const matchIdx = updated.findIndex(
            (m) =>
              m.sender_id === optimisticMsg.sender_id &&
              m.content === optimisticMsg.content
          );
          if (matchIdx === -1) {
            updated.push({
              ...optimisticMsg,
              file_url: optimisticMsg.file_url ?? null,
              file_type: optimisticMsg.file_type ?? null,
              profiles: {
                id: optimisticMsg.profiles?.id || optimisticMsg.sender_id,
                username: optimisticMsg.profiles?.username || "You",
                avatar_url: optimisticMsg.profiles?.avatar_url ?? null,
              },
            });
          }
        });
        updated.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return updated;
      });

    } catch (err: any) {
      toast.error("Error fetching messages: " + err.message);
    }
  }, [setMessages]);
}

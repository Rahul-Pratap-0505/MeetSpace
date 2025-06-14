
import { useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Message } from "./useFetchMessages";

export const useSubscribeToMessages = ({
  currentRoom,
  setMessages,
}: {
  currentRoom: string;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}) => {
  const channelRef = useRef<any>(null);

  const subscribeToMessages = useCallback(() => {
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
          const { data: profileData } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", payload.new.sender_id)
            .single();

          const newMessage = {
            ...payload.new,
            profiles: profileData,
          } as Message;
          setMessages((prev) => {
            const optimisticIdx = prev.findIndex(
              (msg) =>
                msg.sender_id === newMessage.sender_id &&
                msg.content === newMessage.content &&
                msg.id.startsWith("optimistic")
            );
            if (optimisticIdx !== -1) {
              const updatedMessages = [...prev];
              updatedMessages[optimisticIdx] = newMessage;
              updatedMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              return updatedMessages;
            } else {
              const updatedMessages = [newMessage, ...prev];
              updatedMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              return updatedMessages;
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
          setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [currentRoom, setMessages]);

  return subscribeToMessages;
};

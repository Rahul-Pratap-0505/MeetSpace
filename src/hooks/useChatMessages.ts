
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Message = {
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

type Room = {
  id: string;
  name: string;
  created_at: string;
};

type UseChatMessagesProps = {
  currentRoom: string;
  user: any;
};

export function useChatMessages({ currentRoom, user }: UseChatMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);

  // Fetch messages for the room
  const fetchMessages = useCallback(async () => {
    if (!currentRoom) return;

    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", currentRoom)
        .order("created_at", { ascending: true });

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
              profiles: {
                id: optimisticMsg.profiles?.id || optimisticMsg.sender_id,
                username: optimisticMsg.profiles?.username || "You",
                avatar_url: optimisticMsg.profiles?.avatar_url ?? null,
              },
            });
          }
        });
        updated.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return updated;
      });
    } catch (err: any) {
      toast.error("Error fetching messages: " + err.message);
    }
  }, [currentRoom]);

  // Supabase Realtime subscription
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
          setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [currentRoom]);

  useEffect(() => {
    setLoading(true);
    fetchMessages().then(() => setLoading(false));
    const cleanup = subscribeToMessages();
    return () => {
      if (cleanup) cleanup();
    };
  }, [fetchMessages, subscribeToMessages]);

  // Sending a message with optimistic update
  const sendMessage = async (text: string, resetInput: () => void) => {
    if (!text.trim() || !currentRoom || !user) return;

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      sender_id: user.id,
      content: text.trim(),
      created_at: new Date().toISOString(),
      room_id: currentRoom,
      profiles: {
        id: user.id,
        username: user.user_metadata.username || user.email || "You",
        avatar_url: null,
      },
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    resetInput();

    try {
      const { error } = await supabase.from("messages").insert([
        {
          content: optimisticMessage.content,
          sender_id: user.id,
          room_id: currentRoom,
        },
      ]);
      if (error) throw error;
      if (messages.length === 0) fetchMessages();
    } catch (err: any) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      toast.error("Error sending message: " + err.message);
    }
  };

  return {
    messages,
    loading,
    sendMessage,
    fetchMessages,
    setMessages
  };
}

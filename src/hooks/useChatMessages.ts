
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
        .order("created_at", { ascending: false }); // Changed to false

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
            // Add optimistic messages to the start if they don't exist
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
        // Ensure overall sort is descending by created_at
        updated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
              // Replace optimistic message
              const updatedMessages = [...prev];
              updatedMessages[optimisticIdx] = newMessage;
              // Re-sort to ensure newest is at top
              updatedMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              return updatedMessages;
            } else {
              // Add new message to the start and re-sort
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
        avatar_url: null, // Assuming user avatar might not be immediately available client-side
      },
    };

    // Add optimistic message to the start of the array
    setMessages((prev) => [optimisticMessage, ...prev]);
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
      // No need to call fetchMessages here if realtime is working correctly
      // and optimistic update is replaced. If fetchMessages is needed, it would re-sort.
    } catch (err: any) {
      // Remove optimistic message on error
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

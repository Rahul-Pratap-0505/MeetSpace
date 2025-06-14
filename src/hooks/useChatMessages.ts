
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useFetchMessages, Message } from "./useFetchMessages";
import { useSubscribeToMessages } from "./useSubscribeToMessages";

type UseChatMessagesProps = {
  currentRoom: string;
  user: any;
};

export function useChatMessages({ currentRoom, user }: UseChatMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useFetchMessages(currentRoom);
  const subscribeToMessages = useSubscribeToMessages({ currentRoom, setMessages });

  useEffect(() => {
    setLoading(true);
    fetchMessages(messages, setMessages).then(() => setLoading(false));
    const cleanup = subscribeToMessages();
    return () => {
      if (cleanup) cleanup();
    };
    // eslint-disable-next-line
  }, [fetchMessages, subscribeToMessages]);

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

    setMessages((prev) => [optimisticMessage, ...prev]);
    resetInput();

    try {
      const { error } = await import("@/lib/supabase").then(m =>
        m.supabase.from("messages").insert([
          {
            content: optimisticMessage.content,
            sender_id: user.id,
            room_id: currentRoom,
          },
        ])
      );
      if (error) throw error;
    } catch (err: any) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      toast.error("Error sending message: " + err.message);
    }
  };

  return {
    messages,
    loading,
    sendMessage,
    fetchMessages: () => fetchMessages(messages, setMessages),
    setMessages,
  };
}

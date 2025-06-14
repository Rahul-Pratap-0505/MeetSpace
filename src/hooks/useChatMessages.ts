
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useFetchRoomMessages } from "./chat/useFetchRoomMessages";
import { useSubscribeRoomMessages } from "./chat/useSubscribeRoomMessages";
import { useSendMessage } from "./chat/useSendMessage";

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
  file_url?: string | null;
  file_type?: string | null;
};

type UseChatMessagesProps = {
  currentRoom: string;
  user: any;
};

export function useChatMessages({ currentRoom, user }: UseChatMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useFetchRoomMessages(setMessages);
  const subscribeToMessages = useSubscribeRoomMessages(setMessages);
  const sendMessage = useSendMessage({
    user,
    currentRoom,
    messages,
    setMessages,
    fetchMessages,
  });

  useEffect(() => {
    setLoading(true);
    fetchMessages(currentRoom).then(() => setLoading(false));
    const cleanup = subscribeToMessages(currentRoom);
    return () => {
      if (cleanup) cleanup();
    };
  }, [fetchMessages, subscribeToMessages, currentRoom]);

  return {
    messages,
    loading,
    sendMessage,
    fetchMessages: () => fetchMessages(currentRoom),
    setMessages,
  };
}

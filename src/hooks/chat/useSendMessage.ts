
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
  file_url?: string | null;
  file_type?: string | null;
};

export function useSendMessage({ user, currentRoom, messages, setMessages, fetchMessages }: any) {
  return async (
    text: string,
    resetInput: () => void,
    fileUrl?: string,
    fileType?: string
  ) => {
    if ((!text.trim() && !fileUrl) || !currentRoom || !user) return;

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      sender_id: user.id,
      content: text.trim() || (fileType?.startsWith("image/") ? "[Image]" : "[File]"),
      created_at: new Date().toISOString(),
      room_id: currentRoom,
      profiles: {
        id: user.id,
        username: user.user_metadata.username || user.email || "You",
        avatar_url: null,
      },
      file_url: typeof fileUrl === "string" ? fileUrl : null,
      file_type: typeof fileType === "string" ? fileType : null,
    };

    setMessages((prev: Message[]) => [...prev, optimisticMessage]);
    resetInput();

    try {
      const { error } = await supabase.from("messages").insert([
        {
          content: optimisticMessage.content,
          sender_id: user.id,
          room_id: currentRoom,
          file_url: optimisticMessage.file_url,
          file_type: optimisticMessage.file_type,
        },
      ]);
      if (error) throw error;
      if (messages.length === 0) fetchMessages();
    } catch (err: any) {
      setMessages((prev: Message[]) => prev.filter((msg) => msg.id !== optimisticId));
      toast.error("Error sending message: " + err.message);
    }
  };
}

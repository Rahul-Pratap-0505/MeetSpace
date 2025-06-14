import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import ChatSidebar from "@/components/ChatSidebar";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import { MessageCircle } from 'lucide-react'

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  room_id: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  } | null;
};

type Room = {
  id: string;
  name: string;
  created_at: string;
};

const ChatPage = () => {
  const { user, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState("");
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    fetchRooms();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (currentRoom) {
      fetchMessages();
      subscribeToMessages();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line
  }, [currentRoom]);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      setRooms(data || []);
      if (data && data.length > 0 && !currentRoom) {
        setCurrentRoom(data[0].id);
      }
    } catch (error: any) {
      toast.error("Error fetching rooms: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
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

      const messagesWithProfiles =
        messagesData?.map((message) => ({
          ...message,
          profiles: profilesData?.find((profile) => profile.id === message.sender_id) || null,
        })) || [];

      setMessages(messagesWithProfiles);
    } catch (error: any) {
      toast.error("Error fetching messages: " + error.message);
    }
  };

  const subscribeToMessages = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

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

          setMessages((prev) => [...prev, newMessage]);
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
  };

  const sendMessage = async (text: string, resetInput: () => void) => {
    if (!text.trim() || !currentRoom || !user) return;

    // Optimistic
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      sender_id: user.id,
      content: text.trim(),
      created_at: new Date().toISOString(),
      room_id: currentRoom,
      profiles: {
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

      setTimeout(() => {
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      }, 3000);

      if (messages.length === 0) fetchMessages();
    } catch (error: any) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      toast.error("Error sending message: " + error.message);
    }
  };

  const generateRoomAvatar = (roomName: string) => {
    const colors = [
      "from-blue-400 to-purple-500",
      "from-green-400 to-blue-500",
      "from-purple-400 to-pink-500",
      "from-yellow-400 to-orange-500",
      "from-red-400 to-pink-500",
      "from-indigo-400 to-purple-500",
    ];
    const colorIndex = roomName.length % colors.length;
    return colors[colorIndex];
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
    } catch (error: any) {
      toast.error("Error signing out: " + error.message);
    }
  };

  const handleRoomDeleted = () => {
    fetchRooms();
    if (rooms.length > 1) {
      const remainingRooms = rooms.filter((room) => room.id !== currentRoom);
      if (remainingRooms.length > 0) {
        setCurrentRoom(remainingRooms[0].id);
      } else {
        setCurrentRoom("");
        setMessages([]);
      }
    } else {
      setCurrentRoom("");
      setMessages([]);
    }
  };

  const handleMessageDeleted = () => {};

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <div className="w-8 h-8 bg-white rounded-full"></div>
          </div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
      <ChatSidebar
        user={user}
        rooms={rooms}
        currentRoom={currentRoom}
        setCurrentRoom={setCurrentRoom}
        handleSignOut={handleSignOut}
        fetchRooms={fetchRooms}
        handleRoomDeleted={handleRoomDeleted}
        generateRoomAvatar={generateRoomAvatar}
      />
      <div className="flex-1 flex flex-col">
        <ChatMessages
          messages={messages}
          userId={user?.id}
          rooms={rooms}
          currentRoom={currentRoom}
          generateRoomAvatar={generateRoomAvatar}
          handleMessageDeleted={handleMessageDeleted}
        />
        <ChatInput sendMessage={sendMessage} />
      </div>
    </div>
  );
};

export default ChatPage;

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import ChatSidebar from "@/components/ChatSidebar";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import { MessageCircle } from 'lucide-react'
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";
import { useState as useReactState } from "react";

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

const ChatPage = () => {
  const { user, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState("");
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);

  // UI STATE for sidebar visibility on small screens
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useReactState(!isMobile);

  // Responsive sidebar effect
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile, currentRoom]);

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
      // --- FIX: keep optimistic messages UNTIL replaced by real ones ---
      setMessages((prev) => {
        // gather any optimistic messages present in state
        const optimistic = prev.filter((msg) => msg.id.startsWith("optimistic"));
        // replace optimistic messages with real ones if present; else keep
        let updated = [...messagesWithProfiles];

        // Attempt to replace or add optimistic if not found among server messages
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
            console.log("Preserving optimistic message on reload:", optimisticMsg);
          } else {
            // Matched; do nothing, server message replaces optimistic
            console.log("Optimistic message matched with real message:", optimisticMsg);
          }
        });

        // Re-sort to preserve time order (if necessary)
        updated.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        return updated;
      });
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

          setMessages((prev) => {
            // Remove any optimistic message that matches this real message by content/sender/time delta
            const optimisticIdx = prev.findIndex(
              (msg) =>
                msg.sender_id === newMessage.sender_id &&
                msg.content === newMessage.content &&
                msg.id.startsWith("optimistic")
            );
            if (optimisticIdx !== -1) {
              // Replace the optimistic entry with the new one at the same position
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
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <div className="w-8 h-8 bg-white rounded-full"></div>
          </div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex w-full transition-colors duration-700">
      {/* Mobile sidebar and toggle button */}
      {isMobile && (
        <>
          <button
            className="fixed z-30 top-4 left-4 bg-white shadow-lg p-2 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
            style={{ display: sidebarOpen ? "none" : "flex" }}
          >
            <Menu className="text-blue-600" />
          </button>
          {/* Sidebar overlay */}
          <div
            className={`fixed inset-0 bg-black/30 z-20 backdrop-blur-sm transition-opacity duration-200 ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            onClick={() => setSidebarOpen(false)}
          />
        </>
      )}

      {/* Sidebar (animates on mobile) */}
      <div
        className={`
          z-30
          ${isMobile
            ? `fixed top-0 left-0 h-full transition-transform duration-300 bg-white/90 backdrop-blur-lg 
                shadow-xl w-64
                ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
                `
            : "relative w-80"}
          animate-fade-in
        `}
        style={isMobile ? { minHeight: "100vh" } : undefined}
      >
        <ChatSidebar
          user={user}
          rooms={rooms}
          currentRoom={currentRoom}
          setCurrentRoom={(id) => {
            setCurrentRoom(id);
            setSidebarOpen(false); // auto close drawer on mobile
          }}
          handleSignOut={handleSignOut}
          fetchRooms={fetchRooms}
          handleRoomDeleted={handleRoomDeleted}
          generateRoomAvatar={generateRoomAvatar}
          isMobile={isMobile}
          closeSidebar={() => setSidebarOpen(false)}
        />
      </div>
      {/* Main content region */}
      <div
        className={`
          flex-1 flex flex-col min-h-screen transition-all duration-500
          ${isMobile && sidebarOpen ? "pointer-events-none blur-sm scale-95" : ""}
        `}
      >
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

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
import { useChatMessages } from "@/hooks/useChatMessages";
import { useChatPresence } from "@/hooks/useChatPresence";

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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState("");
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useReactState(!isMobile);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]); // Only depend on isMobile

  useEffect(() => {
    fetchRooms();
    // eslint-disable-next-line
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRooms(data || []);
      if (data && data.length > 0 && !currentRoom) {
        setCurrentRoom(data[0].id);
      }
    } catch (error: any) {
      toast.error("Error fetching rooms: " + error.message);
    }
  };

  const { 
    messages,
    loading,
    sendMessage, 
    fetchMessages,
    setMessages 
  } = useChatMessages({ currentRoom, user });

  const { 
    presentUsers, 
    typingUsers,
    handleTypingStart,
    handleTypingStop
  } = useChatPresence({ currentRoom, user });

  useEffect(() => {
    if (currentRoom) {
      fetchMessages();
    }
  }, [currentRoom, fetchMessages]);

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

  // Memoize ChatSidebar to prevent unnecessary re-renders
  const MemoSidebar = React.useMemo(() => React.memo(ChatSidebar), []);

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
          <div
            className={`fixed inset-0 bg-black/30 z-20 backdrop-blur-sm transition-opacity duration-200 ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            onClick={() => setSidebarOpen(false)}
          />
        </>
      )}

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
        <MemoSidebar
          user={user}
          rooms={rooms}
          currentRoom={currentRoom}
          setCurrentRoom={(id) => {
            setCurrentRoom(id);
            // Only close sidebar on mobile if manually desired, not on every room change
            // setSidebarOpen(false); // Remove this to prevent sidebar flicker
          }}
          handleSignOut={handleSignOut}
          fetchRooms={fetchRooms}
          handleRoomDeleted={handleRoomDeleted}
          generateRoomAvatar={generateRoomAvatar}
          isMobile={isMobile}
          closeSidebar={() => setSidebarOpen(false)}
        />
      </div>
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
          typingUserIds={typingUsers}
          presentUsers={presentUsers}
        />
        <ChatInput
          sendMessage={sendMessage}
          presentUsers={presentUsers}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
        />
      </div>
    </div>
  );
};

export default ChatPage;

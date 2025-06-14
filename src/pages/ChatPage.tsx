import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  // Memoize Sidebar to avoid re-creation on every render
  const MemoSidebar = useMemo(() => React.memo(ChatSidebar), []);

  // Only auto-close/open sidebar when changing device (not every render)
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

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

  // ---- Flicker Fix: Use a transition state for messages ----
  const {
    messages,
    loading,
    sendMessage,
    fetchMessages,
    setMessages
  } = useChatMessages({ currentRoom, user });

  // Displayed messages shown in the chat UI, only updated after messages for new room are loaded
  const [displayedMessages, setDisplayedMessages] = useState<Message[]>([]);
  const [roomLoading, setRoomLoading] = useState(false);
  const lastRoomRef = useRef<string>("");

  useEffect(() => {
    // On room change, keep showing old messages until new ones are ready
    if (currentRoom && currentRoom !== lastRoomRef.current) {
      setRoomLoading(true);
    }
  }, [currentRoom]);

  useEffect(() => {
    if (!roomLoading) return;
    if (!loading) {
      // When new messages loaded, update displayed
      setDisplayedMessages(messages);
      setRoomLoading(false);
      lastRoomRef.current = currentRoom;
    }
    // When loading, keep displaying previous
  }, [messages, loading, roomLoading, currentRoom]);

  // When initially loaded, ensure displayedMessages is set at mount
  useEffect(() => {
    if (displayedMessages.length === 0 && messages.length && !loading) {
      setDisplayedMessages(messages);
      lastRoomRef.current = currentRoom;
    }
    // eslint-disable-next-line
  }, []);

  // Side effect: If user switches to a room for the first time
  useEffect(() => {
    if (currentRoom && !roomLoading && !loading && messages.length !== displayedMessages.length) {
      setDisplayedMessages(messages);
      lastRoomRef.current = currentRoom;
    }
    // eslint-disable-next-line
  }, [currentRoom, loading]);

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
    // Fix: also clear displayedMessages when all rooms gone
    setDisplayedMessages([]);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex w-full transition-colors duration-700">
      {isMobile && (
        <>
          {/* Floating menu button—only shown when sidebar is closed */}
          {!sidebarOpen && (
            <button
              className="fixed z-30 top-4 left-4 bg-white shadow-lg p-2 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="text-blue-600" />
            </button>
          )}
          {/* Sidebar overlay—persistent, controlled by sidebarOpen */}
          <div
            className={`
              fixed inset-0 z-20 bg-black/30
              backdrop-blur-sm transition-opacity duration-300
              ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
            `}
            onClick={() => setSidebarOpen(false)}
            aria-label="Sidebar overlay"
            style={{ touchAction: "none" }}
          />
        </>
      )}

      {/* Sidebar (always mounted, transitions handled by translate-x) */}
      <div
        className={`
          z-30
          ${isMobile
            ? `fixed top-0 left-0 h-full transition-transform duration-300 bg-white/90 backdrop-blur-lg shadow-xl w-64
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
            // Only close sidebar manually now
          }}
          handleSignOut={handleSignOut}
          fetchRooms={fetchRooms}
          handleRoomDeleted={handleRoomDeleted}
          generateRoomAvatar={generateRoomAvatar}
          isMobile={isMobile}
          closeSidebar={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main content blur only when overlay open */}
      <div
        className={`
          flex-1 flex flex-col min-h-screen transition-all duration-500
          ${isMobile && sidebarOpen ? "pointer-events-none blur-sm scale-95" : ""}
        `}
      >
        {/* ChatMessages: loading transition fix */}
        <ChatMessages
          messages={roomLoading ? displayedMessages : messages}
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


import React, { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MessageActions from "@/components/MessageActions";

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

export type ChatMessagesProps = {
  messages: Message[];
  userId: string | undefined;
  rooms: Room[];
  currentRoom: string;
  generateRoomAvatar: (name: string) => string;
  handleMessageDeleted: () => void;
  typingUserIds?: string[];
  presentUsers?: string[];
};

const ANIMATE_NEW_CLASS = "animate-fade-in";

const ChatMessages = ({
  messages,
  userId,
  rooms,
  currentRoom,
  generateRoomAvatar,
  handleMessageDeleted,
  typingUserIds = [],
  presentUsers = [],
}: ChatMessagesProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUserIds]);

  // Responsive minimum height for scroll area
  const scrollAreaMinHeight = "min-h-[250px] sm:min-h-[350px]";

  // Who is typing? Filter IDs to display names, exclude self
  let typingDisplay = null;
  if (typingUserIds.length) {
    // Try to show usernames if possible from presentUsers
    // Map IDs to "Someone" if can't resolve a username (you may want to improve this if you have a mapping)
    // Since we have no profiles lookup for presentUsers here, just show generic message
    typingDisplay =
      typingUserIds.length === 1
        ? `Someone is typing...`
        : `Several people are typing...`;
  }

  return (
    <>
      {/* Chat Header */}
      <div className="bg-white/80 dark:bg-muted/70 backdrop-blur-sm border-b border-gray-200 dark:border-border p-4 transition-colors duration-200">
        <div className="flex items-center space-x-3">
          {!!currentRoom && (
            <>
              <div
                className={`w-10 h-10 bg-gradient-to-r ${generateRoomAvatar(
                  rooms.find((r) => r.id === currentRoom)?.name || ""
                )} rounded-full flex items-center justify-center`}
              >
                <span className="text-white font-medium">
                  {rooms.find((r) => r.id === currentRoom)?.name?.charAt(0) || "R"}
                </span>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-foreground">
                  {rooms.find((r) => r.id === currentRoom)?.name || "Select a room"}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{messages.length} messages</p>
              </div>
            </>
          )}
        </div>
      </div>
      {/* Messages */}
      <ScrollArea className={`flex-1 p-4 ${scrollAreaMinHeight}`}>
        <div className="space-y-4">
          {messages.map((message, idx) => {
            const isOwn = message.sender_id === userId;
            // Apply entry animation to new messages (last entered)
            const animClass =
              idx >= messages.length - 3 ? ANIMATE_NEW_CLASS : ""; // Animate only last 3 for smoothness

            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"} group transition-all duration-150 ${animClass}`}
              >
                <div className={`flex space-x-2 max-w-xs lg:max-w-md ${isOwn ? "flex-row-reverse space-x-reverse" : ""}`}>
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={message.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white text-xs">
                      {message.profiles?.username?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div
                      className={`px-3 py-2 rounded-lg relative break-words transition-transform duration-150 shadow-sm
                        ${
                          isOwn
                            ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white animate-scale-in"
                            : "bg-white border shadow-sm animate-fade-in dark:bg-muted/60 dark:border-muted dark:text-foreground"
                        }
                        ${!isOwn ? "hover:dark:bg-muted/80 focus:dark:bg-muted/70 transition" : ""}
                      `}
                    >
                      <p className="text-sm">{message.content}</p>
                      {isOwn && (
                        <div className="absolute -top-2 -right-2">
                          <MessageActions
                            messageId={message.id}
                            isOwn={isOwn}
                            onMessageDeleted={handleMessageDeleted}
                          />
                        </div>
                      )}
                    </div>
                    <div className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${isOwn ? "text-right" : ""}`}>
                      <span className="font-medium">{message.profiles?.username || "Unknown"}</span>
                      <span className="ml-2">{new Date(message.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Typing indicator */}
          {typingDisplay && (
            <div className="flex items-center space-x-2 mt-2 mb-1 px-4">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 animate-pulse" />
              <span className="text-sm text-muted-foreground italic select-none">
                {typingDisplay}
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </>
  );
};

export default ChatMessages;

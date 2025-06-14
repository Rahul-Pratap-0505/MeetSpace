
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Video } from "lucide-react";
import VideoCallModal from "./VideoCallModal";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "react-router-dom";

type ChatInputProps = {
  sendMessage: (text: string, resetInput: () => void) => void;
  presentUsers: string[];
};

const ChatInput = ({ sendMessage, presentUsers }: ChatInputProps) => {
  const [input, setInput] = useState("");
  const [videoModal, setVideoModal] = useState(false);
  const [callSession, setCallSession] = useState<Date | null>(null); // Track call session to force modal open
  const { user } = useAuth();
  const params = useParams();
  const roomId = params?.roomId || "";

  // New: Open modal for a new call session
  const handleStartVideoCall = () => {
    setCallSession(new Date()); // unique session key per call
    setVideoModal(true);
  };

  const handleCloseModal = () => {
    setVideoModal(false);
    setCallSession(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input, () => setInput(""));
  };

  return (
    <div className="bg-white/80 dark:bg-muted/80 backdrop-blur-sm border-t border-gray-200 dark:border-border p-4 transition-shadow duration-150">
      <form
        onSubmit={handleSubmit}
        className="flex space-x-2 animate-fade-in"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 focus:border-blue-400 focus:ring-2 focus:ring-blue-300 transition-all duration-200 
            bg-white dark:bg-muted/60 dark:border-muted dark:text-foreground placeholder:text-gray-400 dark:placeholder:text-muted-foreground"
          autoComplete="off"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleStartVideoCall}
          className={`
            flex justify-center items-center
            border bg-gradient-to-r from-blue-200 to-purple-200
            hover:from-blue-300 hover:to-purple-300
            shadow-sm
            transition-all duration-200
            dark:bg-muted/70 dark:border-muted dark:text-foreground
            hover:dark:bg-muted/80
          `}
          aria-label="Start Video Call"
        >
          <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </Button>
        <Button
          type="submit"
          disabled={!input.trim()}
          className={`
            bg-gradient-to-r from-blue-500 to-purple-600 
            hover:from-blue-600 hover:to-purple-700
            focus-visible:ring-2 focus-visible:ring-purple-500
            transition-all duration-200
            active:scale-95 animate-scale-in
            dark:bg-gradient-to-r dark:from-blue-700 dark:to-purple-900
          `}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <VideoCallModal
        open={!!videoModal}
        onClose={handleCloseModal}
        roomId={roomId || ""}
        userId={user?.id || ""}
        presentUsers={presentUsers}
        callSession={callSession?.toISOString() ?? ""}
      />
    </div>
  );
};

export default ChatInput;

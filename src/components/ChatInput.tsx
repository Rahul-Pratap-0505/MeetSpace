
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Video } from "lucide-react";
import VideoCallModal from "./VideoCallModal";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "react-router-dom";

type ChatInputProps = {
  sendMessage: (text: string, resetInput: () => void) => void;
};

const ChatInput = ({ sendMessage }: ChatInputProps) => {
  const [input, setInput] = useState("");
  const [videoModal, setVideoModal] = useState(false);
  // Use AuthContext for user and current room
  const { user } = useAuth();
  const params = useParams();
  // fallback to a prop/passed roomId if needed
  const roomId = params?.roomId || "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input, () => setInput(""));
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm border-t border-gray-200 p-4 transition-shadow duration-150">
      <form
        onSubmit={handleSubmit}
        className="flex space-x-2 animate-fade-in"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 focus:border-blue-400 focus:ring-2 focus:ring-blue-300 transition-all duration-200"
          autoComplete="off"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setVideoModal(true)}
          className={`
            flex justify-center items-center
            border bg-gradient-to-r from-blue-200 to-purple-200
            hover:from-blue-300 hover:to-purple-300
            shadow-sm
            transition-all duration-200
            animate-bounce
          `}
          aria-label="Start Video Call"
        >
          <Video className="h-5 w-5 text-blue-600" />
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
          `}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
      {/* Video Call Modal - pass current user's id and current room */}
      <VideoCallModal
        open={videoModal}
        onClose={() => setVideoModal(false)}
        roomId={roomId || ""}
        userId={user?.id || ""}
      />
    </div>
  );
};

export default ChatInput;

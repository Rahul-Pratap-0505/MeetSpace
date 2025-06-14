
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Video, Paperclip, X } from "lucide-react";
import VideoCallModal from "./VideoCallModal";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type ChatInputProps = {
  sendMessage: (
    text: string,
    resetInput: () => void,
    fileUrl?: string,
    fileType?: string
  ) => void;
  presentUsers: string[];
  onTypingStart?: () => void;
  onTypingStop?: () => void;
};

const ChatInput = ({
  sendMessage,
  presentUsers,
  onTypingStart,
  onTypingStop,
}: ChatInputProps) => {
  const [input, setInput] = useState("");
  const [videoModal, setVideoModal] = useState(false);
  const [callSession, setCallSession] = useState<Date | null>(null);
  const { user } = useAuth();
  const params = useParams();
  const roomId = params?.roomId || "";

  // New: For files/images
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleStartVideoCall = () => {
    setCallSession(new Date());
    setVideoModal(true);
  };

  const handleCloseModal = () => {
    setVideoModal(false);
    setCallSession(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !selectedFile) return;

    let fileUrl: string | undefined = undefined;
    let fileType: string | undefined = undefined;

    if (selectedFile) {
      setUploading(true);
      const ext = selectedFile.name.split(".").pop();
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
      const { data, error } = await supabase.storage
        .from("chat-files")
        .upload(filename, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      setUploading(false);

      if (error) {
        toast.error("Failed to upload file: " + error.message);
        return;
      }

      // Public URL of the uploaded file
      fileUrl = supabase.storage.from("chat-files").getPublicUrl(filename).data.publicUrl;
      fileType = selectedFile.type;
    }

    sendMessage(input, () => setInput(""), fileUrl, fileType);

    if (onTypingStop) onTypingStop();
    setSelectedFile(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (onTypingStart) onTypingStart();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (onTypingStop) onTypingStop();
    }, 2200);
  };

  const handleBlur = () => {
    if (onTypingStop) onTypingStop();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const removeSelectedFile = () => setSelectedFile(null);

  return (
    <div className="bg-white/80 dark:bg-muted/80 backdrop-blur-sm border-t border-gray-200 dark:border-border p-4 transition-shadow duration-150">
      <form
        onSubmit={handleSubmit}
        className="flex space-x-2 animate-fade-in"
      >
        <Button
          type="button"
          variant="outline"
          className={`
            flex justify-center items-center
            border bg-gradient-to-r from-blue-100 to-purple-100
            hover:from-blue-300 hover:to-purple-300
            shadow-sm
            transition-all duration-200
            dark:bg-muted/70 dark:border-muted dark:text-foreground
            hover:dark:bg-muted/80
          `}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
          disabled={uploading}
        >
          <Paperclip className="h-5 w-5 text-blue-500" />
        </Button>
        <Input
          value={input}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={uploading ? "Uploading file..." : "Type a message..."}
          className="flex-1 focus:border-blue-400 focus:ring-2 focus:ring-blue-300 transition-all duration-200 
            bg-white dark:bg-muted/60 dark:border-muted dark:text-foreground placeholder:text-gray-400 dark:placeholder:text-muted-foreground"
          autoComplete="off"
          disabled={uploading}
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
          disabled={uploading}
        >
          <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </Button>
        <Button
          type="submit"
          disabled={(!input.trim() && !selectedFile) || uploading}
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
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
          tabIndex={-1}
        />
      </form>

      {/* Preview selected file */}
      {selectedFile && (
        <div className="mt-2 flex items-center bg-gray-100 rounded p-2 space-x-2">
          <span className="text-sm truncate max-w-[160px]">{selectedFile.name}</span>
          <Button type="button" size="icon" variant="ghost" onClick={removeSelectedFile}>
            <X size={16} />
          </Button>
        </div>
      )}

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

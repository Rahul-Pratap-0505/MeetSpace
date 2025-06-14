
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "react-router-dom";
import { useFileUpload } from "@/hooks/useFileUpload";
import SelectedFilePreview from "./SelectedFilePreview";

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
  const { user } = useAuth();
  const params = useParams();
  const roomId = params?.roomId || "";

  const {
    selectedFile,
    setSelectedFile,
    uploading,
    fileInputRef,
    handleFileChange,
    removeSelectedFile,
    uploadFile,
  } = useFileUpload();

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !selectedFile) return;

    let fileUrl: string | undefined = undefined;
    let fileType: string | undefined = undefined;

    if (selectedFile) {
      const { fileUrl: url, fileType: type, error } = await uploadFile();
      if (error) return; // error handled in the hook
      fileUrl = url;
      fileType = type;
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
        <SelectedFilePreview file={selectedFile} onRemove={removeSelectedFile} />
      )}
    </div>
  );
};

export default ChatInput;

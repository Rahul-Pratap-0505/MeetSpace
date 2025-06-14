
import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function useFileUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const removeSelectedFile = () => setSelectedFile(null);

  const uploadFile = async (): Promise<{fileUrl?: string, fileType?: string, error?: string}> => {
    if (!selectedFile) return {};
    setUploading(true);
    try {
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
        return { error: error.message };
      }
      const fileUrl = supabase.storage.from("chat-files").getPublicUrl(filename).data.publicUrl;
      return { fileUrl, fileType: selectedFile.type };
    } catch (err: any) {
      setUploading(false);
      return { error: err.message };
    }
  };

  return {
    selectedFile,
    setSelectedFile,
    uploading,
    setUploading,
    fileInputRef,
    handleFileChange,
    removeSelectedFile,
    uploadFile,
  };
}

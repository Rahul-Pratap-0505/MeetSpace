
import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type SelectedFilePreviewProps = {
  file: File;
  onRemove: () => void;
};

const SelectedFilePreview: React.FC<SelectedFilePreviewProps> = ({ file, onRemove }) => (
  <div className="mt-2 flex items-center bg-gray-100 rounded p-2 space-x-2">
    <span className="text-sm truncate max-w-[160px]">{file.name}</span>
    <Button type="button" size="icon" variant="ghost" onClick={onRemove}>
      <X size={16} />
    </Button>
  </div>
);

export default SelectedFilePreview;

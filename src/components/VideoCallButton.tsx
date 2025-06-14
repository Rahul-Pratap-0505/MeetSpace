
import React from "react";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";

type VideoCallButtonProps = {
  onStart: () => void;
  disabled?: boolean;
};

const VideoCallButton: React.FC<VideoCallButtonProps> = ({ onStart, disabled }) => (
  <Button
    className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-purple-600 hover:to-blue-600 text-white font-medium px-3 py-2 rounded shadow"
    onClick={onStart}
    disabled={disabled}
    title="Start video call"
  >
    <Video className="w-4 h-4" />
    Video Call
  </Button>
);

export default VideoCallButton;

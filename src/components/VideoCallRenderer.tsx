
import React from "react";
import { PeerInfo } from "@/hooks/videoCallTypes";

type Props = {
  callStatus: string;
  peers: { [id: string]: PeerInfo };
  inviter: string | null;
  localVideoRef: React.RefObject<HTMLVideoElement>;
};

const VideoCallRenderer: React.FC<Props> = ({
  callStatus,
  peers,
  inviter,
  localVideoRef,
}) => {
  // New: handle loaded metadata event
  const handleLoadedMetadata = () => {
    console.log("Local video element loaded metadata, ready to play!");
    localVideoRef.current?.play();
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Error with local webcam video", e);
  };

  const renderVideos = () => {
    const peerVideos = Object.values(peers).map(({ id, remoteVideoRef }) => (
      <div key={id} className="w-52 h-40 bg-gray-200 rounded-lg shadow flex items-center justify-center overflow-hidden ring-2 ring-purple-300 animate-fade-in mx-2">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          style={{ background: "#ccc" }}
        />
        <span className="absolute bottom-1 left-1 bg-black bg-opacity-30 px-2 rounded text-xs text-white">
          {id === inviter ? "Caller" : "User"}
        </span>
      </div>
    ));
    return (
      <div className="flex flex-wrap gap-3 items-center justify-center">
        <div className="w-52 h-40 bg-gray-200 rounded-lg shadow flex items-center justify-center overflow-hidden ring-2 ring-blue-300 animate-fade-in relative">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleVideoError}
            className="w-full h-full object-cover"
            style={{ background: "#ccc" }}
          />
          <span className="absolute bottom-1 left-1 bg-black bg-opacity-30 px-2 rounded text-xs text-white">You</span>
        </div>
        {peerVideos}
      </div>
    );
  };
  return renderVideos();
};
export default VideoCallRenderer;

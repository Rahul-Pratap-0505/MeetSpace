
import React from "react";

export type GroupSignalData = {
  type: "invite" | "accept" | "decline" | "signal";
  sender: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  target?: string;
};

export type PeerInfo = {
  id: string;
  pc: RTCPeerConnection;
  stream?: MediaStream;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
};

export type UseVideoCallOptions = {
  roomId: string;
  userId: string;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  onError?: (msg: string) => void;
  onStatusChange?: (status: string) => void;
  onInviterChange?: (id: string | null) => void;
  manual?: boolean;
};


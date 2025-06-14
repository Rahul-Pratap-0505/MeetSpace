
import { useRef, useState, useCallback } from "react";
import { PeerInfo } from "./videoCallTypes";

export const usePeerConnections = ({
  userId,
  RTC_CONFIG,
  mediaStream,
  callChannelRef,
  onPeerConnected,
  onPeerDisconnected,
}: {
  userId: string;
  RTC_CONFIG: RTCConfiguration;
  mediaStream: MediaStream | null;
  callChannelRef: React.MutableRefObject<any>;
  onPeerConnected: (peerId: string) => void;
  onPeerDisconnected: (peerId: string) => void;
}) => {
  const [peers, setPeers] = useState<{ [id: string]: PeerInfo }>({});
  const peerRefs = useRef<{ [id: string]: PeerInfo }>({});

  const connectToPeer = useCallback(
    async (peerId: string, isInitiator: boolean) => {
      if (peerRefs.current[peerId]) return;
      const pc = new RTCPeerConnection(RTC_CONFIG);
      mediaStream?.getTracks().forEach((track) => pc.addTrack(track, mediaStream));
      const remoteVideo = { current: document.createElement("video") } as React.RefObject<HTMLVideoElement>;

      pc.ontrack = (event) => {
        if (remoteVideo.current) {
          remoteVideo.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && callChannelRef.current) {
          callChannelRef.current.send({
            type: "broadcast",
            event: "groupcall",
            payload: {
              type: "signal",
              sender: userId,
              candidate: event.candidate,
              target: peerId,
            },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          onPeerConnected(peerId);
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          onPeerDisconnected(peerId);
          setPeers((p) => {
            delete p[peerId];
            return { ...p };
          });
          delete peerRefs.current[peerId];
        }
      };

      peerRefs.current[peerId] = { id: peerId, pc, remoteVideoRef: remoteVideo };
      setPeers((p) => ({ ...p, [peerId]: { id: peerId, pc, remoteVideoRef: remoteVideo } }));

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        callChannelRef.current?.send({
          type: "broadcast",
          event: "groupcall",
          payload: {
            type: "signal",
            sdp: offer,
            sender: userId,
            target: peerId,
          },
        });
      }
    },
    [mediaStream, userId, RTC_CONFIG, callChannelRef, onPeerConnected, onPeerDisconnected]
  );

  const cleanupPeers = useCallback(() => {
    Object.values(peerRefs.current).forEach(({ pc }) => pc.close());
    setPeers({});
    peerRefs.current = {};
  }, []);

  return { peers, peerRefs, connectToPeer, cleanupPeers, setPeers };
};


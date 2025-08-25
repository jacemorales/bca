export const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302"] }
    // Add TURN servers here for production NAT traversal
  ]
};

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection(rtcConfig);
}

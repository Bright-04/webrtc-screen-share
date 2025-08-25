const socket = io('http://localhost:5000');

const shareBtn = document.getElementById('shareBtn');
const localVid = document.getElementById('localVid');

let pc = null;
let localStream = null;
let pendingIce = [];

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function createPC() {
  pc = new RTCPeerConnection(configuration);

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit('ice-candidate', { candidate: e.candidate });
  };

  pc.onconnectionstatechange = () => {
    console.log('admin pc connectionState', pc.connectionState);
    socket.emit('client-log', { role: 'admin', msg: `pc connectionState ${pc.connectionState}` });
  };

  pc.oniceconnectionstatechange = () => {
    console.log('admin pc iceConnectionState', pc.iceConnectionState);
    socket.emit('client-log', { role: 'admin', msg: `pc iceConnectionState ${pc.iceConnectionState}` });
  };

  pc.onnegotiationneeded = () => {
    console.log('admin: negotiationneeded');
    socket.emit('client-log', { role: 'admin', msg: 'negotiationneeded' });
  };

  // apply any pending remote ICE candidates
  if (pendingIce.length) {
    pendingIce.forEach(async (c) => {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn('admin add pending candidate failed', e); }
    });
    pendingIce = [];
  }

  return pc;
}

async function share() {
  try {
    localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    localVid.srcObject = localStream;

    createPC();
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
  socket.emit('offer', { sdp: pc.localDescription });
  socket.emit('client-log', { role: 'admin', msg: 'sent offer' });
  } catch (err) {
    console.error('share error', err);
  }
}

socket.on('answer', async (data) => {
  if (!pc) return;
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
  } catch (err) { console.error(err); }
});

socket.on('ice-candidate', async (data) => {
  // buffer candidates if pc not yet created
  if (!pc) {
    console.log('admin: buffering ice candidate until pc is ready');
    pendingIce.push(data.candidate);
    return;
  }

  try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { console.warn('admin addIceCandidate error', e); }
});

shareBtn.addEventListener('click', share);

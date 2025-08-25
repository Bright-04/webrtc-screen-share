const socket = io('http://localhost:5000');
const remoteVid = document.getElementById('remoteVid');
const pcStateEl = document.getElementById('pcState');
const logsEl = document.getElementById('logs');

let pc = null;
let pendingIce = [];
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function createPC() {
  pc = new RTCPeerConnection(configuration);

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit('ice-candidate', { candidate: e.candidate });
  };

  pc.ontrack = (e) => {
    console.log('viewer: ontrack, streams:', e.streams);
    if (e.streams && e.streams[0]) remoteVid.srcObject = e.streams[0];
    socket.emit('client-log', { role: 'viewer', msg: 'ontrack received' });
    // try to ensure playback
    setTimeout(() => {
      if (remoteVid.srcObject) {
        remoteVid.play().then(() => socket.emit('client-log', { role: 'viewer', msg: 'remoteVid.play() succeeded' })).catch((err) => socket.emit('client-log', { role: 'viewer', msg: 'remoteVid.play() failed: ' + err }));
      }
    }, 100);
  if (logsEl) logsEl.innerText += `\nontrack received`;
  };

  pc.onconnectionstatechange = () => {
    console.log('viewer pc connectionState', pc.connectionState);
    socket.emit('client-log', { role: 'viewer', msg: `pc connectionState ${pc.connectionState}` });
  if (pcStateEl) pcStateEl.textContent = pc.connectionState;
  if (logsEl) logsEl.innerText += `\npc state: ${pc.connectionState}`;
  };

  pc.oniceconnectionstatechange = () => {
    console.log('viewer pc iceConnectionState', pc.iceConnectionState);
    socket.emit('client-log', { role: 'viewer', msg: `pc iceConnectionState ${pc.iceConnectionState}` });
  if (pcStateEl) pcStateEl.textContent = pc.iceConnectionState;
  if (logsEl) logsEl.innerText += `\nice state: ${pc.iceConnectionState}`;
  };

  pc.onnegotiationneeded = () => {
    console.log('viewer: negotiationneeded');
    socket.emit('client-log', { role: 'viewer', msg: 'negotiationneeded' });
  };

  // apply any buffered candidates
  if (pendingIce.length) {
    pendingIce.forEach(async (c) => {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn('viewer add pending candidate failed', e); }
    });
    pendingIce = [];
  }

  return pc;
}

socket.on('offer', async (data) => {
  try {
    createPC();
    console.log('viewer: received offer');
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', { sdp: pc.localDescription });
  } catch (err) { console.error('handle offer error', err); }
});

socket.on('ice-candidate', async (data) => {
  if (!pc) {
    console.log('viewer: buffering ice candidate until pc is ready');
    pendingIce.push(data.candidate);
    return;
  }

  try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { console.warn('viewer addIceCandidate error', e); }
});

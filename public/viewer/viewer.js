// signaling server: use ?signal=<url> to override (e.g. ?signal=https://abcd1234.ngrok.io)
const _signalParam = new URLSearchParams(window.location.search).get('signal');
const _defaultSignal = `${location.protocol}//${location.hostname}:5000`;
const _signalUrl = _signalParam || _defaultSignal;
console.info('viewer signaling url:', _signalUrl);
const socket = io(_signalUrl);
const remoteVid = document.getElementById('remoteVid');
const pcStateEl = document.getElementById('pcState');
const fsBtn = document.getElementById('fsBtn');

let pc = null;
let pendingIce = [];
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function createPC() {
  pc = new RTCPeerConnection(configuration);

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      // can't know admin id here; server will broadcast viewer's ice from viewer to admin(s) when answering
      socket.emit('ice-candidate', { candidate: e.candidate });
    }
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
  // no-op for logs (UI simplified)
  };

  pc.onconnectionstatechange = () => {
    console.log('viewer pc connectionState', pc.connectionState);
    socket.emit('client-log', { role: 'viewer', msg: `pc connectionState ${pc.connectionState}` });
  if (pcStateEl) pcStateEl.textContent = pc.connectionState;
  };

  pc.oniceconnectionstatechange = () => {
    console.log('viewer pc iceConnectionState', pc.iceConnectionState);
    socket.emit('client-log', { role: 'viewer', msg: `pc iceConnectionState ${pc.iceConnectionState}` });
  if (pcStateEl) pcStateEl.textContent = pc.iceConnectionState;
  };

  pc.onnegotiationneeded = () => {
    console.log('viewer: negotiationneeded');
    socket.emit('client-log', { role: 'viewer', msg: 'negotiationneeded' });
  };

  // apply any buffered candidates
  if (pendingIce.length) {
    await Promise.all(pendingIce.map(async (item) => {
      try { await pc.addIceCandidate(new RTCIceCandidate(item.candidate)); } catch (e) { console.warn('viewer add pending candidate failed', e); }
    }));
    pendingIce = [];
  }

  return pc;
}
// register as viewer so admins get notified
socket.emit('register', { role: 'viewer' });

socket.on('offer', async (data) => {
  try {
    await createPC();
    console.log('viewer: received offer');
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
  // send answer targeted to the offering admin
  socket.emit('answer', { to: data.from, sdp: pc.localDescription });
  } catch (err) { console.error('handle offer error', err); }
});

socket.on('ice-candidate', async (data) => {
  // server forwards ice-candidate with { from }
  const from = data && data.from;
  if (!pc) {
    console.log('viewer: buffering ice candidate until pc is ready');
    pendingIce.push({ candidate: data.candidate, from });
    return;
  }

  try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { console.warn('viewer addIceCandidate error', e); }
});

// fullscreen button
if (fsBtn) {
  fsBtn.addEventListener('click', async () => {
    try {
  const el = remoteVid;
  if (el.requestFullscreen) await el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (e) { console.warn('fullscreen failed', e); }
  });
}

// ensure we close pc on page unload so server notifies admins quickly
window.addEventListener('beforeunload', () => {
  try { if (pc) pc.close(); } catch (e) { /* ignore */ }
});

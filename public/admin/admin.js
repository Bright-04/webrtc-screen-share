// signaling server: use ?signal=<url> to override (e.g. ?signal=https://abcd1234.ngrok.io)
const _signalParam = new URLSearchParams(window.location.search).get('signal');
// default to same origin (so when viewer+signaling are exposed via one host/ngrok, clients connect there)
const _defaultSignal = `${location.protocol}//${location.host}`;
const _signalUrl = _signalParam || _defaultSignal;
console.info('admin signaling url:', _signalUrl);
const socket = io(_signalUrl);

const shareBtn = document.getElementById('shareBtn');
const localVid = document.getElementById('localVid');
const pcStateEl = document.getElementById('pcState');

// per-viewer peer connections
const pcs = new Map(); // viewerId -> { pc, pendingIce: [] }
let localStream = null;

// register as admin so server knows
socket.emit('register', { role: 'admin' });

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function createPCFor(viewerId) {
  const pc = new RTCPeerConnection(configuration);
  const state = { pc, pendingIce: [] };

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit('ice-candidate', { to: viewerId, candidate: e.candidate });
  };

  pc.onconnectionstatechange = () => {
    console.log('admin pc connectionState', viewerId, pc.connectionState);
    socket.emit('client-log', { role: 'admin', msg: `pc ${viewerId} connectionState ${pc.connectionState}` });
    if (pcStateEl) pcStateEl.textContent = pc.connectionState;
  };

  pc.oniceconnectionstatechange = () => {
    console.log('admin pc iceConnectionState', viewerId, pc.iceConnectionState);
    socket.emit('client-log', { role: 'admin', msg: `pc ${viewerId} iceConnectionState ${pc.iceConnectionState}` });
    if (pcStateEl) pcStateEl.textContent = pc.iceConnectionState;
  };

  // apply any pending remote ICE candidates later
  state.applyPending = async () => {
    if (state.pendingIce.length) {
      for (const c of state.pendingIce) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn('admin add pending candidate failed', e); }
      }
      state.pendingIce = [];
    }
  };

  pcs.set(viewerId, state);
  return state;
}

async function share() {
  try {
    localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    localVid.srcObject = localStream;

    // add tracks to all existing peer connections
    for (const [viewerId, state] of pcs.entries()) {
      state.pc = state.pc || createPCFor(viewerId).pc;
      localStream.getTracks().forEach((t) => state.pc.addTrack(t, localStream));

      const offer = await state.pc.createOffer();
      await state.pc.setLocalDescription(offer);
      socket.emit('offer', { to: viewerId, sdp: state.pc.localDescription });
      socket.emit('client-log', { role: 'admin', msg: `sent offer to ${viewerId}` });
    }
  } catch (err) {
    console.error('share error', err);
  }
}

socket.on('answer', async (data) => {
  // answers are targeted: data.from contains viewer id
  const from = data && data.from;
  if (!from) return;
  const state = pcs.get(from);
  if (!state || !state.pc) {
    console.warn('answer received but no pc for', from);
    return;
  }
  try {
    await state.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    await state.applyPending();
    socket.emit('client-log', { role: 'admin', msg: `setRemoteDescription(answer) from ${from}` });
  } catch (err) { console.error(err); }
});

socket.on('ice-candidate', async (data) => {
  const from = data && data.from;
  if (!from) return;
  const state = pcs.get(from);
  if (!state || !state.pc) {
    // buffer until pc exists
    console.log('admin: buffering ice candidate for', from);
    if (state) state.pendingIce.push(data.candidate);
    return;
  }

  try { await state.pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { console.warn('admin addIceCandidate error', e); }
});

// handle viewer-joined: create pc and send offer once admin is sharing
socket.on('viewer-joined', async (data) => {
  const id = data && data.id;
  if (!id) return;
  console.log('viewer joined:', id);
  // create pc state
  const state = createPCFor(id);
  if (localStream) {
    localStream.getTracks().forEach((t) => state.pc.addTrack(t, localStream));
    const offer = await state.pc.createOffer();
    await state.pc.setLocalDescription(offer);
    socket.emit('offer', { to: id, sdp: state.pc.localDescription });
    socket.emit('client-log', { role: 'admin', msg: `sent offer to ${id}` });
  }
});

// server may send a list of existing viewers when admin registers
socket.on('existing-viewers', (data) => {
  const viewers = data && data.viewers;
  if (!viewers || !viewers.length) return;
  console.log('existing viewers:', viewers);
  for (const id of viewers) {
    // create pc for each existing viewer and if already sharing, send offer
    const state = pcs.get(id) || createPCFor(id);
    if (localStream) {
      localStream.getTracks().forEach((t) => state.pc.addTrack(t, localStream));
      state.pc.createOffer().then(async (offer) => {
        await state.pc.setLocalDescription(offer);
        socket.emit('offer', { to: id, sdp: state.pc.localDescription });
        socket.emit('client-log', { role: 'admin', msg: `sent offer to existing viewer ${id}` });
      }).catch((e) => console.warn('offer to existing viewer failed', e));
    }
  }
});

// handle viewer leaving: cleanup per-viewer pc
socket.on('viewer-left', (data) => {
  const id = data && data.id;
  if (!id) return;
  console.log('viewer left:', id);
  const state = pcs.get(id);
  if (state) {
    try { state.pc.close(); } catch (e) { /* ignore */ }
    pcs.delete(id);
    socket.emit('client-log', { role: 'admin', msg: `cleaned up pc for ${id}` });
  }
});

shareBtn.addEventListener('click', share);

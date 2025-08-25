const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const SIGNALING_PORT = 5000;
const ADMIN_PORT = 3000;
const VIEWER_PORT = 4000;

// Signaling server (Socket.io)
const signalingApp = express();
const signalingServer = http.createServer(signalingApp);
const io = new Server(signalingServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });

io.on('connection', (socket) => {
  console.log('signaling connected:', socket.id);
  // track roles
  socket.role = null;

  // register role: { role: 'admin'|'viewer' }
    socket.on('register', (data) => {
      socket.role = data && data.role;
      console.log(`socket ${socket.id} registered as ${socket.role}`);
      if (socket.role === 'viewer') {
        // notify all connected admins about this new viewer
        for (const [id, s] of io.sockets.sockets) {
          if (s.role === 'admin') s.emit('viewer-joined', { id: socket.id });
        }
      }
      if (socket.role === 'admin') {
        // send existing viewers list to the admin so they can immediately offer
        const viewers = [];
        for (const [id, s] of io.sockets.sockets) {
          if (s.role === 'viewer') viewers.push(id);
        }
        if (viewers.length) socket.emit('existing-viewers', { viewers });
      }
    });

    // handle disconnects to let admins clean up per-viewer peer connections
    socket.on('disconnect', () => {
      console.log('signaling disconnected:', socket.id, socket.role);
      if (socket.role === 'viewer') {
        for (const [id, s] of io.sockets.sockets) {
          if (s.role === 'admin') s.emit('viewer-left', { id: socket.id });
        }
      }
    });

  // targeted signaling: data must include `to` socket id
  socket.on('offer', (data) => {
    console.log(`received offer from ${socket.id} -> ${data && data.to}`);
    if (data && data.to) io.to(data.to).emit('offer', { from: socket.id, sdp: data.sdp });
  });

  socket.on('answer', (data) => {
    console.log(`received answer from ${socket.id} -> ${data && data.to}`);
    if (data && data.to) io.to(data.to).emit('answer', { from: socket.id, sdp: data.sdp });
  });

  socket.on('ice-candidate', (data) => {
    console.log(`received ice-candidate from ${socket.id} -> ${data && data.to}`);
    if (data && data.to && data.candidate) io.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
  });

  socket.on('client-log', (data) => {
    // data: { role, msg }
    console.log(`client-log [${socket.id}] ${data && data.role}: ${data && data.msg}`);
  });
});

signalingServer.listen(SIGNALING_PORT, () => console.log(`Signaling server: http://localhost:${SIGNALING_PORT}`));

// Admin app (sharer) on port 3000
const adminApp = express();
adminApp.use(express.static(path.join(__dirname, 'public', 'admin')));
adminApp.listen(ADMIN_PORT, () => console.log(`Admin (sharer) app: http://localhost:${ADMIN_PORT}`));

// Viewer app on port 4000
const viewerApp = express();
viewerApp.use(express.static(path.join(__dirname, 'public', 'viewer')));
viewerApp.listen(VIEWER_PORT, () => console.log(`Viewer app: http://localhost:${VIEWER_PORT}`));

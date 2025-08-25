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
  socket.on('offer', (data) => {
    console.log(`received offer from ${socket.id}`);
    socket.broadcast.emit('offer', { from: socket.id, sdp: data.sdp });
  });

  socket.on('answer', (data) => {
    console.log(`received answer from ${socket.id}`);
    socket.broadcast.emit('answer', { from: socket.id, sdp: data.sdp });
  });

  socket.on('ice-candidate', (data) => {
    console.log(`received ice-candidate from ${socket.id}`);
    // guard: ensure candidate exists
    if (data && data.candidate) socket.broadcast.emit('ice-candidate', { from: socket.id, candidate: data.candidate });
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

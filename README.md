# webrtc-screen-share
Minimal WebRTC + Express app for browser-based screen sharing.

## Features

- Admin (sharer) app served on http://localhost:3000
- Viewer app served on http://localhost:4000
- Single signaling server (socket.io) on http://localhost:5000

## Setup

1. Install dependencies

	npm install

2. Run the server (this starts admin, viewer, and signaling servers)

	node server.js

## Usage

1. Open http://localhost:3000 in the browser (admin) and click "Share Screen".
2. Open http://localhost:4000 in another tab or browser (viewer) to see the shared screen.

## License

MIT

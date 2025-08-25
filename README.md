# webrtc-screen-share
Minimal WebRTC + Express app for browser-based screen sharing.

## Features

- Admin (sharer) app served on http://localhost:3000
- Viewer app served on http://localhost:4000
- Single signaling server (socket.io) on http://localhost:5000
- Single signaling server (socket.io) on http://localhost:5000 (configurable for tunneling)

## Setup

1. Install dependencies

	npm install

2. Run the server (this starts admin, viewer, and signaling servers)

	node server.js

## Usage

1. Open http://localhost:3000 in the browser (admin) and click "Share Screen".
2. Open http://localhost:4000 in another tab or browser (viewer) to see the shared screen.

## Using ngrok (tunnel for remote viewers)

Two approaches work:

- Expose the signaling server (recommended): run `ngrok http 5000` and use the returned ngrok URL as the signaling URL in both admin and viewer pages. For example: `https://abc123.ngrok.io` then open `http://localhost:3000/?signal=https://abc123.ngrok.io` and `http://localhost:4000/?signal=https://abc123.ngrok.io`.

- Expose only the viewer page: run `ngrok http 4000` and send the viewer ngrok URL to remote users, but you must also expose the signaling server (5000) or provide the signaling ngrok URL via the `?signal=` query parameter when opening the viewer page remotely. Example (viewer only exposed): `https://xyz456.ngrok.io/?signal=https://abc123.ngrok.io` where `https://abc123.ngrok.io` is an ngrok URL for your signaling server.

Notes:
- For simple local testing you can omit `?signal` and clients will default to `http(s)://<host>:5000`.
- For production or public testing across NATs you will likely need a TURN server (not included in this demo).

## License

MIT

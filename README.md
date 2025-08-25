# webrtc-screen-share
Minimal browser-based screen-sharing demo using WebRTC, Express and socket.io for signaling.

This repo provides two frontends plus a signaling server:
- Admin (sharer) UI: serves on http://localhost:3000
- Viewer UI + signaling (socket.io): serves on http://localhost:4000

By default the viewer server also hosts the signaling socket — this lets you expose a single port (4000) via a tunnel like ngrok so remote users can open one URL and join the stream.

Quick start (local)
1. Install dependencies

	npm install

2. Run the app

	npm run dev

3. Admin (sharer): open the admin UI and start sharing

	http://localhost:3000

4. Viewer: open the viewer UI

	http://localhost:4000

By default clients connect their signaling socket to the page origin. The admin UI accepts an optional `?signal=` query parameter so you can point the admin's signaling socket at a tunneled viewer host (see ngrok below).

Using ngrok (single-tunnel viewer + signaling)
1. Start the server locally (step 2 above).
2. Expose the viewer server (which now includes signaling) via ngrok:

```powershell
ngrok http 4000
```

3. ngrok will print a public URL, e.g. `https://abcd1234.ngrok.io`. Give remote viewers that URL (they should open it directly):

```
https://abcd1234.ngrok.io
```

4. On your admin machine (local), open the admin UI and set the signaling endpoint to the ngrok host so offers/answers are routed through the same signaling server:

```
http://localhost:3000/?signal=https://abcd1234.ngrok.io
```

5. Click "Share Screen" on the admin page. Remote viewers who opened the ngrok URL should receive the stream.

Notes and troubleshooting
- If a remote viewer can't see the stream, open DevTools on the viewer and check the Console for the logged `viewer signaling url:` value and for socket.io connection errors.
- On the admin side use the `?signal=` param so the admin connects to the same signaling endpoint as viewers.
- If ICE is not completing (hangs), your network likely needs TURN. Add a TURN server to the `iceServers` configuration in both client files.
- The demo uses a public STUN server only. TURN is required for many NAT/firewall setups.
- Autoplay: the viewer video element is muted to allow autoplay in most browsers.

Security and production
- This demo is for local testing and learning. Do not expose this unprotected signaling endpoint to the public in production.
- Add auth, rate limiting and a proper TURN server before using in the real world.

If you want, I can add a small debug panel showing socket IDs and recent signaling messages in the admin/viewer UI.

## License

MIT

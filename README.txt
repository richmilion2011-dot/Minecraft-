VOXEL WORLD — coded lobby multiplayer
=====================================
- index.html: original VOXEL WORLD gameplay/controls plus lobby code UI.
- server.js: Socket.IO server, six-digit room codes, player positions, shared block edits.
- package.json: server dependencies.

Deploy server by updating the GitHub repo connected to Render:
Build Command: npm install
Start Command: npm start
Then wait for Render status Live.

Deploy game by uploading index.html to your existing Netlify site (replace old index.html).

How to play:
1. Open the Netlify game on device A.
2. Keep Server URL as https://minecraft-.onrender.com, enter nickname, tap "Создать лобби".
3. Send the six-digit code displayed in the status message to your friend.
4. Device B opens the same Netlify game, enters nickname and code, taps "Войти по коду".
5. Both players should see each other and share block edits.

Saving:
- Server writes room seeds, block edits and last known player positions to worlds.json.
- Important limitation: Render free Web Service storage is ephemeral. Data may be lost after redeploy/replacement/restart. Durable saving across those events requires persistent storage (Render disk/DB or another database). This prototype has not been end-to-end tested on two real devices.
- Solo worlds remain in browser localStorage; online worlds are server-side rooms.
- Check https://minecraft-demo.onrender.com/health for server status.

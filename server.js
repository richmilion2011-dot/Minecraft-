// VOXEL WORLD — coded lobbies, shared world edits and best-effort JSON persistence.
const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] }, maxHttpBufferSize: 2e6 });
const PORT = process.env.PORT || 3000;
const STORE = process.env.WORLD_STORE_PATH || path.join(__dirname, "worlds.json");
const rooms = new Map(), players = new Map();
function cleanNick(v) { return String(v || "Игрок").replace(/[<>]/g, "").trim().slice(0, 16) || "Игрок"; }
function cleanCode(v) { return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); }
function persist() {
  try {
    const obj = {};
    for (const [code, r] of rooms) obj[code] = { seed: r.seed, blocks: [...r.blocks.values()], spawns: r.spawns || {} };
    fs.writeFileSync(STORE, JSON.stringify(obj), "utf8");
  } catch (e) { console.error("Could not persist worlds:", e.message); }
}
function restore() {
  try {
    const obj = JSON.parse(fs.readFileSync(STORE, "utf8"));
    for (const [code, r] of Object.entries(obj)) rooms.set(code, {
      seed: Number(r.seed) || 1,
      blocks: new Map((r.blocks || []).map(b => [`${b.x},${b.y},${b.z}`, b])),
      spawns: r.spawns || {}
    });
    console.log(`Restored ${rooms.size} saved world(s)`);
  } catch (_) {}
}
function newCode() { let code; do { code = String(Math.floor(100000 + Math.random() * 900000)); } while (rooms.has(code)); return code; }
function spawnFor(r, nick) { const p = r.spawns[nick]; return p && Number.isFinite(p.x) ? p : { x: 8.5, y: 40, z: 8.5, yaw: 0, pitch: 0 }; }
app.get("/", (_req, res) => res.type("text").send("VOXEL WORLD multiplayer server is running."));
app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size, players: players.size }));
restore();
io.on("connection", socket => {
  function enter(code, nick) {
    const room = rooms.get(code);
    if (!room) { socket.emit("roomError", "Такого лобби нет. Проверь код или создай новое."); return; }
    const old = players.get(socket.id); if (old) { socket.leave(old.room); players.delete(socket.id); }
    const spawn = spawnFor(room, nick);
    const p = { id: socket.id, room: code, nick, x: spawn.x, y: spawn.y, z: spawn.z, yaw: spawn.yaw || 0, pitch: spawn.pitch || 0 };
    players.set(socket.id, p); socket.join(code);
    socket.emit("roomJoined", { room: code, seed: room.seed, blocks: [...room.blocks.values()], spawn,
      players: [...players.values()].filter(q => q.room === code && q.id !== socket.id) });
    socket.to(code).emit("playerJoined", p);
  }
  socket.on("createRoom", data => {
    const code = newCode(), seed = 1 + Math.floor(Math.random() * 2147483000);
    rooms.set(code, { seed, blocks: new Map(), spawns: {} });
    const nick = cleanNick(data && data.nick), spawn = { x: 8.5, y: 40, z: 8.5, yaw: 0, pitch: 0 };
    players.set(socket.id, { id: socket.id, room: code, nick, ...spawn }); socket.join(code); persist();
    socket.emit("roomCreated", { room: code, seed, spawn });
  });
  socket.on("joinRoom", data => {
    const code = cleanCode(data && data.room), nick = cleanNick(data && data.nick);
    if (!code || !rooms.has(code)) { socket.emit("roomError", "Лобби с таким кодом не найдено. Попроси друга создать лобби заново."); return; }
    enter(code, nick);
  });
  socket.on("move", data => {
    const p = players.get(socket.id); if (!p || !data) return;
    for (const k of ["x", "y", "z", "yaw", "pitch"]) if (Number.isFinite(Number(data[k]))) p[k] = Number(data[k]);
    const r = rooms.get(p.room); if (r) r.spawns[p.nick] = { x:p.x, y:p.y, z:p.z, yaw:p.yaw, pitch:p.pitch };
    socket.to(p.room).emit("playerMoved", p);
  });
  socket.on("blockChanged", b => {
    const p = players.get(socket.id); if (!p || !b) return;
    const x=Number(b.x), y=Number(b.y), z=Number(b.z), id=Number(b.id);
    if (![x,y,z,id].every(Number.isFinite) || ![x,y,z,id].every(Number.isInteger) || y<0 || y>=64 || Math.abs(x)>100000 || Math.abs(z)>100000 || id<0 || id>10) return;
    const r=rooms.get(p.room); if (!r) return;
    const block={x,y,z,id}, key=`${x},${y},${z}`;
    // Keep id=0 tombstones too: otherwise a removed generated-terrain block
    // would reappear when a friend loads the procedural world again.
    r.blocks.set(key,block);
    persist(); socket.to(p.room).emit("blockChanged",block);
  });
  socket.on("disconnect", () => {
    const p=players.get(socket.id);
    if(p) { const r=rooms.get(p.room); if(r){r.spawns[p.nick]={x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch};persist();}
      socket.to(p.room).emit("playerLeft",socket.id); players.delete(socket.id); }
  });
});
server.listen(PORT, "0.0.0.0", () => console.log(`VOXEL WORLD server listening on ${PORT}`));

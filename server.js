const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Tự động tìm đúng file Index.html hoặc index.html (tránh lỗi phân biệt chữ hoa/thường trên Linux/Render)
function resolveHtmlFile() {
  const candidates = ["Index.html", "index.html", "saigon.html"];
  for (const name of candidates) {
    const fullPath = path.join(__dirname, name);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return path.join(__dirname, "Index.html");
}

app.get("/", (req, res) => {
  res.sendFile(resolveHtmlFile());
});

app.use(express.static(__dirname));

const players = {};

io.on("connection", (socket) => {
  players[socket.id] = {
    started: false,
    clientInstanceId: null,
    x: 0,
    y: 0,
    z: 2,
    rotY: 0,
    speedRatio: 0,
    isRiding: false,
    posture: "stand",
    inCathedral: false,
    inBitexco: false,
    bubbleText: "",
    charConfig: null
  };

  const broadcastActivePlayers = () => {
    const activeOnly = {};
    for (const [id, p] of Object.entries(players)) {
      if (p && p.started === true && p.charConfig && typeof p.charConfig === "object") {
        activeOnly[id] = p;
      }
    }
    io.emit("state", activeOnly);
  };

  socket.on("player_update", (data) => {
    if (!players[socket.id] || !data || typeof data !== "object") return;
    if (data.started !== true || !data.charConfig || typeof data.charConfig !== "object") {
      players[socket.id].started = false;
      broadcastActivePlayers();
      return;
    }

    players[socket.id].started = true;
    if (typeof data.clientInstanceId === "string") players[socket.id].clientInstanceId = data.clientInstanceId;
    if (typeof data.x === "number") players[socket.id].x = data.x;
    if (typeof data.y === "number") players[socket.id].y = data.y;
    if (typeof data.z === "number") players[socket.id].z = data.z;
    if (typeof data.rotY === "number") players[socket.id].rotY = data.rotY;
    if (typeof data.speedRatio === "number") players[socket.id].speedRatio = data.speedRatio;
    players[socket.id].isRiding = Boolean(data.isRiding);
    if (typeof data.posture === "string") players[socket.id].posture = data.posture;
    players[socket.id].inCathedral = Boolean(data.inCathedral);
    players[socket.id].inBitexco = Boolean(data.inBitexco);
    if (typeof data.bubbleText === "string") players[socket.id].bubbleText = data.bubbleText.slice(0, 100);
    players[socket.id].charConfig = data.charConfig;

    broadcastActivePlayers();
  });

  socket.on("player_leave", () => {
    delete players[socket.id];
    broadcastActivePlayers();
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    broadcastActivePlayers();
  });
});

  // Xóa người chơi khỏi bản đồ khi thoát tab/mất kết nối
  socket.on("disconnect", () => {
    const leavingPlayer = players[socket.id];
    const leavingInstanceId = leavingPlayer && leavingPlayer.clientInstanceId;
    delete players[socket.id];
    if (typeof leavingInstanceId === "string") {
      for (const [id, p] of Object.entries(players)) {
        if (p && p.clientInstanceId === leavingInstanceId) {
          delete players[id];
        }
      }
    }
    io.emit("state", players);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sai Gon Chill server đang chạy tại cổng ${PORT}`);
});

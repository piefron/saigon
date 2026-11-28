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

  io.emit("state", players);

  // Nhận cập nhật vị trí, tư thế, bong bóng chat & ngoại hình nhân vật
  socket.on("player_update", (data) => {
    if (!players[socket.id] || !data || typeof data !== "object") return;

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
    if (data.charConfig && typeof data.charConfig === "object") {
      players[socket.id].charConfig = data.charConfig;
    }

    socket.broadcast.emit("state", players);
  });

  // Chuyển tiếp bong bóng chat trên đầu nhân vật kèm senderId
  socket.on("chat_message", (payload) => {
    if (!payload || typeof payload.text !== "string") return;
    const text = payload.text.trim().slice(0, 100);
    if (!text) return;

    const sender = typeof payload.sender === "string" && payload.sender.trim()
      ? payload.sender.trim().slice(0, 24)
      : "Player";

    socket.broadcast.emit("chat_message", {
      senderId: socket.id,
      clientInstanceId: payload.clientInstanceId || null,
      sender,
      text
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

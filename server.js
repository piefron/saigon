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
  const candidates = ["Index.html", "index.html"];
  for (const name of candidates) {
    const fullPath = path.join(__dirname, name);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return path.join(__dirname, "Index.html");
}

app.get("/", (req, res) => {
  res.sendFile(resolveHtmlFile());
});

// Phục vụ thêm các tài nguyên tĩnh khác nếu có trong cùng thư mục
app.use(express.static(__dirname));

const players = {};

io.on("connection", (socket) => {
  players[socket.id] = {
    x: 0,
    y: 0,
    z: 2,
    rotY: 0,
    speedRatio: 0,
    isRiding: false,
    posture: "stand",
    inCathedral: false,
    charConfig: null
  };

  // Gửi danh sách người chơi hiện tại cho tất cả client
  io.emit("state", players);

  // Nhận cập nhật vị trí, tư thế, trang phục từ từng người chơi
  socket.on("player_update", (data) => {
    if (!players[socket.id] || !data || typeof data !== "object") return;

    if (typeof data.x === "number") players[socket.id].x = data.x;
    if (typeof data.y === "number") players[socket.id].y = data.y;
    if (typeof data.z === "number") players[socket.id].z = data.z;
    if (typeof data.rotY === "number") players[socket.id].rotY = data.rotY;
    if (typeof data.speedRatio === "number") players[socket.id].speedRatio = data.speedRatio;
    players[socket.id].isRiding = Boolean(data.isRiding);
    if (typeof data.posture === "string") players[socket.id].posture = data.posture;
    players[socket.id].inCathedral = Boolean(data.inCathedral);
    if (data.charConfig && typeof data.charConfig === "object") {
      players[socket.id].charConfig = data.charConfig;
    }

    socket.broadcast.emit("state", players);
  });

  // Chuyển tiếp tin nhắn chat cộng đồng tới những người chơi khác
  socket.on("chat_message", (payload) => {
    if (!payload || typeof payload.text !== "string") return;
    const text = payload.text.trim().slice(0, 140);
    if (!text) return;

    const sender = typeof payload.sender === "string" && payload.sender.trim()
      ? payload.sender.trim().slice(0, 24)
      : "Player";

    socket.broadcast.emit("chat_message", { sender, text });
  });

  // Xóa người chơi khỏi bản đồ khi thoát
  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("state", players);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sai Gon Chill server đang chạy tại cổng ${PORT}`);
});

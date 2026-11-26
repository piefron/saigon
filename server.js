const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

const players = {};

io.on("connection", (socket) => {
  players[socket.id] = {
    x: Math.floor(Math.random() * 300) + 30,
    y: Math.floor(Math.random() * 200) + 30,
    color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"),
  };
  io.emit("state", players);

  socket.on("move", (pos) => {
    if (players[socket.id]) {
      players[socket.id].x = pos.x;
      players[socket.id].y = pos.y;
      io.emit("state", players);
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("state", players);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Running on " + PORT));

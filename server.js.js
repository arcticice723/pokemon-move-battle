const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server);

app.use(express.static(__dirname));

const rooms = {};

io.on("connection", (socket) => {

  console.log("A player connected!");

  socket.on("createRoom", (roomCode) => {

    socket.join(roomCode);

    rooms[roomCode] = {
      usedMoves: [],
      currentPlayer: 1
    };

    socket.emit("roomCreated", roomCode);
  });

  socket.on("joinRoom", (roomCode) => {

    const room = rooms[roomCode];

    if (!room) {

      socket.emit(
        "errorMessage",
        "Room not found"
      );

      return;
    }

    socket.join(roomCode);

    io.to(roomCode).emit("gameStart");
  });

  socket.on("submitMove", (data) => {

    const room = rooms[data.roomCode];

    if (!room) return;

    const move = data.move.toLowerCase();

    if (room.usedMoves.includes(move)) {

      socket.emit(
        "errorMessage",
        "Move already used!"
      );

      return;
    }

    room.usedMoves.push(move);

    room.currentPlayer =
      room.currentPlayer === 1 ? 2 : 1;

    io.to(data.roomCode).emit(
      "moveAccepted",
      {
        move: data.move,
        usedMoves: room.usedMoves,
        currentPlayer: room.currentPlayer
      }
    );
  });

  socket.on("disconnect", () => {

    console.log(
      "A player disconnected!"
    );
  });
});

server.listen(3000, () => {

  console.log(
    "Server running on port 3000"
  );
});
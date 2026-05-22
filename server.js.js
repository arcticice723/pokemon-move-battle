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
      player1: socket.id,
      player2: null,
      currentPlayer: 1,
      usedMoves: []
    };

    socket.emit("playerNumber", 1);

    console.log(`Room created: ${roomCode}`);
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

    if (room.player2) {

      socket.emit(
        "errorMessage",
        "Room is full"
      );

      return;
    }

    room.player2 = socket.id;

    socket.join(roomCode);

    socket.emit("playerNumber", 2);

    io.to(roomCode).emit("gameStart");

    console.log(`Player joined room: ${roomCode}`);
  });

  socket.on("submitMove", (data) => {

    const room = rooms[data.roomCode];

    if (!room) return;

    let playerNumber = null;

    if (socket.id === room.player1) {
      playerNumber = 1;
    }

    if (socket.id === room.player2) {
      playerNumber = 2;
    }

    if (playerNumber !== room.currentPlayer) {

      socket.emit(
        "errorMessage",
        "Not your turn!"
      );

      return;
    }

    const move =
      data.move.toLowerCase();

    if (room.usedMoves.includes(move)) {

      socket.emit(
        "errorMessage",
        "Move already used!"
      );

      return;
    }

    room.usedMoves.push(move);

    room.currentPlayer =
      room.currentPlayer === 1
        ? 2
        : 1;

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
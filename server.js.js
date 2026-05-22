const express = require("express");

const http = require("http");

const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server);

const PORT =
  process.env.PORT || 3000;

app.use(express.static(__dirname));

const rooms = {};

io.on("connection", socket => {

  console.log("A player connected!");

  socket.on(
    "createRoom",
    data => {

      const roomCode =
        data.roomCode;

      if (rooms[roomCode]) {

        socket.emit(
          "errorMessage",
          "Room code already exists."
        );

        return;
      }

      socket.join(roomCode);

      rooms[roomCode] = {

        player1: {
          id: socket.id,

          username:
            data.username
        },

        player2: null,

        currentPlayer: 1,

        usedMoves: [],

        timerStarted: false
      };

      socket.emit(
        "playerNumber",
        1
      );

      io.to(roomCode).emit(
        "updatePlayers",
        {
          player1:
            data.username,

          player2: null
        }
      );

      console.log(
        `Room created: ${roomCode}`
      );
    }
  );

  socket.on(
    "joinRoom",
    data => {

      const room =
        rooms[data.roomCode];

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

      room.player2 = {

        id: socket.id,

        username:
          data.username
      };

      socket.join(
        data.roomCode
      );

      socket.emit(
        "playerNumber",
        2
      );

      io.to(
        data.roomCode
      ).emit(
        "updatePlayers",
        {
          player1:
            room.player1
              .username,

          player2:
            room.player2
              .username
        }
      );

      io.to(
        data.roomCode
      ).emit(
        "gameStart"
      );

      console.log(
        `Player joined room ${data.roomCode}`
      );
    }
  );

  socket.on(
    "startTimer",
    roomCode => {

      const room =
        rooms[roomCode];

      if (!room) return;

      if (
        room.timerStarted
      ) return;

      room.timerStarted =
        true;

      io.to(roomCode).emit(
        "startTimer"
      );
    }
  );

  socket.on(
    "submitMove",
    data => {

      const room =
        rooms[data.roomCode];

      if (!room) return;

      let playerNumber =
        null;

      if (
        room.player1 &&
        socket.id ===
        room.player1.id
      ) {

        playerNumber = 1;
      }

      if (
        room.player2 &&
        socket.id ===
        room.player2.id
      ) {

        playerNumber = 2;
      }

      if (
        playerNumber !==
        room.currentPlayer
      ) {

        socket.emit(
          "errorMessage",
          "Not your turn!"
        );

        return;
      }

      const move =
        data.move
          .toLowerCase();

      if (
        room.usedMoves.includes(
          move
        )
      ) {

        socket.emit(
          "errorMessage",
          "Move already used!"
        );

        return;
      }

      room.usedMoves.push(
        move
      );

      room.currentPlayer =
        room.currentPlayer === 1
          ? 2
          : 1;

      io.to(
        data.roomCode
      ).emit(
        "moveAccepted",
        {
          move: data.move,

          usedMoves:
            room.usedMoves,

          currentPlayer:
            room.currentPlayer
        }
      );
    }
  );

  socket.on(
    "disconnect",
    () => {

      console.log(
        "A player disconnected!"
      );

      for (
        const roomCode in rooms
      ) {

        const room =
          rooms[roomCode];

        if (
          room.player1 &&
          room.player1.id ===
            socket.id
        ) {

          io.to(roomCode).emit(
            "errorMessage",
            "Player 1 disconnected."
          );

          delete rooms[roomCode];

          console.log(
            `Deleted room ${roomCode}`
          );
        }

        else if (
          room.player2 &&
          room.player2.id ===
            socket.id
        ) {

          io.to(roomCode).emit(
            "errorMessage",
            "Player 2 disconnected."
          );

          room.player2 =
            null;

          io.to(roomCode).emit(
            "updatePlayers",
            {
              player1:
                room.player1
                  .username,

              player2:
                "Waiting..."
            }
          );

          room.timerStarted =
            false;

          room.currentPlayer =
            1;
        }
      }
    }
  );

});

server.listen(
  PORT,
  () => {

    console.log(
      `Server running on port ${PORT}`
    );
  }
);
const express = require("express");

const http = require("http");

const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server);

const PORT =
  process.env.PORT || 3000;

app.use(express.static(__dirname));

const MAX_PLAYERS = 8;

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

        players: [
          {
            id: socket.id,
            username:
              data.username
          }
        ],

        currentPlayer: 0,

        usedMoves: [],

        timerStarted: false
      };

      socket.emit(
        "playerNumber",
        1
      );

      io.to(roomCode).emit(
        "updatePlayers",
        rooms[roomCode]
          .players
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

      if (
        room.players.length >=
        MAX_PLAYERS
      ) {

        socket.emit(
          "errorMessage",
          "Room is full"
        );

        return;
      }

      room.players.push({
        id: socket.id,
        username:
          data.username
      });

      socket.join(
        data.roomCode
      );

      socket.emit(
        "playerNumber",
        room.players.length
      );

      io.to(
        data.roomCode
      ).emit(
        "updatePlayers",
        room.players
      );

      if (
        room.players.length >= 2
      ) {

        io.to(
          data.roomCode
        ).emit(
          "gameStart"
        );
      }

      console.log(
        `${data.username} joined room ${data.roomCode}`
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

      const playerIndex =
        room.players.findIndex(
          player =>
            player.id ===
            socket.id
        );

      if (
        playerIndex === -1
      ) return;

      if (
        playerIndex !==
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
        (
          room.currentPlayer + 1
        ) %
        room.players.length;

      io.to(
        data.roomCode
      ).emit(
        "moveAccepted",
        {
          move: data.move,

          usedMoves:
            room.usedMoves,

          currentPlayer:
            room.currentPlayer,

          currentUsername:
            room.players[
              room.currentPlayer
            ].username
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

        const playerIndex =
          room.players.findIndex(
            player =>
              player.id ===
              socket.id
          );

        if (
          playerIndex !== -1
        ) {

          const disconnectedPlayer =
            room.players[
              playerIndex
            ].username;

          room.players.splice(
            playerIndex,
            1
          );

          io.to(roomCode).emit(
            "errorMessage",
            `${disconnectedPlayer} disconnected.`
          );

          io.to(roomCode).emit(
            "updatePlayers",
            room.players
          );

          if (
            room.players.length === 0
          ) {

            delete rooms[
              roomCode
            ];

            console.log(
              `Deleted room ${roomCode}`
            );

            continue;
          }

          if (
            room.currentPlayer >=
            room.players.length
          ) {

            room.currentPlayer =
              0;
          }

          room.timerStarted =
            false;

          break;
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
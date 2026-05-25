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

function generateRoomCode() {

  return Math.floor(
    10000 +
    Math.random() * 90000
  ).toString();
}

io.on("connection", socket => {

  console.log("A player connected!");

  socket.on(
    "createRoom",
    data => {

      let roomCode =
        generateRoomCode();

      while (
        rooms[roomCode]
      ) {

        roomCode =
          generateRoomCode();
      }

      rooms[roomCode] = {

        players: [
          {
            id: socket.id,
            username:
              data.username
          }
        ],

        maxPlayers:
          data.maxPlayers,

        currentPlayer: 0,

        usedMoves: [],

        timer: 60,

        timerStarted: false,

        timerInterval: null,

        gameStarted: false,

        gameOver: false
      };

      socket.join(roomCode);

      socket.emit(
        "roomCreated",
        roomCode
      );

      socket.emit(
        "playerNumber",
        0
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
        room.gameStarted
      ) {

        socket.emit(
          "errorMessage",
          "Game already started"
        );

        return;
      }

      if (
        room.players.length >=
        room.maxPlayers
      ) {

        socket.emit(
          "errorMessage",
          "Room is full"
        );

        return;
      }

      if (
        room.players.some(
          p =>
            p.username
              .toLowerCase() ===
            data.username
              .toLowerCase()
        )
      ) {

        socket.emit(
          "errorMessage",
          "Username already taken"
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
        "joinSuccess"
      );

      socket.emit(
        "playerNumber",
        room.players.length - 1
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

        room.gameStarted =
          true;

        io.to(
          data.roomCode
        ).emit(
          "gameStart",
          {
            currentPlayer:
              room.currentPlayer,

            currentUsername:
              room.players[0]
                .username,

            timer:
              room.timer
          }
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
        "timerUpdate",
        room.timer
      );

      room.timerInterval =
        setInterval(() => {

          room.timer--;

          io.to(roomCode).emit(
            "timerUpdate",
            room.timer
          );

          if (
            room.timer <= 0
          ) {

            clearInterval(
              room.timerInterval
            );

            room.gameOver =
              true;

            io.to(roomCode).emit(
              "gameOver",
              {
                loser:
                  room.players[
                    room.currentPlayer
                  ].username
              }
            );
          }

        }, 1000);
    }
  );

  socket.on(
    "submitMove",
    data => {

      const room =
        rooms[data.roomCode];

      if (!room) return;

      if (
        room.gameOver
      ) return;

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

      const moveLower =
        data.move
          .toLowerCase();

      if (
        room.usedMoves.some(
          move =>
            move.toLowerCase() ===
            moveLower
        )
      ) {

        socket.emit(
          "errorMessage",
          "Move already used!"
        );

        return;
      }

      room.usedMoves.push(
        data.move
      );

      room.currentPlayer =
        (
          room.currentPlayer + 1
        ) %
        room.players.length;

      room.timer = 60;

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
            ].username,

          timer:
            room.timer
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

            clearInterval(
              room.timerInterval
            );

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
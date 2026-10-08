const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static(__dirname));
app.get("/health", (_req, res) => res.status(200).json({ status: "ok", app: "Nexus" }));
app.get("/pokemon-move-battle", (_req, res) => res.sendFile(path.join(__dirname, "pokemon.html")));
app.get("/character-guess", (_req, res) => res.sendFile(path.join(__dirname, "character-guess.html")));

const rooms = Object.create(null);
const guessRooms = Object.create(null);
const characters = [
 {name:"Pikachu",genre:"Anime",franchise:"Pokémon"},{name:"Ash Ketchum",genre:"Anime",franchise:"Pokémon"},{name:"Mewtwo",genre:"Anime",franchise:"Pokémon"},
 {name:"Mario",genre:"Video Games",franchise:"Nintendo"},{name:"Link",genre:"Video Games",franchise:"Nintendo"},{name:"Kirby",genre:"Video Games",franchise:"Nintendo"},{name:"Samus Aran",genre:"Video Games",franchise:"Nintendo"},
 {name:"Sonic",genre:"Video Games",franchise:"Sonic"},{name:"Tails",genre:"Video Games",franchise:"Sonic"},{name:"Knuckles",genre:"Video Games",franchise:"Sonic"},
 {name:"Steve",genre:"Video Games",franchise:"Minecraft"},{name:"Alex",genre:"Video Games",franchise:"Minecraft"},
 {name:"Spider-Man",genre:"Comics",franchise:"Marvel"},{name:"Iron Man",genre:"Movies",franchise:"Marvel"},{name:"Black Panther",genre:"Movies",franchise:"Marvel"},{name:"Thor",genre:"Comics",franchise:"Marvel"},
 {name:"Batman",genre:"Comics",franchise:"DC"},{name:"Superman",genre:"Comics",franchise:"DC"},{name:"Wonder Woman",genre:"Comics",franchise:"DC"},{name:"The Flash",genre:"TV",franchise:"DC"},
 {name:"Darth Vader",genre:"Movies",franchise:"Star Wars"},{name:"Luke Skywalker",genre:"Movies",franchise:"Star Wars"},{name:"Yoda",genre:"Movies",franchise:"Star Wars"},
 {name:"SpongeBob SquarePants",genre:"Cartoons",franchise:"Nickelodeon"},{name:"Patrick Star",genre:"Cartoons",franchise:"Nickelodeon"},
 {name:"Shrek",genre:"Movies",franchise:"DreamWorks"},{name:"Po",genre:"Movies",franchise:"DreamWorks"},
 {name:"Elsa",genre:"Movies",franchise:"Disney"},{name:"Mickey Mouse",genre:"Cartoons",franchise:"Disney"},
 {name:"Naruto Uzumaki",genre:"Anime",franchise:"Anime"},{name:"Goku",genre:"Anime",franchise:"Anime"},{name:"Sailor Moon",genre:"Anime",franchise:"Anime"},
 {name:"Wednesday Addams",genre:"TV",franchise:"Wednesday"},{name:"Eleven",genre:"TV",franchise:"Stranger Things"}
];
function generateRoomCode(pool) { let code; do { code=String(Math.floor(10000+Math.random()*90000)); } while(pool[code]); return code; }
function cleanName(value) { return String(value || "").trim().slice(0,20); }
function publicPlayers(room) { return room.players.map(p=>({id:p.id,username:p.username})); }
function clearRoomTimer(room) { if(room.timerInterval) clearInterval(room.timerInterval); }
function endRoomIfEmpty(code, pool) { const room=pool[code]; if(room && room.players.length===0){clearRoomTimer(room);delete pool[code];} }
function filteredCharacters(filters) {
 let pool=characters.filter(c=>(!filters.genre||filters.genre==="all"||c.genre===filters.genre)&&(!filters.franchise||filters.franchise==="all"||c.franchise===filters.franchise));
 return pool.length ? pool : characters;
}
function assignCharacters(room) {
 const pool=filteredCharacters(room.filters);
 room.players.forEach((p,i)=>{p.character=pool[(Math.floor(Math.random()*pool.length)+i)%pool.length].name;});
}
function nextGuessTurn(room) {
 if(!room.players.length)return;
 for(let step=1;step<=room.players.length;step++){
   const idx=(room.currentTurn+step)%room.players.length;
   if(!room.players[idx].solved){room.currentTurn=idx;return;}
 }
 room.finished=true;
}
function sendGuessState(code) {
 const room=guessRooms[code];if(!room)return;
 room.players.forEach(player=>{
   const otherCharacters=room.players.filter(p=>p.id!==player.id).map(p=>({id:p.id,username:p.username,character:p.character||"Waiting…",solved:!!p.solved}));
   const current=room.players[room.currentTurn];
   const pending=room.pendingQuestion;
   const answers=pending?Object.values(pending.answers):[];
   io.to(player.id).emit("guessState",{
     players:publicPlayers(room),filters:room.filters,myCharacter:room.started?player.character:null,otherCharacters,
     currentTurnId:current?.id||null,currentTurnUsername:room.started?current?.username||null:null,isMyTurn:room.started&&!!current&&current.id===player.id&&!player.solved,
     solved:!!player.solved,finished:!!room.finished,
     pendingQuestion:pending?{question:pending.question,askerId:pending.askerId,askerUsername:pending.askerUsername,answers:answers.map(a=>({username:a.username,answer:a.answer})),required:room.players.filter(p=>p.id!==pending.askerId&&!p.solved).length,myAnswer:pending.answers[player.id]?.answer||null}:null
   });
 });
}
function finishQuestion(code) {
 const room=guessRooms[code];if(!room||!room.pendingQuestion)return;
 const pending=room.pendingQuestion;
 const eligible=room.players.filter(p=>p.id!==pending.askerId&&!p.solved);
 if(eligible.some(p=>!pending.answers[p.id]))return;
 io.to("guess:"+code).emit("guessQuestionResult",{askerUsername:pending.askerUsername,question:pending.question,answers:eligible.map(p=>({username:p.username,answer:pending.answers[p.id].answer}))});
 room.pendingQuestion=null;
 nextGuessTurn(room);
 sendGuessState(code);
}
io.on("connection", socket => {
 socket.on("createRoom", data => {
   const username=cleanName(data.username); if(!username){socket.emit("errorMessage","Enter a username.");return;}
   const roomCode=generateRoomCode(rooms);
   rooms[roomCode]={players:[{id:socket.id,username}],maxPlayers:Math.max(2,Math.min(8,Number(data.maxPlayers)||2)),currentPlayer:0,usedMoves:[],timer:60,timerStarted:false,timerInterval:null,gameStarted:false,gameOver:false};
   socket.join(roomCode);socket.emit("roomCreated",roomCode);socket.emit("playerNumber",0);io.to(roomCode).emit("updatePlayers",rooms[roomCode].players);
 });
 socket.on("joinRoom", data => {
   const roomCode=String(data.roomCode||"").trim();
   const room=rooms[roomCode];const username=cleanName(data.username);
   if(!/^\d{5}$/.test(roomCode)){socket.emit("errorMessage","Enter the 5-digit room code shown by the host.");return;}
   if(!room){socket.emit("errorMessage","Room not found. Check the code and make sure the host is still in the room.");return;}
   if(!username){socket.emit("errorMessage","Enter a username.");return;}
   if(room.gameStarted){socket.emit("errorMessage","Game already started");return;}
   if(room.players.length>=room.maxPlayers){socket.emit("errorMessage","Room is full");return;}
   if(room.players.some(p=>p.username.toLowerCase()===username.toLowerCase())){socket.emit("errorMessage","Username already taken");return;}
   room.players.push({id:socket.id,username});socket.join(roomCode);socket.emit("joinSuccess");socket.emit("playerNumber",room.players.length-1);io.to(roomCode).emit("updatePlayers",room.players);
   if(room.players.length>=2){room.gameStarted=true;io.to(roomCode).emit("gameStart",{currentPlayer:room.currentPlayer,currentUsername:room.players[0].username,timer:room.timer});}
 });
 socket.on("startTimer", roomCode => {
   const room=rooms[roomCode];if(!room||room.timerStarted||room.gameOver)return;
   room.timerStarted=true;io.to(roomCode).emit("timerUpdate",room.timer);
   room.timerInterval=setInterval(()=>{room.timer--;io.to(roomCode).emit("timerUpdate",room.timer);if(room.timer<=0){clearRoomTimer(room);room.gameOver=true;io.to(roomCode).emit("gameOver",{loser:room.players[room.currentPlayer]?.username||"A player"});}},1000);
 });
 socket.on("submitMove", data => {
   const room=rooms[data.roomCode];if(!room||room.gameOver)return;
   const playerIndex=room.players.findIndex(p=>p.id===socket.id);if(playerIndex<0)return;
   if(playerIndex!==room.currentPlayer){socket.emit("errorMessage","Not your turn!");return;}
   const move=String(data.move||"").trim();if(!move||move.length>80)return;
   if(room.usedMoves.some(m=>m.toLowerCase()===move.toLowerCase())){socket.emit("errorMessage","Move already used!");return;}
   room.usedMoves.push(move);room.currentPlayer=(room.currentPlayer+1)%room.players.length;room.timer=60;
   io.to(data.roomCode).emit("moveAccepted",{move,usedMoves:room.usedMoves,currentPlayer:room.currentPlayer,currentUsername:room.players[room.currentPlayer].username,timer:room.timer});
 });
 socket.on("createGuessRoom", data => {
   const username=cleanName(data.username);if(!username){socket.emit("errorMessage","Enter a name first.");return;}
   const roomCode=generateRoomCode(guessRooms);const filters={genre:String(data.genre||"all"),franchise:String(data.franchise||"all")};
   guessRooms[roomCode]={roomCode,players:[{id:socket.id,username,character:null,solved:false}],maxPlayers:Math.max(2,Math.min(8,Number(data.maxPlayers)||2)),filters,started:false,finished:false,currentTurn:0,pendingQuestion:null,guessed:new Set()};
   socket.join("guess:"+roomCode);socket.emit("guessRoomCreated",{roomCode,players:publicPlayers(guessRooms[roomCode]),filters,myCharacter:null});sendGuessState(roomCode);
 });
 socket.on("joinGuessRoom", data => {
   const roomCode=String(data.roomCode||"").trim().toUpperCase();const room=guessRooms[roomCode];const username=cleanName(data.username);
   if(!/^\d{5}$/.test(roomCode)){socket.emit("errorMessage","Enter the 5-digit room code shown by the host.");return;}if(!room){socket.emit("errorMessage","Room not found. Check the code and make sure the host is still in the room.");return;}if(!username){socket.emit("errorMessage","Enter a name first.");return;}
   if(room.started){socket.emit("errorMessage","This round has already started.");return;}
   if(room.players.length>=room.maxPlayers){socket.emit("errorMessage","Room is full.");return;}
   if(room.players.some(p=>p.username.toLowerCase()===username.toLowerCase())){socket.emit("errorMessage","That name is already in the room.");return;}
   room.players.push({id:socket.id,username,character:null,solved:false});socket.join("guess:"+roomCode);
   if(room.players.length>=2){room.started=true;assignCharacters(room);}
   socket.emit("guessJoinSuccess",{roomCode,players:publicPlayers(room),filters:room.filters,myCharacter:room.started?room.players.find(p=>p.id===socket.id).character:null});sendGuessState(roomCode);
   io.to("guess:"+roomCode).emit("guessChat",{username:"Nexus",message:room.started?"Round started! Your character is assigned. Ask questions and make a guess.":"Waiting for another player."});
 });
 socket.on("askGuessQuestion", data => {
   const code=String(data.roomCode||"");const room=guessRooms[code];
   if(!room||!room.started||room.finished)return;
   const player=room.players.find(p=>p.id===socket.id);
   if(!player||player.solved)return;
   if(room.pendingQuestion){socket.emit("errorMessage","Finish answering the current question first.");return;}
   if(room.players[room.currentTurn]?.id!==socket.id){socket.emit("errorMessage","Wait for your turn to ask a question.");return;}
   const question=String(data.question||"").trim().slice(0,180);
   if(!question||question.length<3){socket.emit("errorMessage","Type a question first.");return;}
   room.pendingQuestion={askerId:socket.id,askerUsername:player.username,question,answers:Object.create(null)};
   io.to("guess:"+code).emit("guessQuestion",{askerUsername:player.username,question});
   sendGuessState(code);
   if(room.players.filter(p=>p.id!==socket.id&&!p.solved).length===0)finishQuestion(code);
 });
 socket.on("answerGuessQuestion", data => {
   const code=String(data.roomCode||"");const room=guessRooms[code];if(!room||!room.pendingQuestion||room.finished)return;
   const player=room.players.find(p=>p.id===socket.id);if(!player||player.solved||player.id===room.pendingQuestion.askerId)return;
   if(room.pendingQuestion.answers[socket.id]){socket.emit("errorMessage","You already answered this question.");return;}
   const answer=String(data.answer||"");
   if(!["Yes","No","Not sure"].includes(answer)){socket.emit("errorMessage","Choose Yes, No, or Not sure.");return;}
   room.pendingQuestion.answers[socket.id]={username:player.username,answer};
   io.to("guess:"+code).emit("guessAnswerProgress",{count:Object.keys(room.pendingQuestion.answers).length,required:room.players.filter(p=>p.id!==room.pendingQuestion.askerId&&!p.solved).length});
   finishQuestion(code);
   sendGuessState(code);
 });
 socket.on("guessChat", data => {
   const room=guessRooms[data.roomCode];if(!room||!room.players.some(p=>p.id===socket.id))return;
   const message=String(data.message||"").trim().slice(0,180);if(!message)return;
   const player=room.players.find(p=>p.id===socket.id);io.to("guess:"+data.roomCode).emit("guessChat",{username:player.username,message});
 });
 socket.on("guessCharacter", data => {
   const code=String(data.roomCode||"");const room=guessRooms[code];if(!room||!room.started||room.finished)return;
   const player=room.players.find(p=>p.id===socket.id);if(!player||player.solved)return;
   if(room.pendingQuestion){socket.emit("errorMessage","Wait until the current question is answered.");return;}
   if(room.players[room.currentTurn]?.id!==socket.id){socket.emit("errorMessage","Wait for your turn to guess.");return;}
   const guess=String(data.guess||"").trim();if(!guess)return;
   const correct=player.character.toLowerCase()===guess.toLowerCase();
   socket.emit("guessResult",{correct,character:correct?player.character:undefined});
   if(correct){
     player.solved=true;
     io.to("guess:"+code).emit("guessWinner",{username:player.username,character:player.character});
     if(room.players.every(p=>p.solved)){room.finished=true;io.to("guess:"+code).emit("guessGameOver",{message:"Everyone guessed their character!"});}
   }else{
     io.to("guess:"+code).emit("guessChat",{username:"Nexus",message:player.username+" made an incorrect guess."});
   }
   if(!room.finished)nextGuessTurn(room);
   sendGuessState(code);
 });
 socket.on("disconnect", () => {
   for(const code of Object.keys(rooms)){const room=rooms[code];const i=room.players.findIndex(p=>p.id===socket.id);if(i<0)continue;const name=room.players[i].username;room.players.splice(i,1);io.to(code).emit("errorMessage",name+" disconnected.");io.to(code).emit("updatePlayers",room.players);if(room.currentPlayer>=room.players.length)room.currentPlayer=0;endRoomIfEmpty(code,rooms);}
   for(const code of Object.keys(guessRooms)){const room=guessRooms[code];const i=room.players.findIndex(p=>p.id===socket.id);if(i<0)continue;const name=room.players[i].username;room.players.splice(i,1);if(i<room.currentTurn)room.currentTurn--;if(room.currentTurn>=room.players.length)room.currentTurn=0;if(room.pendingQuestion){delete room.pendingQuestion.answers[socket.id];if(room.pendingQuestion.askerId===socket.id){room.pendingQuestion=null;io.to("guess:"+code).emit("guessChat",{username:"Nexus",message:"The question was cancelled because its asker disconnected."});}else finishQuestion(code);}io.to("guess:"+code).emit("guessChat",{username:"Nexus",message:name+" disconnected."});if(!room.players.length){delete guessRooms[code];continue;}if(room.players.filter(p=>!p.solved).length<=1&&room.started){room.finished=true;io.to("guess:"+code).emit("guessGameOver",{message:"The round has ended because only one player remains."});}sendGuessState(code);}
 });
});
server.listen(PORT,()=>console.log("Nexus server listening on port "+PORT));

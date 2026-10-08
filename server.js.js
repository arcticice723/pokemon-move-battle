const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { promisify } = require("util");
const scrypt = promisify(crypto.scrypt);
let pgPool = null;
if (process.env.DATABASE_URL) {
  const { Pool } = require("pg");
  pgPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false } });
}
const { Server } = require("socket.io");

const app = express();
// Render terminates HTTPS at its proxy; trust the first proxy for secure cookies and per-client rate limits.
app.set("trust proxy", 1);
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
// Never expose private account storage or server/configuration files through static hosting.
app.use((req, res, next) => {
  const blockedFiles = new Set(["accounts.json", "server.js.js", "package.json", "render.yaml", "readme.md", ".gitignore"]);
  const requestedFile = path.posix.basename(req.path).toLowerCase();
  if (blockedFiles.has(requestedFile) || /^\/(docs|scripts|\.github)(\/|$)/i.test(req.path)) return res.sendStatus(404);
  next();
});
app.use(express.static(__dirname, { dotfiles: "deny" }));
app.get("/health", (_req, res) => res.status(200).json({ status: "ok", app: "Nexus" }));
// Basic Nexus accounts. Set DATABASE_URL to a persistent PostgreSQL database in production.
const ACCOUNT_FILE = path.join(__dirname, "accounts.json");
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) console.error("WARNING: Set a stable SESSION_SECRET in production; sessions will reset on restart.");
const authRateBuckets = new Map();
function authRateLimit({ limit, windowMs }) {
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, bucket] of authRateBuckets) if (bucket.resetAt <= now) authRateBuckets.delete(key);
    const key = String(req.ip || req.socket.remoteAddress || "unknown") + ":" + req.path;
    let bucket = authRateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) { bucket = { count: 0, resetAt: now + windowMs }; authRateBuckets.set(key, bucket); }
    bucket.count++;
    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    if (bucket.count > limit) return res.status(429).json({ error: "Too many attempts. Please wait a little while and try again." });
    next();
  };
}
const loginRateLimit = authRateLimit({ limit: 12, windowMs: 15 * 60 * 1000 });
const registerRateLimit = authRateLimit({ limit: 8, windowMs: 60 * 60 * 1000 });
const deleteRateLimit = authRateLimit({ limit: 5, windowMs: 15 * 60 * 1000 });
const friendRequestRateLimit = authRateLimit({ limit: 20, windowMs: 60 * 60 * 1000 });
let accountFileQueue = Promise.resolve();
async function initAccounts() {
  if (pgPool) {
    await pgPool.query("CREATE TABLE IF NOT EXISTS nexus_accounts (id BIGSERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await pgPool.query("ALTER TABLE nexus_accounts ADD COLUMN IF NOT EXISTS avatar_data TEXT");
    await pgPool.query("ALTER TABLE nexus_accounts ADD COLUMN IF NOT EXISTS hide_online BOOLEAN NOT NULL DEFAULT FALSE");
    await pgPool.query("CREATE TABLE IF NOT EXISTS nexus_friendships (id BIGSERIAL PRIMARY KEY, requester_id BIGINT NOT NULL REFERENCES nexus_accounts(id) ON DELETE CASCADE, addressee_id BIGINT NOT NULL REFERENCES nexus_accounts(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK (requester_id <> addressee_id), UNIQUE (requester_id, addressee_id))");
  }
}
const accountsReady = initAccounts();
async function findAccountByLogin(login) {
  await accountsReady;
  if (pgPool) {
    const r = await pgPool.query("SELECT id, username, email, password_hash, created_at FROM nexus_accounts WHERE LOWER(username)=LOWER($1) OR LOWER(email)=LOWER($1) LIMIT 1", [login]);
    return r.rows[0] || null;
  }
  const data = await readLocalAccounts();
  return data.find(a => a.username.toLowerCase() === login.toLowerCase() || a.email.toLowerCase() === login.toLowerCase()) || null;
}
async function readLocalAccounts() {
  try { return JSON.parse(await fs.promises.readFile(ACCOUNT_FILE, "utf8")); }
  catch (e) { if (e.code === "ENOENT") return []; throw e; }
}
async function saveLocalAccount(account) {
  accountFileQueue = accountFileQueue.then(async () => {
    const data = await readLocalAccounts();
    if (data.some(a => a.username.toLowerCase() === account.username.toLowerCase() || a.email.toLowerCase() === account.email.toLowerCase())) {
      const e = new Error("An account with that username or email already exists."); e.status = 409; throw e;
    }
    data.push(account);
    await fs.promises.writeFile(ACCOUNT_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  });
  return accountFileQueue;
}
async function createAccount(username, email, passwordHash) {
  await accountsReady;
  if (pgPool) {
    try {
      const r = await pgPool.query("INSERT INTO nexus_accounts (username,email,password_hash) VALUES ($1,$2,$3) RETURNING id,username,email,created_at", [username,email,passwordHash]);
      return r.rows[0];
    } catch (e) {
      if (e.code === "23505") { const err = new Error("That username or email is already registered."); err.status = 409; throw err; }
      throw e;
    }
  }
  const account = { id: crypto.randomUUID(), username, email, password_hash: passwordHash, created_at: new Date().toISOString() };
  await saveLocalAccount(account);
  return account;
}
function publicAccount(a) { return { id: String(a.id), username: a.username, email: a.email, createdAt: a.created_at, avatarData: a.avatar_data || a.avatarData || null, hideOnline: Boolean(a.hide_online ?? a.hideOnline ?? false) }; }
function makeSession(a) {
  const payload = Buffer.from(JSON.stringify({ id: String(a.id), exp: Date.now() + 7*24*60*60*1000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return payload + "." + sig;
}
function readSession(req) {
  const token = String(req.headers.cookie || "").split(";").map(x=>x.trim()).find(x=>x.startsWith("nexus_session="))?.slice("nexus_session=".length);
  if (!token) return null;
  const [payload,sig] = decodeURIComponent(token).split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest();
  let actual; try { actual = Buffer.from(sig, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try { const data = JSON.parse(Buffer.from(payload, "base64url").toString()); return data.exp > Date.now() ? data : null; } catch { return null; }
}
async function accountFromRequest(req) {
  const session = readSession(req); if (!session) return null;
  await accountsReady;
  if (pgPool) { const r = await pgPool.query("SELECT id,username,email,created_at,avatar_data,hide_online FROM nexus_accounts WHERE id=$1", [session.id]); return r.rows[0] || null; }
  const accounts = await readLocalAccounts(); return accounts.find(a=>String(a.id)===session.id) || null;
}
function setSessionCookie(res, account) {
  res.setHeader("Set-Cookie", "nexus_session="+encodeURIComponent(makeSession(account))+"; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800"+(process.env.NODE_ENV==="production" ? "; Secure" : ""));
}
function clearSessionCookie(res) { res.setHeader("Set-Cookie", "nexus_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"+(process.env.NODE_ENV==="production" ? "; Secure" : "")); }
app.use(express.json({ limit: "1.5mb" }));
app.get("/account", (_req,res)=>res.sendFile(path.join(__dirname,"account.html")));
app.get("/api/auth/me", async (req,res)=>{ try { const a=await accountFromRequest(req); if(!a)return res.status(401).json({error:"Not signed in."}); res.json({account:publicAccount(a)}); } catch(e) { console.error("Account lookup failed",e);res.status(500).json({error:"Account service unavailable."}); }});
app.post("/api/auth/register", registerRateLimit, async (req,res)=>{
  try {
    const username=String(req.body.username||"").trim(), email=String(req.body.email||"").trim().toLowerCase(), password=String(req.body.password||"");
    if(!/^[A-Za-z0-9_]{3,20}$/.test(username))return res.status(400).json({error:"Username must be 3–20 characters using letters, numbers, or underscores."});
    if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:"Enter a valid email address."});
    if(password.length<10||password.length>200)return res.status(400).json({error:"Password must be at least 10 characters."});
    const salt=crypto.randomBytes(16).toString("hex"), derived=await scrypt(password,salt,64);
    const a=await createAccount(username,email,salt+":"+derived.toString("hex"));setSessionCookie(res,a);res.status(201).json({account:publicAccount(a)});
  } catch(e) { if(e.status)return res.status(e.status).json({error:e.message});console.error("Registration failed",e);res.status(500).json({error:"Could not create your account. Try again later."}); }
});
app.post("/api/auth/login", loginRateLimit, async (req,res)=>{
  try {
    const login=String(req.body.login||"").trim(), password=String(req.body.password||"");
    if(!login||!password)return res.status(400).json({error:"Enter your username/email and password."});
    const a=await findAccountByLogin(login);if(!a)return res.status(401).json({error:"Incorrect username/email or password."});
    const [salt,hash]=String(a.password_hash).split(":");if(!salt||!hash)return res.status(500).json({error:"Account credentials need to be reset."});
    const derived=await scrypt(password,salt,64), expected=Buffer.from(hash,"hex");
    if(expected.length!==derived.length||!crypto.timingSafeEqual(expected,derived))return res.status(401).json({error:"Incorrect username/email or password."});
    setSessionCookie(res,a);res.json({account:publicAccount(a)});
  } catch(e) { console.error("Login failed",e);res.status(500).json({error:"Could not sign in. Try again later."}); }
});
app.post("/api/account/avatar", async (req,res)=>{
  try {
    const account=await accountFromRequest(req);
    if(!account)return res.status(401).json({error:"Sign in to change your profile picture."});
    const avatar=String(req.body.avatarData||"");
    if(avatar && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar) || avatar.length>1_300_000))
      return res.status(400).json({error:"Choose a PNG, JPG, or WebP image smaller than 900 KB."});
    await accountsReady;
    if(pgPool) await pgPool.query("UPDATE nexus_accounts SET avatar_data=$1 WHERE id=$2",[avatar||null,account.id]);
    else {
      account.avatarData=avatar||null;
      const data=await readLocalAccounts(), i=data.findIndex(x=>String(x.id)===String(account.id));
      if(i<0)return res.status(404).json({error:"Account not found."});
      data[i].avatarData=avatar||null;
      await fs.promises.writeFile(ACCOUNT_FILE,JSON.stringify(data,null,2),{mode:0o600});
    }
    res.json({avatarData:avatar||null});
  } catch(e){console.error("Avatar update failed",e);res.status(500).json({error:"Could not update your profile picture."});}
});

app.post("/api/account/delete", deleteRateLimit, async (req,res)=>{
  try {
    const account = await accountFromRequest(req);
    if (!account) return res.status(401).json({ error: "Sign in again before deleting your account." });
    const password = String(req.body.password || "");
    if (!password || password.length > 200) return res.status(400).json({ error: "Enter your current password to confirm deletion." });
    let stored = null;
    if (pgPool) {
      const result = await pgPool.query("SELECT password_hash FROM nexus_accounts WHERE id=$1", [account.id]);
      stored = result.rows[0]?.password_hash || null;
    } else {
      const records = await readLocalAccounts();
      stored = records.find(a => String(a.id) === String(account.id))?.password_hash || null;
    }
    if (!stored) return res.status(404).json({ error: "Account not found." });
    const [salt, hash] = String(stored).split(":");
    const derived = await scrypt(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    if (expected.length !== derived.length || !crypto.timingSafeEqual(expected, derived))
      return res.status(401).json({ error: "Password is incorrect. Your account was not deleted." });
    if (pgPool) {
      await pgPool.query("DELETE FROM nexus_accounts WHERE id=$1", [account.id]);
    } else {
      accountFileQueue = accountFileQueue.then(async () => {
        const records = await readLocalAccounts();
        await fs.promises.writeFile(ACCOUNT_FILE, JSON.stringify(records.filter(a => String(a.id) !== String(account.id)), null, 2), { mode: 0o600 });
      });
      await accountFileQueue;
    }
    for (const connectedSocket of io.sockets.sockets.values()) if (connectedSocket.data.accountId === String(account.id)) connectedSocket.disconnect(true);
    clearSessionCookie(res);
    return res.json({ ok: true });
  } catch (e) {
    console.error("Account deletion failed", e);
    return res.status(500).json({ error: "Could not delete the account right now. Please try again later." });
  }
});



app.post("/api/account/privacy", async (req,res)=>{
  try {
    const account=await accountFromRequest(req);
    if(!account)return res.status(401).json({error:"Sign in to change privacy settings."});
    const hideOnline=Boolean(req.body.hideOnline);
    await accountsReady;
    if(pgPool) await pgPool.query("UPDATE nexus_accounts SET hide_online=$1 WHERE id=$2",[hideOnline,account.id]);
    else {
      accountFileQueue=accountFileQueue.then(async()=>{
        const records=await readLocalAccounts();
        const record=records.find(x=>String(x.id)===String(account.id));
        if(!record)throw new Error("Account not found.");
        record.hideOnline=hideOnline;
        await fs.promises.writeFile(ACCOUNT_FILE,JSON.stringify(records,null,2),{mode:0o600});
      });
      await accountFileQueue;
    }
    res.json({ok:true,hideOnline});
  } catch(e){console.error("Privacy setting update failed",e);res.status(500).json({error:"Could not save that privacy setting."});}
});

app.get("/api/friends", async (req,res)=>{
  try {
    const account=await accountFromRequest(req);
    if(!account)return res.status(401).json({error:"Sign in to view friends."});
    if(!pgPool)return res.status(503).json({error:"Friends require the production database to be configured. Please try again after setup."});
    const result=await pgPool.query(
      "SELECT f.id,f.status,f.requester_id,f.addressee_id,f.created_at,CASE WHEN f.requester_id=$1 THEN a2.id ELSE a1.id END AS other_id,CASE WHEN f.requester_id=$1 THEN a2.username ELSE a1.username END AS other_username,CASE WHEN f.requester_id=$1 THEN a2.avatar_data ELSE a1.avatar_data END AS other_avatar,CASE WHEN f.requester_id=$1 THEN a2.hide_online ELSE a1.hide_online END AS other_hide_online FROM nexus_friendships f JOIN nexus_accounts a1 ON a1.id=f.requester_id JOIN nexus_accounts a2 ON a2.id=f.addressee_id WHERE f.requester_id=$1 OR f.addressee_id=$1 ORDER BY f.created_at DESC",
      [account.id]
    );
    res.json({friends:result.rows.map(row=>({id:String(row.id),userId:String(row.other_id),username:row.other_username,avatarData:row.other_avatar||null,status:row.status,direction:String(row.requester_id)===String(account.id)?"outgoing":"incoming",online:onlineAccountSockets.has(String(row.other_id))&&!row.other_hide_online}))});
  } catch(e){console.error("Friends list failed",e);res.status(500).json({error:"Could not load friends right now."});}
});
app.post("/api/friends/request", friendRequestRateLimit, async (req,res)=>{
  try {
    const account=await accountFromRequest(req);
    if(!account)return res.status(401).json({error:"Sign in to add friends."});
    if(!pgPool)return res.status(503).json({error:"Friends require the production database to be configured. Please try again after setup."});
    const username=String(req.body.username||"").trim();
    if(!/^[A-Za-z0-9_]{3,20}$/.test(username))return res.status(400).json({error:"Enter a valid Nexus username."});
    const found=await pgPool.query("SELECT id,username FROM nexus_accounts WHERE LOWER(username)=LOWER($1) LIMIT 1",[username]);
    const target=found.rows[0];
    if(!target)return res.status(404).json({error:"No account found with that username."});
    if(String(target.id)===String(account.id))return res.status(400).json({error:"You cannot add yourself."});
    const existing=await pgPool.query("SELECT id,status,requester_id,addressee_id FROM nexus_friendships WHERE (requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1) LIMIT 1",[account.id,target.id]);
    if(existing.rows[0]){
      const f=existing.rows[0];
      if(f.status==="accepted")return res.status(409).json({error:"You are already friends."});
      if(String(f.requester_id)===String(target.id)&&String(f.addressee_id)===String(account.id)){
        const accepted=await pgPool.query("UPDATE nexus_friendships SET status='accepted' WHERE id=$1 RETURNING id",[f.id]);
        return res.json({ok:true,accepted:true,message:"Friend request accepted."});
      }
      return res.status(409).json({error:"A friend request is already pending."});
    }
    await pgPool.query("INSERT INTO nexus_friendships (requester_id,addressee_id) VALUES ($1,$2)",[account.id,target.id]);
    res.status(201).json({ok:true,message:"Friend request sent."});
  } catch(e){console.error("Friend request failed",e);res.status(500).json({error:"Could not send friend request right now."});}
});
app.post("/api/friends/:id/accept", async (req,res)=>{
  try {
    const account=await accountFromRequest(req);
    if(!account)return res.status(401).json({error:"Sign in to manage friend requests."});
    if(!pgPool)return res.status(503).json({error:"Friends require the production database to be configured."});
    if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:"Invalid friend request."});
    const result=await pgPool.query("UPDATE nexus_friendships SET status='accepted' WHERE id=$1 AND addressee_id=$2 AND status='pending' RETURNING id",[req.params.id,account.id]);
    if(!result.rowCount)return res.status(404).json({error:"That incoming request was not found."});
    res.json({ok:true});
  } catch(e){console.error("Accept friend request failed",e);res.status(500).json({error:"Could not accept the request."});}
});
app.post("/api/friends/:id/remove", async (req,res)=>{
  try {
    const account=await accountFromRequest(req);
    if(!account)return res.status(401).json({error:"Sign in to manage friends."});
    if(!pgPool)return res.status(503).json({error:"Friends require the production database to be configured."});
    if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:"Invalid friend entry."});
    const result=await pgPool.query("DELETE FROM nexus_friendships WHERE id=$1 AND (requester_id=$2 OR addressee_id=$2) RETURNING id",[req.params.id,account.id]);
    if(!result.rowCount)return res.status(404).json({error:"Friend entry not found."});
    res.json({ok:true});
  } catch(e){console.error("Remove friend failed",e);res.status(500).json({error:"Could not remove that friend."});}
});

app.post("/api/auth/logout", (_req,res)=>{clearSessionCookie(res);res.json({ok:true});});

app.get("/pokemon-move-battle", (_req, res) => res.sendFile(path.join(__dirname, "pokemon.html")));
app.get("/character-guess", (_req, res) => res.sendFile(path.join(__dirname, "character-guess.html")));

const onlineAccountSockets = new Map();
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
function publicPlayers(room) { return room.players.map(p=>({id:p.id,username:p.username,avatarData:p.avatarData||null})); }
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
io.use(async (socket, next) => {
  try {
    const account = await accountFromRequest({headers:{cookie:socket.handshake.headers.cookie||""}});
    if (account) {
      socket.data.accountId = String(account.id);
      socket.data.accountUsername = account.username;
      socket.data.avatarData = account.avatar_data || account.avatarData || null;
      socket.data.hideOnline = Boolean(account.hide_online ?? account.hideOnline ?? false);
    }
  } catch (e) { console.error("Socket account lookup failed",e); }
  next();
});
io.on("connection", socket => {
 if(socket.data.accountId){const id=socket.data.accountId;onlineAccountSockets.set(id,(onlineAccountSockets.get(id)||0)+1);}
 socket.on("createRoom", data => {
   const username=cleanName(socket.data.accountUsername || data.username); if(!username){socket.emit("errorMessage","Enter a username.");return;} const resumeToken=String(data.resumeToken||""); if(!resumeToken){socket.emit("errorMessage","Session token missing; refresh and try again.");return;}
   const roomCode=generateRoomCode(rooms);
   rooms[roomCode]={players:[{id:socket.id,username,resumeToken,accountId:socket.data.accountId||null,avatarData:socket.data.avatarData||null,disconnectTimer:null}],maxPlayers:Math.max(2,Math.min(8,Number(data.maxPlayers)||2)),currentPlayer:0,usedMoves:[],timer:60,timerStarted:false,timerInterval:null,gameStarted:false,gameOver:false};
   socket.join(roomCode);socket.emit("roomCreated",roomCode);socket.emit("playerNumber",0);io.to(roomCode).emit("updatePlayers",publicPlayers(rooms[roomCode]));
 });
 socket.on("joinRoom", data => {
   const roomCode=String(data.roomCode||"").trim();
   const room=rooms[roomCode];const username=cleanName(socket.data.accountUsername || data.username);
   if(!/^\d{5}$/.test(roomCode)){socket.emit("errorMessage","Enter the 5-digit room code shown by the host.");return;}
   if(!room){socket.emit("errorMessage","Room not found. Check the code and make sure the host is still in the room.");return;}
   if(!username){socket.emit("errorMessage","Enter a username.");return;}
   if(room.gameStarted){socket.emit("errorMessage","Game already started");return;}
   if(room.players.length>=room.maxPlayers){socket.emit("errorMessage","Room is full");return;}
   if(room.players.some(p=>p.username.toLowerCase()===username.toLowerCase())){socket.emit("errorMessage","Username already taken");return;}
   room.players.push({id:socket.id,username,resumeToken:String(data.resumeToken||""),accountId:socket.data.accountId||null,avatarData:socket.data.avatarData||null,disconnectTimer:null});socket.join(roomCode);socket.emit("joinSuccess");socket.emit("playerNumber",room.players.length-1);io.to(roomCode).emit("updatePlayers",publicPlayers(room));
   if(room.players.length>=2){room.gameStarted=true;io.to(roomCode).emit("gameStart",{currentPlayer:room.currentPlayer,currentUsername:room.players[0].username,timer:room.timer});}
 });
 socket.on("resumeRoom", data => {
   const code=String(data.roomCode||"").trim(), token=String(data.resumeToken||"");
   if(!/^\d{5}$/.test(code)||!token)return;
   if(data.game==="pokemon"){
     const room=rooms[code];if(!room)return;const player=room.players.find(p=>p.resumeToken===token);if(!player)return;
     if(player.disconnectTimer)clearTimeout(player.disconnectTimer);player.disconnectTimer=null;player.id=socket.id;if(socket.data.accountId){player.accountId=socket.data.accountId;player.avatarData=socket.data.avatarData||null;}socket.join(code);
     socket.emit("roomResumed",{game:"pokemon",roomCode:code,username:player.username,playerNumber:room.players.indexOf(player),players:publicPlayers(room),currentPlayer:room.currentPlayer,usedMoves:room.usedMoves,timer:room.timer,timerStarted:room.timerStarted,gameStarted:room.gameStarted,gameOver:room.gameOver});
     io.to(code).emit("updatePlayers",publicPlayers(room));
     if(room.gameStarted)socket.emit("gameStart",{currentPlayer:room.currentPlayer,currentUsername:room.players[room.currentPlayer]?.username||"",timer:room.timer});
   } else if(data.game==="character"){
     const room=guessRooms[code];if(!room)return;const player=room.players.find(p=>p.resumeToken===token);if(!player)return;
     const oldId=player.id;if(player.disconnectTimer)clearTimeout(player.disconnectTimer);player.disconnectTimer=null;player.id=socket.id;if(socket.data.accountId){player.accountId=socket.data.accountId;player.avatarData=socket.data.avatarData||null;}
     if(room.pendingQuestion){if(room.pendingQuestion.askerId===oldId)room.pendingQuestion.askerId=socket.id;if(room.pendingQuestion.answers[oldId]){room.pendingQuestion.answers[socket.id]=room.pendingQuestion.answers[oldId];delete room.pendingQuestion.answers[oldId];}}
     socket.join("guess:"+code);socket.emit("guessJoinSuccess",{roomCode:code,players:publicPlayers(room),filters:room.filters,myCharacter:room.started?player.character:null});sendGuessState(code);
   }
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
   const username=cleanName(socket.data.accountUsername || data.username);if(!username){socket.emit("errorMessage","Enter a name first.");return;} const resumeToken=String(data.resumeToken||"");if(!resumeToken){socket.emit("errorMessage","Session token missing; refresh and try again.");return;}
   const roomCode=generateRoomCode(guessRooms);const filters={genre:String(data.genre||"all"),franchise:String(data.franchise||"all")};
   guessRooms[roomCode]={roomCode,players:[{id:socket.id,username,resumeToken,accountId:socket.data.accountId||null,avatarData:socket.data.avatarData||null,disconnectTimer:null,character:null,solved:false}],maxPlayers:Math.max(2,Math.min(8,Number(data.maxPlayers)||2)),filters,started:false,finished:false,currentTurn:0,pendingQuestion:null,guessed:new Set()};
   socket.join("guess:"+roomCode);socket.emit("guessRoomCreated",{roomCode,players:publicPlayers(guessRooms[roomCode]),filters,myCharacter:null});sendGuessState(roomCode);
 });
 socket.on("joinGuessRoom", data => {
   const roomCode=String(data.roomCode||"").trim().toUpperCase();const room=guessRooms[roomCode];const username=cleanName(socket.data.accountUsername || data.username);
   if(!/^\d{5}$/.test(roomCode)){socket.emit("errorMessage","Enter the 5-digit room code shown by the host.");return;}if(!room){socket.emit("errorMessage","Room not found. Check the code and make sure the host is still in the room.");return;}if(!username){socket.emit("errorMessage","Enter a name first.");return;}
   if(room.started){socket.emit("errorMessage","This round has already started.");return;}
   if(room.players.length>=room.maxPlayers){socket.emit("errorMessage","Room is full.");return;}
   if(room.players.some(p=>p.username.toLowerCase()===username.toLowerCase())){socket.emit("errorMessage","That name is already in the room.");return;}
   room.players.push({id:socket.id,username,resumeToken:String(data.resumeToken||""),accountId:socket.data.accountId||null,avatarData:socket.data.avatarData||null,disconnectTimer:null,character:null,solved:false});socket.join("guess:"+roomCode);
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
   if(socket.data.accountId){const id=socket.data.accountId;const count=onlineAccountSockets.get(id)||0;if(count<=1)onlineAccountSockets.delete(id);else onlineAccountSockets.set(id,count-1);}
   for(const code of Object.keys(rooms)){const room=rooms[code];const player=room.players.find(p=>p.id===socket.id);if(!player)continue;
     player.disconnectTimer=setTimeout(()=>{const i=room.players.findIndex(p=>p===player&&p.id===socket.id);if(i<0)return;room.players.splice(i,1);io.to(code).emit("errorMessage",player.username+" disconnected.");io.to(code).emit("updatePlayers",publicPlayers(room));if(room.currentPlayer>=room.players.length)room.currentPlayer=0;endRoomIfEmpty(code,rooms);},60000);
   }
   for(const code of Object.keys(guessRooms)){const room=guessRooms[code];const player=room.players.find(p=>p.id===socket.id);if(!player)continue;
     player.disconnectTimer=setTimeout(()=>{const i=room.players.findIndex(p=>p===player&&p.id===socket.id);if(i<0)return;const name=player.username;room.players.splice(i,1);if(i<room.currentTurn)room.currentTurn--;if(room.currentTurn>=room.players.length)room.currentTurn=0;if(room.pendingQuestion){delete room.pendingQuestion.answers[socket.id];if(room.pendingQuestion.askerId===socket.id){room.pendingQuestion=null;io.to("guess:"+code).emit("guessChat",{username:"Nexus",message:"The question was cancelled because its asker disconnected."});}else finishQuestion(code);}io.to("guess:"+code).emit("guessChat",{username:"Nexus",message:name+" disconnected."});if(!room.players.length){delete guessRooms[code];return;}if(room.players.filter(p=>!p.solved).length<=1&&room.started){room.finished=true;io.to("guess:"+code).emit("guessGameOver",{message:"The round has ended because only one player remains."});}sendGuessState(code);},60000);
   }
 });;
});
server.listen(PORT,()=>console.log("Nexus server listening on port "+PORT));

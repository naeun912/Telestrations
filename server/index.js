import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ *
 *  제시어 DB (클라이언트와 shared/words.json 을 공유)
 * ------------------------------------------------------------------ */
const wordData = JSON.parse(fs.readFileSync(path.join(__dirname, '../shared/words.json'), 'utf8'));
const CATEGORIES = wordData.categories.map((c) => ({
  id: c.id,
  words: c.words.split(',').map((w) => w.trim()).filter(Boolean),
}));
const ALL_WORDS = CATEGORIES.flatMap((c) => c.words);

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function dealCard(categoryId, customWords, used) {
  let pool;
  if (categoryId === 'custom') pool = customWords;
  else if (categoryId === 'all') pool = ALL_WORDS;
  else pool = (CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0]).words;

  const card = shuffle(pool.filter((w) => !used.has(w))).slice(0, 6);
  if (card.length < 6) {
    card.push(...shuffle(ALL_WORDS.filter((w) => !card.includes(w))).slice(0, 6 - card.length));
  }
  card.forEach((w) => used.add(w));
  return card;
}

/* ------------------------------------------------------------------ *
 *  게임 규칙 (src/game/logic.ts 와 동일)
 *   짝수: 1라운드에 자기 스케치북 제시어를 그림 → 총 N라운드
 *   홀수: 제시어를 바로 옆 사람에게 넘김 → 총 N-1라운드
 * ------------------------------------------------------------------ */
const isOdd = (n) => n % 2 === 1;
const totalRoundsFor = (n) => (isOdd(n) ? n - 1 : n);
const stepTypeFor = (round) => (round % 2 === 1 ? 'DRAWING' : 'GUESS');
const bookletIndexFor = (p, round, n) => (((p - (round - 1) - (isOdd(n) ? 1 : 0)) % n) + n) % n;

/* ------------------------------------------------------------------ */
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;
const WORD_PICK_SECONDS = 25;
const GRACE_MS = 4000;
const LOBBY_DISCONNECT_MS = 15000;
const EMPTY_ROOM_MS = 120000;
const DRAW_TIMES = [30, 45, 60, 90, 120];
const GUESS_TIMES = [15, 20, 30, 45, 60];
const REACTIONS = ['funny', 'art', 'twist'];

const app = express();
app.use(cors());
app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

const distDir = path.join(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 5e6,
});

const rooms = new Map();

const cleanName = (n) => String(n ?? '').trim().slice(0, 10) || '익명';
const cleanAvatar = (a) => String(a ?? '🐶').slice(0, 8);

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function defaultSettings() {
  return { category: 'easy', drawTime: 60, guessTime: 30, customWords: [] };
}

/* ------------------------------ 상태 전송 ------------------------------ */
function submittedFlag(room, pid) {
  if (room.phase === 'WORD_PICK') return room.picks.has(pid);
  if (room.phase === 'PLAYING') return room.submissions.has(pid);
  return false;
}

function stateFor(room, pid) {
  return {
    roomId: room.roomId,
    phase: room.phase,
    hostId: room.hostId,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      connected: p.connected,
      submitted: submittedFlag(room, p.id),
    })),
    settings: room.settings,
    round: room.round,
    totalRounds: room.totalRounds,
    deadline: room.deadline,
    serverTime: Date.now(),
    youId: pid,
    reveal: room.reveal,
    reactions: room.reactions,
    card: room.phase === 'WORD_PICK' ? room.cards.get(pid) : undefined,
    picked: room.phase === 'WORD_PICK' ? room.picks.has(pid) : undefined,
  };
}

function broadcast(room) {
  room.players.forEach((p) => {
    if (p.connected && p.socketId) io.to(p.socketId).emit('state', stateFor(room, p.id));
  });
}

function taskFor(room, player) {
  const idx = room.players.findIndex((p) => p.id === player.id);
  const b = bookletIndexFor(idx, room.round, room.players.length);
  const last = room.booklets[b].steps[room.booklets[b].steps.length - 1];
  return {
    round: room.round,
    type: stepTypeFor(room.round),
    text: last.type === 'DRAWING' ? null : last.content,
    image: last.type === 'DRAWING' ? last.content : null,
  };
}

function sendTask(room, player) {
  if (player.connected && player.socketId) io.to(player.socketId).emit('task', taskFor(room, player));
}

function sendRevealData(room, player) {
  if (player.connected && player.socketId) io.to(player.socketId).emit('revealData', { booklets: room.booklets });
}

/** 접속(재접속) 직후 현재 단계에 필요한 모든 데이터를 한 번에 보내준다. */
function syncPlayer(room, player) {
  io.to(player.socketId).emit('state', stateFor(room, player.id));
  if (room.phase === 'PLAYING') sendTask(room, player);
  if (room.phase === 'REVEAL') sendRevealData(room, player);
}

/* ------------------------------ 타이머 ------------------------------ */
function clearTimers(room) {
  clearTimeout(room.timer);
  clearTimeout(room.grace);
  room.timer = null;
  room.grace = null;
}

function scheduleCleanup(room) {
  clearTimeout(room.cleanup);
  if (room.players.some((p) => p.connected)) return;
  room.cleanup = setTimeout(() => {
    if (room.players.some((p) => p.connected)) return;
    clearTimers(room);
    rooms.delete(room.roomId);
  }, EMPTY_ROOM_MS);
}

function ensureHost(room) {
  const host = room.players.find((p) => p.id === room.hostId);
  if (host && host.connected) return;
  const next = room.players.find((p) => p.connected);
  if (next) room.hostId = next.id;
}

/* ------------------------------ 게임 진행 ------------------------------ */
function startWordPick(room) {
  clearTimers(room);
  const used = new Set();
  room.cards = new Map();
  room.picks = new Map();
  room.players.forEach((p) => {
    room.cards.set(p.id, dealCard(room.settings.category, room.settings.customWords, used));
    if (!p.connected) room.picks.set(p.id, Math.floor(Math.random() * 6));
  });
  room.phase = 'WORD_PICK';
  room.deadline = Date.now() + WORD_PICK_SECONDS * 1000;
  room.timer = setTimeout(() => {
    room.players.forEach((p) => {
      if (!room.picks.has(p.id)) room.picks.set(p.id, Math.floor(Math.random() * 6));
    });
    startPlaying(room);
  }, WORD_PICK_SECONDS * 1000);
  broadcast(room);
  if (room.picks.size >= room.players.length) startPlaying(room);
}

function startPlaying(room) {
  if (room.phase !== 'WORD_PICK') return;
  clearTimers(room);
  const N = room.players.length;
  room.booklets = room.players.map((p, i) => ({
    id: `b${i}`,
    ownerId: p.id,
    ownerName: p.name,
    ownerAvatar: p.avatar,
    steps: [
      {
        type: 'WORD',
        authorId: p.id,
        authorName: p.name,
        authorAvatar: p.avatar,
        content: room.cards.get(p.id)[room.picks.get(p.id)],
      },
    ],
  }));
  room.phase = 'PLAYING';
  room.round = 1;
  room.totalRounds = totalRoundsFor(N);
  beginRound(room);
}

function roundComplete(room) {
  return room.players.every((p) => room.submissions.has(p.id) || !p.connected);
}

function beginRound(room) {
  room.submissions = new Map();
  const secs = stepTypeFor(room.round) === 'DRAWING' ? room.settings.drawTime : room.settings.guessTime;
  room.deadline = Date.now() + secs * 1000;
  // 이미 나간 플레이어는 이번 라운드를 빈 칸으로 처리해 게임이 멈추지 않게 한다.
  room.players.forEach((p) => {
    if (!p.connected) room.submissions.set(p.id, '');
  });
  room.players.forEach((p) => sendTask(room, p));
  broadcast(room);
  if (roundComplete(room)) {
    advance(room);
    return;
  }
  const round = room.round;
  room.timer = setTimeout(() => {
    room.grace = setTimeout(() => {
      if (room.phase === 'PLAYING' && room.round === round) advance(room);
    }, GRACE_MS);
  }, secs * 1000);
}

function advance(room) {
  clearTimers(room);
  const N = room.players.length;
  const type = stepTypeFor(room.round);
  room.players.forEach((p, i) => {
    let content = room.submissions.get(p.id) ?? '';
    if (type === 'GUESS' && !content) content = '???';
    room.booklets[bookletIndexFor(i, room.round, N)].steps.push({
      type,
      authorId: p.id,
      authorName: p.name,
      authorAvatar: p.avatar,
      content,
    });
  });

  if (room.round >= room.totalRounds) {
    room.phase = 'REVEAL';
    room.reveal = { b: 0, s: 0 };
    room.reactions = {};
    room.players.forEach((p) => sendRevealData(room, p));
    broadcast(room);
  } else {
    room.round += 1;
    beginRound(room);
  }
}

function resetToLobby(room) {
  clearTimers(room);
  room.players = room.players.filter((p) => p.connected);
  ensureHost(room);
  room.phase = 'LOBBY';
  room.round = 0;
  room.totalRounds = 0;
  room.deadline = 0;
  room.booklets = [];
  room.cards = new Map();
  room.picks = new Map();
  room.submissions = new Map();
  room.reveal = { b: 0, s: 0 };
  room.reactions = {};
}

/* ------------------------------ 소켓 ------------------------------ */
function attachPlayer(room, socket, player) {
  player.socketId = socket.id;
  player.connected = true;
  socket.data.roomId = room.roomId;
  socket.data.playerId = player.id;
  socket.join(room.roomId);
  clearTimeout(player.dropTimer);
  clearTimeout(room.cleanup);
  ensureHost(room);
}

function getCtx(socket) {
  const room = rooms.get(socket.data.roomId);
  if (!room) return {};
  const player = room.players.find((p) => p.id === socket.data.playerId);
  return { room, player };
}

function detach(room, player, { remove }) {
  player.connected = false;
  player.socketId = null;

  if (room.phase === 'LOBBY') {
    const doRemove = () => {
      if (player.connected) return;
      room.players = room.players.filter((p) => p.id !== player.id);
      ensureHost(room);
      broadcast(room);
      scheduleCleanup(room);
    };
    if (remove) doRemove();
    else player.dropTimer = setTimeout(doRemove, LOBBY_DISCONNECT_MS);
  } else if (room.phase === 'WORD_PICK') {
    if (!room.picks.has(player.id)) room.picks.set(player.id, Math.floor(Math.random() * 6));
    ensureHost(room);
    broadcast(room);
    if (room.picks.size >= room.players.length) startPlaying(room);
  } else if (room.phase === 'PLAYING') {
    ensureHost(room);
    broadcast(room);
    if (roundComplete(room)) advance(room);
  } else {
    ensureHost(room);
    broadcast(room);
  }
  ensureHost(room);
  broadcast(room);
  scheduleCleanup(room);
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ playerId, name, avatar }, cb) => {
    if (!playerId) return cb?.({ ok: false, error: '잘못된 요청이에요.' });
    const roomId = generateRoomCode();
    const player = {
      id: String(playerId),
      name: cleanName(name),
      avatar: cleanAvatar(avatar),
      socketId: null,
      connected: true,
    };
    const room = {
      roomId,
      hostId: player.id,
      players: [player],
      settings: defaultSettings(),
      phase: 'LOBBY',
      round: 0,
      totalRounds: 0,
      deadline: 0,
      booklets: [],
      cards: new Map(),
      picks: new Map(),
      submissions: new Map(),
      reveal: { b: 0, s: 0 },
      reactions: {},
      timer: null,
      grace: null,
      cleanup: null,
    };
    rooms.set(roomId, room);
    attachPlayer(room, socket, player);
    cb?.({ ok: true, roomId });
    syncPlayer(room, player);
  });

  socket.on('joinRoom', ({ roomId, playerId, name, avatar }, cb) => {
    const room = rooms.get(String(roomId ?? '').toUpperCase());
    if (!room) return cb?.({ ok: false, error: '존재하지 않는 방 코드예요.' });
    if (!playerId) return cb?.({ ok: false, error: '잘못된 요청이에요.' });

    let player = room.players.find((p) => p.id === String(playerId));
    if (!player) {
      if (room.phase !== 'LOBBY') return cb?.({ ok: false, error: '이미 게임이 시작된 방이에요.' });
      if (room.players.length >= MAX_PLAYERS) return cb?.({ ok: false, error: `방이 가득 찼어요 (최대 ${MAX_PLAYERS}명).` });
      player = {
        id: String(playerId),
        name: cleanName(name),
        avatar: cleanAvatar(avatar),
        socketId: null,
        connected: false,
      };
      room.players.push(player);
    }
    attachPlayer(room, socket, player);
    cb?.({ ok: true, roomId: room.roomId });
    syncPlayer(room, player);
    broadcast(room);
  });

  socket.on('leaveRoom', () => {
    const { room, player } = getCtx(socket);
    if (!room || !player) return;
    socket.leave(room.roomId);
    socket.data.roomId = null;
    socket.data.playerId = null;
    detach(room, player, { remove: true });
  });

  socket.on('updateSettings', (incoming) => {
    const { room, player } = getCtx(socket);
    if (!room || !player || room.hostId !== player.id || room.phase !== 'LOBBY') return;
    const s = room.settings;
    const validCats = [...CATEGORIES.map((c) => c.id), 'all', 'custom'];
    if (validCats.includes(incoming.category)) s.category = incoming.category;
    if (DRAW_TIMES.includes(incoming.drawTime)) s.drawTime = incoming.drawTime;
    if (GUESS_TIMES.includes(incoming.guessTime)) s.guessTime = incoming.guessTime;
    if (Array.isArray(incoming.customWords)) {
      s.customWords = incoming.customWords
        .map((w) => String(w).trim().slice(0, 20))
        .filter(Boolean)
        .slice(0, 200);
    }
    broadcast(room);
  });

  socket.on('startGame', (_payload, cb) => {
    const { room, player } = getCtx(socket);
    if (!room || !player || room.hostId !== player.id || room.phase !== 'LOBBY') return;
    room.players = room.players.filter((p) => p.connected);
    if (room.players.length < MIN_PLAYERS) {
      broadcast(room);
      return cb?.({ ok: false, error: `최소 ${MIN_PLAYERS}명이 필요해요.` });
    }
    if (room.settings.category === 'custom' && room.settings.customWords.length === 0) {
      return cb?.({ ok: false, error: '직접 입력 단어를 1개 이상 적어 주세요.' });
    }
    cb?.({ ok: true });
    startWordPick(room);
  });

  socket.on('pickWord', ({ index }) => {
    const { room, player } = getCtx(socket);
    if (!room || !player || room.phase !== 'WORD_PICK' || room.picks.has(player.id)) return;
    if (!Number.isInteger(index) || index < 0 || index > 5) return;
    room.picks.set(player.id, index);
    broadcast(room);
    if (room.picks.size >= room.players.length) startPlaying(room);
  });

  socket.on('submitStep', ({ round, content }) => {
    const { room, player } = getCtx(socket);
    if (!room || !player || room.phase !== 'PLAYING' || round !== room.round) return;
    if (room.submissions.has(player.id)) return;
    let value = typeof content === 'string' ? content : '';
    if (stepTypeFor(room.round) === 'GUESS') value = value.trim().slice(0, 40);
    else if (!value.startsWith('data:image/') || value.length > 2_500_000) value = '';
    room.submissions.set(player.id, value);
    broadcast(room);
    if (roundComplete(room)) advance(room);
  });

  socket.on('revealNav', ({ b, s }) => {
    const { room, player } = getCtx(socket);
    if (!room || !player || room.phase !== 'REVEAL' || room.hostId !== player.id) return;
    if (!Number.isInteger(b) || !Number.isInteger(s)) return;
    if (b < 0 || b > room.booklets.length) return;
    const maxStep = b < room.booklets.length ? room.booklets[b].steps.length - 1 : 0;
    room.reveal = { b, s: Math.max(0, Math.min(s, maxStep)) };
    broadcast(room);
  });

  socket.on('react', ({ key, type }) => {
    const { room, player } = getCtx(socket);
    if (!room || !player || room.phase !== 'REVEAL' || !REACTIONS.includes(type)) return;
    const [bookletId, stepIdx] = String(key).split(':');
    const booklet = room.booklets.find((b) => b.id === bookletId);
    if (!booklet || !booklet.steps[Number(stepIdx)]) return;
    const entry = (room.reactions[key] ??= { funny: [], art: [], twist: [] });
    const list = entry[type];
    const at = list.indexOf(player.id);
    if (at >= 0) list.splice(at, 1);
    else list.push(player.id);
    broadcast(room);
  });

  socket.on('playAgain', () => {
    const { room, player } = getCtx(socket);
    if (!room || !player || room.hostId !== player.id || room.phase !== 'REVEAL') return;
    resetToLobby(room);
    broadcast(room);
  });

  socket.on('disconnect', () => {
    const { room, player } = getCtx(socket);
    if (!room || !player || player.socketId !== socket.id) return;
    detach(room, player, { remove: false });
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Telestrations server running on port ${PORT}`);
});

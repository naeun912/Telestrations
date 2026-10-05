import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Helper: Korean word sample generator for server
const WORDS_DATABASE = [
  '피카츄', '강아지', '고양이', '짜장면', '피자', '오징어 게임', '기생충',
  '선풍기', '아이스크림', '비행기', '자전거', '선글라스', '크리스마스 트리',
  '너 T야?', '중꺾마', '킹받네', '폼 미쳤다', '탕후루', '붕어빵', '떡볶이',
  '마라탕', 'BTS', '뉴진스', '월요병', '블랙홀', '초능력자', '타임머신'
];

function getRandomWords(count) {
  const shuffled = [...WORDS_DATABASE].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// In-Memory Rooms Database
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

io.on('connection', (socket) => {
  console.log(`[Socket] Player connected: ${socket.id}`);

  // Create Room
  socket.on('createRoom', ({ playerName, avatar }, callback) => {
    let roomId = generateRoomCode();
    while (rooms.has(roomId)) {
      roomId = generateRoomCode();
    }

    const player = {
      id: socket.id,
      name: playerName || '플레이어',
      avatar: avatar || '🐶',
      isHost: true,
      isReady: true,
      hasSubmittedCurrentStep: false
    };

    const room = {
      roomId,
      mode: 'ONLINE',
      hostId: socket.id,
      players: [player],
      settings: {
        category: 'easy',
        timeLimit: 60,
        customWords: []
      },
      phase: 'LOBBY',
      currentRound: 0,
      totalRounds: 0,
      booklets: [],
      submissions: new Map(), // socketId -> submitted content
      timer: null,
      timeLeft: 60
    };

    rooms.set(roomId, room);
    socket.join(roomId);

    console.log(`[Room Created] ${roomId} by ${playerName}`);
    callback({ success: true, roomId, room });
  });

  // Join Room
  socket.on('joinRoom', ({ roomId, playerName, avatar }, callback) => {
    const code = (roomId || '').toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      return callback({ success: false, error: '존재하지 않는 방 코드입니다.' });
    }

    if (room.phase !== 'LOBBY') {
      return callback({ success: false, error: '이미 진행 중인 방입니다.' });
    }

    if (room.players.length >= 10) {
      return callback({ success: false, error: '방이 가득 찼습니다 (최대 10명).' });
    }

    const player = {
      id: socket.id,
      name: playerName || '플레이어',
      avatar: avatar || '🐱',
      isHost: false,
      isReady: true,
      hasSubmittedCurrentStep: false
    };

    room.players.push(player);
    socket.join(code);

    io.to(code).emit('roomUpdated', room);
    console.log(`[Player Joined] ${playerName} joined room ${code}`);
    callback({ success: true, roomId: code, room });
  });

  // Start Game
  socket.on('startGame', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    const N = room.players.length;
    if (N < 3) return; // Minimum 3 players

    const isOdd = N % 2 !== 0;
    const secretWords = getRandomWords(N);

    // Initialize Booklets
    room.booklets = room.players.map((p, idx) => {
      const word = secretWords[idx];
      return {
        id: `booklet_${idx}_${Date.now()}`,
        originalOwnerId: p.id,
        originalOwnerName: p.name,
        originalWord: word,
        steps: [
          {
            stepIndex: 0,
            type: 'WORD',
            authorId: p.id,
            authorName: p.name,
            authorAvatar: p.avatar,
            content: word
          }
        ]
      };
    });

    room.phase = 'PLAYING';
    room.currentRound = 1;
    room.totalRounds = N; // N rounds total
    room.submissions.clear();

    room.players.forEach(p => p.hasSubmittedCurrentStep = false);

    io.to(roomId).emit('gameStarted', room);
    console.log(`[Game Started] Room ${roomId} with ${N} players (${isOdd ? 'ODD' : 'EVEN'})`);
  });

  // Submit Step Content (Drawing or Guess)
  socket.on('submitStep', ({ roomId, content }) => {
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'PLAYING') return;

    room.submissions.set(socket.id, content);
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.hasSubmittedCurrentStep = true;
    }

    io.to(roomId).emit('submissionProgress', {
      submittedCount: room.submissions.size,
      totalCount: room.players.length,
      players: room.players
    });

    // Check if all players in room submitted
    if (room.submissions.size >= room.players.length) {
      advanceRound(room);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    rooms.forEach((room, code) => {
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.players.length === 0) {
          rooms.delete(code);
        } else {
          if (room.hostId === socket.id) {
            room.hostId = room.players[0].id;
            room.players[0].isHost = true;
          }
          io.to(code).emit('roomUpdated', room);
        }
      }
    });
  });
});

function advanceRound(room) {
  const N = room.players.length;
  const isOdd = N % 2 !== 0;
  const currentRound = room.currentRound;

  // Append submissions to appropriate booklets
  room.players.forEach((p, pIdx) => {
    const content = room.submissions.get(p.id) || (currentRound % 2 === 1 ? '' : '알 수 없음');

    // Calculate which booklet player held in this round
    let shift = isOdd ? (currentRound - 1) + 1 : (currentRound - 1);
    let bookletIdx = (pIdx - shift + N * 10) % N;
    let booklet = room.booklets[bookletIdx];

    booklet.steps.push({
      stepIndex: booklet.steps.length,
      type: currentRound % 2 === 1 ? 'DRAWING' : 'GUESS',
      authorId: p.id,
      authorName: p.name,
      authorAvatar: p.avatar,
      content
    });
  });

  room.submissions.clear();
  room.players.forEach(p => p.hasSubmittedCurrentStep = false);

  if (currentRound >= room.totalRounds) {
    // Game Over -> Reveal phase!
    room.phase = 'REVEAL';
    io.to(room.roomId).emit('gameFinished', room);
  } else {
    room.currentRound += 1;
    io.to(room.roomId).emit('roundAdvanced', room);
  }
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Telestrations Socket.io Server running on port ${PORT}`);
});

import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { io, Socket } from 'socket.io-client';
import { Booklet, OnlineState, ReactionType, Settings, Task } from '../types/game';
import { loadProfile, saveProfile, StoredProfile } from '../utils/players';
import { dealCard } from '../data/words';
import { bookletIndexFor, stepTypeFor, totalRoundsFor } from '../game/logic';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) || undefined;

export type ConnStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface Ack {
  ok: boolean;
  error?: string;
  roomId?: string;
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Reliable STUN + TURN Server Config for Mobile 5G/LTE & PC Cross-Network WebRTC
const PEER_CONFIG = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:openrelay.metered.ca:80' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
  },
};

export function useOnlineGame() {
  const profileRef = useRef<StoredProfile>(loadProfile());
  const modeRef = useRef<'socket' | 'peer'>('peer');

  const socketRef = useRef<Socket | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const hostConnRef = useRef<DataConnection | null>(null);
  const hostRoomStateRef = useRef<any>(null);
  const hostTimerRef = useRef<any>(null);

  const [status, setStatus] = useState<ConnStatus>('idle');
  const [state, setState] = useState<OnlineState | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [booklets, setBooklets] = useState<Booklet[]>([]);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');

  const updateProfile = useCallback((patch: Partial<StoredProfile>) => {
    profileRef.current = { ...profileRef.current, ...patch };
    saveProfile(profileRef.current);
  }, []);

  const resetLocalView = useCallback(() => {
    setState(null);
    setTask(null);
    setBooklets([]);
  }, []);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const broadcastPeerState = useCallback(() => {
    const room = hostRoomStateRef.current;
    if (!room) return;

    room.players.forEach((p: any) => {
      const pState: OnlineState = {
        roomId: room.roomId,
        phase: room.phase,
        hostId: room.hostId,
        players: room.players.map((pl: any) => ({
          id: pl.id,
          name: pl.name,
          avatar: pl.avatar,
          connected: pl.connected,
          submitted: room.phase === 'WORD_PICK' ? room.picks.has(pl.id) : room.phase === 'PLAYING' ? room.submissions.has(pl.id) : false,
        })),
        settings: room.settings,
        round: room.round,
        totalRounds: room.totalRounds,
        deadline: room.deadline,
        serverTime: Date.now(),
        youId: p.id,
        reveal: room.reveal,
        reactions: room.reactions,
        card: room.phase === 'WORD_PICK' ? room.cards.get(p.id) : undefined,
        picked: room.phase === 'WORD_PICK' ? room.picks.has(p.id) : undefined,
      };

      if (p.id === room.hostId) {
        setOffset(0);
        setState(pState);
      } else {
        const conn = connectionsRef.current.get(p.id);
        if (conn && conn.open) {
          conn.send({ type: 'state', state: pState });
        }
      }
    });
  }, []);

  const sendPeerTask = useCallback((player: any) => {
    const room = hostRoomStateRef.current;
    if (!room || room.phase !== 'PLAYING') return;

    const idx = room.players.findIndex((p: any) => p.id === player.id);
    const bIdx = bookletIndexFor(idx, room.round, room.players.length);
    const last = room.booklets[bIdx].steps[room.booklets[bIdx].steps.length - 1];

    const taskObj: Task = {
      round: room.round,
      type: stepTypeFor(room.round),
      text: last.type === 'DRAWING' ? null : last.content,
      image: last.type === 'DRAWING' ? last.content : null,
    };

    if (player.id === room.hostId) {
      setTask(taskObj);
    } else {
      const conn = connectionsRef.current.get(player.id);
      if (conn && conn.open) {
        conn.send({ type: 'task', task: taskObj });
      }
    }
  }, []);

  const sendPeerRevealData = useCallback((player: any) => {
    const room = hostRoomStateRef.current;
    if (!room || room.phase !== 'REVEAL') return;

    if (player.id === room.hostId) {
      setBooklets(room.booklets);
    } else {
      const conn = connectionsRef.current.get(player.id);
      if (conn && conn.open) {
        conn.send({ type: 'revealData', booklets: room.booklets });
      }
    }
  }, []);

  const startPeerWordPick = useCallback(() => {
    const room = hostRoomStateRef.current;
    if (!room) return;

    const used = new Set<string>();
    room.cards = new Map();
    room.picks = new Map();

    room.players.forEach((p: any) => {
      room.cards.set(p.id, dealCard(room.settings.category, room.settings.customWords, used));
    });

    room.phase = 'WORD_PICK';
    room.deadline = Date.now() + 25 * 1000;

    clearTimeout(hostTimerRef.current);
    hostTimerRef.current = setTimeout(() => {
      room.players.forEach((p: any) => {
        if (!room.picks.has(p.id)) room.picks.set(p.id, Math.floor(Math.random() * 6));
      });
      startPeerPlaying();
    }, 25 * 1000);

    broadcastPeerState();
  }, [broadcastPeerState]);

  const startPeerPlaying = useCallback(() => {
    const room = hostRoomStateRef.current;
    if (!room || room.phase !== 'WORD_PICK') return;

    clearTimeout(hostTimerRef.current);
    const N = room.players.length;

    room.booklets = room.players.map((p: any, i: number) => ({
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
    beginPeerRound();
  }, []);

  const beginPeerRound = useCallback(() => {
    const room = hostRoomStateRef.current;
    if (!room) return;

    room.submissions = new Map();
    const secs = stepTypeFor(room.round) === 'DRAWING' ? room.settings.drawTime : room.settings.guessTime;
    room.deadline = Date.now() + secs * 1000;

    room.players.forEach((p: any) => sendPeerTask(p));
    broadcastPeerState();

    const round = room.round;
    clearTimeout(hostTimerRef.current);
    hostTimerRef.current = setTimeout(() => {
      if (room.phase === 'PLAYING' && room.round === round) {
        advancePeerRound();
      }
    }, (secs + 4) * 1000);
  }, [broadcastPeerState, sendPeerTask]);

  const advancePeerRound = useCallback(() => {
    const room = hostRoomStateRef.current;
    if (!room) return;

    clearTimeout(hostTimerRef.current);
    const N = room.players.length;
    const type = stepTypeFor(room.round);

    room.players.forEach((p: any, i: number) => {
      let content = room.submissions.get(p.id) ?? '';
      if (type === 'GUESS' && !content.trim()) content = '(시간초과 미작성)';
      const bIdx = bookletIndexFor(i, room.round, N);

      room.booklets[bIdx].steps.push({
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
      room.players.forEach((p: any) => sendPeerRevealData(p));
      broadcastPeerState();
    } else {
      room.round += 1;
      beginPeerRound();
    }
  }, [beginPeerRound, broadcastPeerState, sendPeerRevealData]);

  const handleHostAction = useCallback((msg: any) => {
    const room = hostRoomStateRef.current;
    if (!room) return;

    if (msg.type === 'shufflePlayers' && room.phase === 'LOBBY') {
      room.players = shuffle(room.players);
      broadcastPeerState();
    } else if (msg.type === 'updateSettings' && room.phase === 'LOBBY') {
      room.settings = { ...room.settings, ...msg.settings };
      broadcastPeerState();
    } else if (msg.type === 'startGame' && room.phase === 'LOBBY') {
      if (room.players.length >= 3) {
        startPeerWordPick();
      }
    } else if (msg.type === 'pickWord' && room.phase === 'WORD_PICK') {
      room.picks.set(msg.playerId, msg.index);
      broadcastPeerState();
      if (room.picks.size >= room.players.length) {
        startPeerPlaying();
      }
    } else if (msg.type === 'submitStep' && room.phase === 'PLAYING' && msg.round === room.round) {
      room.submissions.set(msg.playerId, msg.content);
      broadcastPeerState();
      if (room.submissions.size >= room.players.length) {
        advancePeerRound();
      }
    } else if (msg.type === 'revealNav' && room.phase === 'REVEAL') {
      room.reveal = { b: msg.b, s: msg.s };
      broadcastPeerState();
    } else if (msg.type === 'react' && room.phase === 'REVEAL') {
      const entry = (room.reactions[msg.key] ??= { funny: [], art: [], twist: [] });
      const list = entry[msg.typeReaction as ReactionType];
      const at = list.indexOf(msg.playerId);
      if (at >= 0) list.splice(at, 1);
      else list.push(msg.playerId);
      broadcastPeerState();
    } else if (msg.type === 'playAgain' && room.phase === 'REVEAL') {
      room.phase = 'LOBBY';
      room.round = 0;
      room.totalRounds = 0;
      room.booklets = [];
      room.cards = new Map();
      room.picks = new Map();
      room.submissions = new Map();
      room.reveal = { b: 0, s: 0 };
      room.reactions = {};
      broadcastPeerState();
    }
  }, [advancePeerRound, broadcastPeerState, startPeerPlaying, startPeerWordPick]);

  // Create Peer Room (Host) with Mobile STUN & WSS Config
  const createPeerRoom = useCallback(async (name: string, avatar: string): Promise<boolean> => {
    setStatus('connecting');
    const roomId = generateRoomCode();
    const peerId = `troom-${roomId}`;

    return new Promise((resolve) => {
      let isResolved = false;
      const peer = new Peer(peerId, PEER_CONFIG);
      peerRef.current = peer;
      modeRef.current = 'peer';

      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          setError('모바일 네트워크 연결에 실패했습니다. 다시 시도해 주세요.');
          setStatus('error');
          resolve(false);
        }
      }, 10000);

      peer.on('open', () => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeout);
        setStatus('connected');

        const p = profileRef.current;
        const hostPlayer = { id: p.playerId, name, avatar, connected: true };

        const room = {
          roomId,
          hostId: p.playerId,
          players: [hostPlayer],
          settings: { category: 'easy', drawTime: 60, guessTime: 30, customWords: [] },
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
        };

        hostRoomStateRef.current = room;
        updateProfile({ name, avatar, roomId });
        broadcastPeerState();
        resolve(true);
      });

      peer.on('connection', (conn) => {
        conn.on('data', (data: any) => {
          if (data.type === 'joinRoom') {
            const room = hostRoomStateRef.current;
            if (room && room.phase === 'LOBBY') {
              const existingIndex = room.players.findIndex((pl: any) => pl.id === data.playerId);
              if (existingIndex === -1) {
                room.players.push({ id: data.playerId, name: data.name, avatar: data.avatar, connected: true });
              }
              connectionsRef.current.set(data.playerId, conn);
              broadcastPeerState();
            }
          } else {
            handleHostAction(data);
          }
        });

        conn.on('close', () => {
          const room = hostRoomStateRef.current;
          if (room) {
            const player = room.players.find((pl: any) => connectionsRef.current.get(pl.id) === conn);
            if (player) {
              player.connected = false;
              broadcastPeerState();
            }
          }
        });
      });

      peer.on('error', (err) => {
        console.error('[PeerJS Mobile Error]', err);
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          setError('모바일 방 생성 실패. 잠시 후 다시 시도해 주세요.');
          setStatus('error');
          resolve(false);
        }
      });
    });
  }, [broadcastPeerState, handleHostAction, updateProfile]);

  // Join Peer Room (Client) with Mobile STUN & WSS Config
  const joinPeerRoom = useCallback(async (code: string, name: string, avatar: string): Promise<boolean> => {
    setStatus('connecting');
    const targetPeerId = `troom-${code.toUpperCase()}`;

    return new Promise((resolve) => {
      let isResolved = false;
      const peer = new Peer(PEER_CONFIG);
      peerRef.current = peer;
      modeRef.current = 'peer';

      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          setError('방 입장에 실패했습니다. 네트워크 연결 상태 또는 방 코드를 확인해 주세요.');
          setStatus('error');
          resolve(false);
        }
      }, 15000);

      peer.on('open', () => {
        const conn = peer.connect(targetPeerId, { reliable: true });
        hostConnRef.current = conn;

        conn.on('open', () => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeout);
          setStatus('connected');

          const p = profileRef.current;
          updateProfile({ name, avatar, roomId: code.toUpperCase() });

          conn.send({
            type: 'joinRoom',
            playerId: p.playerId,
            name,
            avatar,
          });
          resolve(true);
        });

        conn.on('data', (data: any) => {
          if (data.type === 'state') {
            setState(data.state);
          } else if (data.type === 'task') {
            setTask(data.task);
          } else if (data.type === 'revealData') {
            setBooklets(data.booklets);
          }
        });

        conn.on('close', () => {
          setStatus('connecting');
        });

        conn.on('error', () => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            setError('방 연결 실패. 방 코드를 확인해 주세요.');
            setStatus('error');
            resolve(false);
          }
        });
      });

      peer.on('error', () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          setError('존재하지 않거나 열리지 않은 방 코드입니다.');
          setStatus('error');
          resolve(false);
        }
      });
    });
  }, [updateProfile]);

  const sendAction = (type: string, payload: any = {}) => {
    const p = profileRef.current;
    if (modeRef.current === 'peer') {
      const msg = { type, playerId: p.playerId, ...payload };
      if (hostRoomStateRef.current) {
        handleHostAction(msg);
      } else if (hostConnRef.current && hostConnRef.current.open) {
        hostConnRef.current.send(msg);
      }
    } else {
      socketRef.current?.emit(type, payload);
    }
  };

  return {
    status,
    state,
    task,
    booklets,
    offset,
    error,
    setError,
    profile: profileRef.current,
    createRoom: async (name: string, avatar: string) => {
      setError('');
      return createPeerRoom(name, avatar);
    },
    joinRoom: async (code: string, name: string, avatar: string) => {
      setError('');
      return joinPeerRoom(code, name, avatar);
    },
    leaveRoom: () => {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      updateProfile({ roomId: null });
      resetLocalView();
    },
    shufflePlayers: () => sendAction('shufflePlayers'),
    updateSettings: (s: Settings) => sendAction('updateSettings', { settings: s }),
    startGame: async (): Promise<Ack> => {
      if (state && state.players.length < 3) {
        return { ok: false, error: '최소 3명이 필요해요.' };
      }
      sendAction('startGame');
      return { ok: true };
    },
    pickWord: (index: number) => sendAction('pickWord', { index }),
    submit: (round: number, content: string) => sendAction('submitStep', { round, content }),
    revealNav: (b: number, s: number) => sendAction('revealNav', { b, s }),
    react: (key: string, type: ReactionType) => sendAction('react', { key, typeReaction: type }),
    playAgain: () => sendAction('playAgain'),
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { io, Socket } from 'socket.io-client';
import { Booklet, MAX_PLAYERS, OnlineState, ReactionType, Settings, Task } from '../types/game';
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

interface JoinResult {
  ok: boolean;
  error?: string;
  /** 방장이 명시적으로 거절한 경우(재시도 불필요) */
  rejected?: boolean;
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

const JOIN_TIMEOUT_MS = 15000;
const HEARTBEAT_MS = 4000;
const CLIENT_STALE_MS = 15000;
const HOST_STALE_MS = 25000;
const RECONNECT_WINDOW_MS = 60000;
const HOST_ONLY_ACTIONS = ['shufflePlayers', 'updateSettings', 'startGame', 'revealNav', 'playAgain'];

export function useOnlineGame() {
  const profileRef = useRef<StoredProfile>(loadProfile());
  const modeRef = useRef<'socket' | 'peer'>('peer');

  const socketRef = useRef<Socket | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const hostConnRef = useRef<DataConnection | null>(null);
  const hostRoomStateRef = useRef<any>(null);
  const hostTimerRef = useRef<any>(null);

  // --- 재접속/세션 관리 ---
  const sessionRef = useRef(0);
  const lastJoinRef = useRef<{ code: string; name: string; avatar: string } | null>(null);
  const reconnectingRef = useRef(false);
  const reconnectRef = useRef<() => void>(() => {});
  const pingTimerRef = useRef<any>(null);
  const sweepTimerRef = useRef<any>(null);
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const lastHostMsgRef = useRef(0);
  const pendingActionsRef = useRef<Map<string, any>>(new Map());

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

  /** 방장/참가자 공통: 타이머, 연결, 상태를 전부 정리한다. */
  const teardownSession = useCallback((delayDestroyMs = 0) => {
    clearTimeout(hostTimerRef.current);
    hostTimerRef.current = null;
    if (sweepTimerRef.current) {
      clearInterval(sweepTimerRef.current);
      sweepTimerRef.current = null;
    }
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    hostRoomStateRef.current = null;
    connectionsRef.current.clear();
    lastSeenRef.current.clear();
    pendingActionsRef.current.clear();
    hostConnRef.current = null;
    lastJoinRef.current = null;
    reconnectingRef.current = false;

    const peer = peerRef.current;
    peerRef.current = null;
    if (peer) {
      const kill = () => {
        try {
          peer.destroy();
        } catch {
          /* ignore */
        }
      };
      if (delayDestroyMs > 0) setTimeout(kill, delayDestroyMs);
      else kill();
    }
  }, []);

  /** 오류 메시지와 함께 세션을 끝내고 첫 화면으로 돌려보낸다. */
  const endSession = useCallback(
    (message: string) => {
      sessionRef.current += 1;
      teardownSession();
      updateProfile({ roomId: null });
      resetLocalView();
      setError(message);
      setStatus('idle');
    },
    [resetLocalView, teardownSession, updateProfile],
  );

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
          // 접속이 끊겨 고르지 못한 사람은 첫 번째 카드로 자동 선택
          content: room.cards.get(p.id)[room.picks.get(p.id) ?? 0],
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

  /** 접속 중인 모든 플레이어가 끝냈으면 다음 단계로 진행한다. (끊긴 사람은 기다리지 않음) */
  const checkPeerProgress = useCallback(() => {
    const room = hostRoomStateRef.current;
    if (!room) return;
    const active = room.players.filter((p: any) => p.connected);
    if (active.length === 0) return;

    if (room.phase === 'WORD_PICK') {
      if (active.every((p: any) => room.picks.has(p.id))) startPeerPlaying();
    } else if (room.phase === 'PLAYING') {
      if (active.every((p: any) => room.submissions.has(p.id))) advancePeerRound();
    }
  }, [advancePeerRound, startPeerPlaying]);

  /** 참가자 연결이 끊겼을 때: 로비면 제거, 게임 중이면 '끊김' 표시만 한다. */
  const dropPeerPlayer = useCallback(
    (playerId: string) => {
      const room = hostRoomStateRef.current;
      if (!room || playerId === room.hostId) return;

      connectionsRef.current.delete(playerId);
      lastSeenRef.current.delete(playerId);

      if (room.phase === 'LOBBY') {
        room.players = room.players.filter((p: any) => p.id !== playerId);
      } else {
        const p = room.players.find((pl: any) => pl.id === playerId);
        if (p) p.connected = false;
      }
      broadcastPeerState();
      checkPeerProgress();
    },
    [broadcastPeerState, checkPeerProgress],
  );

  const handleHostAction = useCallback((msg: any) => {
    const room = hostRoomStateRef.current;
    if (!room) return;

    if (HOST_ONLY_ACTIONS.includes(msg.type) && msg.playerId !== room.hostId) return;

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
      checkPeerProgress();
    } else if (msg.type === 'submitStep' && room.phase === 'PLAYING' && msg.round === room.round) {
      room.submissions.set(msg.playerId, msg.content);
      broadcastPeerState();
      checkPeerProgress();
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
      // 끊긴 사람은 새 판에서 제외
      room.players = room.players.filter((p: any) => p.connected);
      broadcastPeerState();
    }
  }, [broadcastPeerState, checkPeerProgress, startPeerWordPick]);

  /** 한 번 방 만들기를 시도한다. 'taken'이면 방 코드가 겹친 것이므로 새 코드로 재시도. */
  const tryCreateRoom = useCallback(
    (name: string, avatar: string, session: number): Promise<'ok' | 'taken' | 'fail'> => {
      const roomId = generateRoomCode();
      const peerId = `troom-${roomId}`;

      return new Promise((resolve) => {
        let done = false;
        const peer = new Peer(peerId, PEER_CONFIG);
        peerRef.current = peer;
        modeRef.current = 'peer';

        const finish = (r: 'ok' | 'taken' | 'fail') => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          if (r !== 'ok') {
            try {
              peer.destroy();
            } catch {
              /* ignore */
            }
            if (peerRef.current === peer) peerRef.current = null;
          }
          resolve(r);
        };

        const timeout = setTimeout(() => {
          setError('방 생성에 실패했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요.');
          finish('fail');
        }, JOIN_TIMEOUT_MS);

        peer.on('open', () => {
          if (done) return;
          if (sessionRef.current !== session) {
            finish('fail');
            return;
          }

          const p = profileRef.current;
          const hostPlayer = { id: p.playerId, name, avatar, connected: true };

          hostRoomStateRef.current = {
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

          updateProfile({ name, avatar, roomId });

          // 오래 응답 없는 참가자는 끊긴 것으로 처리
          sweepTimerRef.current = setInterval(() => {
            const room = hostRoomStateRef.current;
            if (!room) return;
            const now = Date.now();
            room.players.forEach((pl: any) => {
              if (pl.id === room.hostId || !pl.connected) return;
              const seen = lastSeenRef.current.get(pl.id);
              if (seen !== undefined && now - seen > HOST_STALE_MS) {
                const conn = connectionsRef.current.get(pl.id);
                try {
                  conn?.close();
                } catch {
                  /* ignore */
                }
                dropPeerPlayer(pl.id);
              }
            });
          }, 5000);

          broadcastPeerState();
          finish('ok');
        });

        // 시그널링 서버 연결이 끊기면 다시 붙여서 새 참가자가 방을 찾을 수 있게 한다.
        peer.on('disconnected', () => {
          if (!peer.destroyed) {
            try {
              peer.reconnect();
            } catch {
              /* ignore */
            }
          }
        });

        peer.on('connection', (conn) => {
          conn.on('data', (data: any) => {
            const room = hostRoomStateRef.current;
            if (!room || !data || typeof data !== 'object') return;

            if (data.type === 'joinRoom') {
              if (data.playerId === room.hostId) {
                conn.send({
                  type: 'joinError',
                  error: '방장과 같은 브라우저에서는 참가할 수 없어요. 다른 기기나 시크릿 창을 사용해 주세요.',
                });
                return;
              }

              let player = room.players.find((pl: any) => pl.id === data.playerId);
              if (!player) {
                if (room.phase !== 'LOBBY') {
                  conn.send({ type: 'joinError', error: '이미 게임이 시작된 방이에요. 다음 판에 참가해 주세요.' });
                  return;
                }
                if (room.players.length >= MAX_PLAYERS) {
                  conn.send({ type: 'joinError', error: `방이 가득 찼어요. (최대 ${MAX_PLAYERS}명)` });
                  return;
                }
                player = { id: data.playerId, name: data.name, avatar: data.avatar, connected: true };
                room.players.push(player);
              } else {
                player.connected = true;
                if (room.phase === 'LOBBY') {
                  player.name = data.name;
                  player.avatar = data.avatar;
                }
              }

              connectionsRef.current.set(data.playerId, conn);
              lastSeenRef.current.set(data.playerId, Date.now());
              conn.send({ type: 'joinOk' });
              broadcastPeerState();
              // 게임 중 재접속: 현재 과제/결과 데이터를 다시 보내준다.
              if (room.phase === 'PLAYING') sendPeerTask(player);
              if (room.phase === 'REVEAL') sendPeerRevealData(player);
              return;
            }

            // 이 연결에 등록된 플레이어만 행동할 수 있다.
            if (connectionsRef.current.get(data.playerId) !== conn) return;
            lastSeenRef.current.set(data.playerId, Date.now());

            if (data.type === 'ping') {
              const pl = room.players.find((x: any) => x.id === data.playerId);
              if (pl && !pl.connected) {
                pl.connected = true;
                broadcastPeerState();
              }
              try {
                conn.send({ type: 'pong' });
              } catch {
                /* ignore */
              }
              return;
            }

            handleHostAction(data);
          });

          conn.on('close', () => {
            const room = hostRoomStateRef.current;
            if (!room) return;
            const player = room.players.find((pl: any) => connectionsRef.current.get(pl.id) === conn);
            if (player) dropPeerPlayer(player.id);
          });
        });

        peer.on('error', (err: any) => {
          console.error('[PeerJS Host Error]', err);
          if (done) return;
          if (err?.type === 'unavailable-id') {
            finish('taken');
          } else {
            setError('방 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
            finish('fail');
          }
        });
      });
    },
    [broadcastPeerState, dropPeerPlayer, handleHostAction, sendPeerRevealData, sendPeerTask, updateProfile],
  );

  const createPeerRoom = useCallback(
    async (name: string, avatar: string): Promise<boolean> => {
      setStatus('connecting');
      sessionRef.current += 1;
      teardownSession();
      const session = sessionRef.current;

      for (let i = 0; i < 4; i++) {
        const r = await tryCreateRoom(name, avatar, session);
        if (sessionRef.current !== session) return false;
        if (r === 'ok') {
          setStatus('connected');
          return true;
        }
        if (r === 'fail') {
          setStatus('error');
          return false;
        }
        // 'taken' → 방 코드 중복, 새 코드로 다시
      }
      setError('방 코드를 만들지 못했어요. 다시 시도해 주세요.');
      setStatus('error');
      return false;
    },
    [teardownSession, tryCreateRoom],
  );

  // ---------------- 참가자(클라이언트) ----------------

  const startHeartbeat = useCallback(() => {
    if (pingTimerRef.current) return;
    pingTimerRef.current = setInterval(() => {
      const conn = hostConnRef.current;
      if (!conn || reconnectingRef.current) return;

      // 방장에게서 한참 응답이 없으면 끊긴 것으로 보고 재접속
      if (Date.now() - lastHostMsgRef.current > CLIENT_STALE_MS) {
        hostConnRef.current = null;
        try {
          conn.close();
        } catch {
          /* ignore */
        }
        reconnectRef.current();
        return;
      }
      if (conn.open) {
        try {
          conn.send({ type: 'ping', playerId: profileRef.current.playerId });
        } catch {
          /* ignore */
        }
      }
    }, HEARTBEAT_MS);
  }, []);

  /** 방장에게 한 번 접속(또는 재접속)을 시도한다. */
  const attemptJoin = useCallback(
    (code: string, name: string, avatar: string): Promise<JoinResult> => {
      return new Promise((resolve) => {
        let done = false;
        const finish = (r: JoinResult) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(r);
        };

        if (peerRef.current) {
          try {
            peerRef.current.destroy();
          } catch {
            /* ignore */
          }
          peerRef.current = null;
        }
        hostConnRef.current = null;

        const peer = new Peer(PEER_CONFIG);
        peerRef.current = peer;
        modeRef.current = 'peer';

        const timer = setTimeout(() => {
          finish({ ok: false, error: '방 입장에 실패했습니다. 네트워크 상태 또는 방 코드를 확인해 주세요.' });
        }, JOIN_TIMEOUT_MS);

        peer.on('error', (err: any) => {
          if (done) return;
          finish({
            ok: false,
            error:
              err?.type === 'peer-unavailable'
                ? '존재하지 않거나 닫힌 방 코드입니다.'
                : '연결 서버에 접속하지 못했어요. 네트워크를 확인해 주세요.',
          });
        });

        peer.on('close', () => finish({ ok: false, error: '연결이 종료되었어요.' }));

        peer.on('open', () => {
          if (done) return;
          const conn = peer.connect(`troom-${code}`, { reliable: true });

          conn.on('open', () => {
            if (done) return;
            conn.send({
              type: 'joinRoom',
              playerId: profileRef.current.playerId,
              name,
              avatar,
            });
          });

          conn.on('data', (data: any) => {
            if (!data || typeof data !== 'object') return;
            lastHostMsgRef.current = Date.now();

            switch (data.type) {
              case 'joinOk':
                hostConnRef.current = conn;
                startHeartbeat();
                finish({ ok: true });
                break;
              case 'joinError':
                finish({ ok: false, error: data.error, rejected: true });
                try {
                  conn.close();
                } catch {
                  /* ignore */
                }
                break;
              case 'state':
                setState(data.state);
                break;
              case 'task':
                setTask(data.task);
                break;
              case 'revealData':
                setBooklets(data.booklets);
                break;
              case 'hostLeft':
                endSessionRef.current('방장이 방을 닫았어요.');
                break;
              default:
                break; // pong 등
            }
          });

          conn.on('close', () => {
            if (hostConnRef.current === conn) {
              hostConnRef.current = null;
              reconnectRef.current();
            } else {
              finish({ ok: false, error: '방 연결이 끊어졌어요.' });
            }
          });

          conn.on('error', () => {
            finish({ ok: false, error: '방 연결에 실패했어요. 방 코드를 확인해 주세요.' });
          });
        });
      });
    },
    [startHeartbeat],
  );

  // attemptJoin 안에서 endSession을 최신 상태로 호출하기 위한 ref
  const endSessionRef = useRef<(message: string) => void>(() => {});
  endSessionRef.current = endSession;

  /** 연결이 끊긴 참가자를 같은 플레이어로 자동 재접속시킨다. */
  const reconnectClient = useCallback(async () => {
    const info = lastJoinRef.current;
    if (!info || reconnectingRef.current) return;

    const session = sessionRef.current;
    reconnectingRef.current = true;
    setStatus('connecting');
    const started = Date.now();
    let rejectedMsg = '';

    while (sessionRef.current === session && Date.now() - started < RECONNECT_WINDOW_MS) {
      const r = await attemptJoin(info.code, info.name, info.avatar);
      if (sessionRef.current !== session) return;

      if (r.ok) {
        reconnectingRef.current = false;
        setStatus('connected');
        // 끊겨 있는 동안 못 보낸 제출/선택 재전송
        const conn = hostConnRef.current;
        if (conn && conn.open) {
          pendingActionsRef.current.forEach((msg) => {
            try {
              conn.send(msg);
            } catch {
              /* ignore */
            }
          });
        }
        pendingActionsRef.current.clear();
        return;
      }
      if (r.rejected) {
        rejectedMsg = r.error || '';
        break;
      }
      await new Promise((res) => setTimeout(res, 2000));
    }

    if (sessionRef.current !== session) return;
    endSession(rejectedMsg || '방장과의 연결이 끊겨서 방에서 나왔어요. 방 코드로 다시 입장해 주세요.');
  }, [attemptJoin, endSession]);
  reconnectRef.current = reconnectClient;

  const joinPeerRoom = useCallback(
    async (code: string, name: string, avatar: string): Promise<boolean> => {
      setStatus('connecting');
      sessionRef.current += 1;
      teardownSession();
      const session = sessionRef.current;
      const roomCode = code.trim().toUpperCase();

      const r = await attemptJoin(roomCode, name, avatar);
      if (sessionRef.current !== session) return false;

      if (!r.ok) {
        teardownSession();
        setError(r.error || '방 입장에 실패했습니다.');
        setStatus('error');
        return false;
      }

      lastJoinRef.current = { code: roomCode, name, avatar };
      updateProfile({ name, avatar, roomId: roomCode });
      setStatus('connected');
      return true;
    },
    [attemptJoin, teardownSession, updateProfile],
  );

  // 화면이 다시 켜지거나 네트워크가 복구되면 연결 상태를 점검하고 필요 시 재접속
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      if (hostRoomStateRef.current) return; // 방장은 해당 없음
      if (!lastJoinRef.current || reconnectingRef.current) return;

      const conn = hostConnRef.current;
      if (!conn || !conn.open || Date.now() - lastHostMsgRef.current > 10000) {
        if (conn) {
          hostConnRef.current = null;
          try {
            conn.close();
          } catch {
            /* ignore */
          }
        }
        reconnectRef.current();
      }
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    window.addEventListener('pageshow', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
      window.removeEventListener('pageshow', check);
    };
  }, []);

  // 게임 중 실수로 새로고침/닫기 하면 방이 사라지므로 경고
  const inRoom = state !== null;
  useEffect(() => {
    if (!inRoom) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [inRoom]);

  // 앱이 언마운트될 때 정리
  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      teardownSession();
    };
  }, [teardownSession]);

  const sendAction = (type: string, payload: any = {}) => {
    const p = profileRef.current;
    if (modeRef.current === 'peer') {
      const msg = { type, playerId: p.playerId, ...payload };
      if (hostRoomStateRef.current) {
        handleHostAction(msg);
      } else if (hostConnRef.current && hostConnRef.current.open) {
        hostConnRef.current.send(msg);
      } else if (lastJoinRef.current && (type === 'submitStep' || type === 'pickWord')) {
        // 재접속 중이면 보관했다가 연결되면 전송
        pendingActionsRef.current.set(type, msg);
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
      sessionRef.current += 1;
      const room = hostRoomStateRef.current;
      if (room) {
        // 방장이 나가면 참가자들에게 알려준다.
        connectionsRef.current.forEach((c) => {
          try {
            if (c.open) c.send({ type: 'hostLeft' });
          } catch {
            /* ignore */
          }
        });
      }
      teardownSession(room ? 300 : 0);
      updateProfile({ roomId: null });
      resetLocalView();
      setError('');
      setStatus('idle');
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Booklet, OnlineState, ReactionType, Settings, Task } from '../types/game';
import { loadProfile, saveProfile, StoredProfile } from '../utils/players';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) || undefined;

export type ConnStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface Ack {
  ok: boolean;
  error?: string;
  roomId?: string;
}

export function useOnlineGame() {
  const socketRef = useRef<Socket | null>(null);
  const profileRef = useRef<StoredProfile>(loadProfile());
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

  const attach = useCallback(
    (s: Socket) => {
      s.on('connect', () => {
        setStatus('connected');
        const p = profileRef.current;
        if (p.roomId) {
          // 새로고침 / 네트워크 끊김 후 자동으로 같은 자리에 재입장
          s.emit('joinRoom', { roomId: p.roomId, playerId: p.playerId, name: p.name, avatar: p.avatar }, (ack: Ack) => {
            if (!ack?.ok) {
              updateProfile({ roomId: null });
              resetLocalView();
              setError(ack?.error ?? '방에 다시 들어가지 못했어요.');
            }
          });
        }
      });
      s.on('connect_error', () => setStatus('error'));
      s.on('disconnect', () => setStatus('connecting'));
      s.on('state', (st: OnlineState) => {
        setOffset(st.serverTime - Date.now());
        setState(st);
      });
      s.on('task', (t: Task) => setTask(t));
      s.on('revealData', (d: { booklets: Booklet[] }) => setBooklets(d.booklets));
    },
    [resetLocalView, updateProfile],
  );

  const ensureSocket = useCallback((): Promise<Socket> => {
    return new Promise((resolve, reject) => {
      let s = socketRef.current;
      if (!s) {
        s = io(SERVER_URL, { reconnectionDelayMax: 3000 });
        attach(s);
        socketRef.current = s;
      }
      if (s.connected) return resolve(s);
      setStatus('connecting');
      const sock = s;
      const timer = setTimeout(() => {
        sock.off('connect', onConnect);
        setStatus('error');
        reject(new Error('서버에 연결할 수 없어요. 잠시 후 다시 시도하거나 "한 기기로 같이 하기"를 이용해 주세요.'));
      }, 7000);
      const onConnect = () => {
        clearTimeout(timer);
        resolve(sock);
      };
      sock.once('connect', onConnect);
    });
  }, [attach]);

  /** 앱 시작 시 이전 방이 남아 있으면 자동 재입장 */
  useEffect(() => {
    if (profileRef.current.roomId) void ensureSocket().catch(() => undefined);
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [ensureSocket]);

  const enterRoom = useCallback(
    async (event: 'createRoom' | 'joinRoom', name: string, avatar: string, roomId?: string): Promise<boolean> => {
      setError('');
      try {
        const s = await ensureSocket();
        const base = profileRef.current;
        return await new Promise<boolean>((resolve) => {
          s.emit(event, { roomId, playerId: base.playerId, name, avatar }, (ack: Ack) => {
            if (ack?.ok && ack.roomId) {
              updateProfile({ name, avatar, roomId: ack.roomId });
              resolve(true);
            } else {
              setError(ack?.error ?? '입장하지 못했어요.');
              resolve(false);
            }
          });
        });
      } catch (e) {
        setError((e as Error).message);
        return false;
      }
    },
    [ensureSocket, updateProfile],
  );

  const emit = useCallback((event: string, payload?: unknown) => {
    socketRef.current?.emit(event, payload);
  }, []);

  return {
    status,
    state,
    task,
    booklets,
    offset,
    error,
    setError,
    profile: profileRef.current,
    createRoom: (name: string, avatar: string) => enterRoom('createRoom', name, avatar),
    joinRoom: (code: string, name: string, avatar: string) => enterRoom('joinRoom', name, avatar, code.toUpperCase()),
    leaveRoom: () => {
      emit('leaveRoom');
      updateProfile({ roomId: null });
      resetLocalView();
    },
    updateSettings: (s: Settings) => emit('updateSettings', s),
    startGame: (): Promise<Ack> =>
      new Promise((resolve) => {
        const s = socketRef.current;
        if (!s) return resolve({ ok: false, error: '연결이 끊겼어요.' });
        s.emit('startGame', {}, (ack: Ack) => resolve(ack ?? { ok: true }));
      }),
    pickWord: (index: number) => emit('pickWord', { index }),
    submit: (round: number, content: string) => emit('submitStep', { round, content }),
    revealNav: (b: number, s: number) => emit('revealNav', { b, s }),
    react: (key: string, type: ReactionType) => emit('react', { key, type }),
    playAgain: () => emit('playAgain'),
  };
}

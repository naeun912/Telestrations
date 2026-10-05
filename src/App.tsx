import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Booklet, BookletStep, GameMode, GamePhase, Player, RoomSettings } from './types/game';
import { getRandomWords } from './data/words';
import { Lobby } from './components/Lobby';
import { GameRoom } from './components/GameRoom';
import { RevealPresentation } from './components/RevealPresentation';
import { soundFx } from './utils/sound';

export const App: React.FC = () => {
  const [phase, setPhase] = useState<GamePhase>('LOBBY');
  const [mode, setMode] = useState<GameMode>('PASS_AND_PLAY');
  const [players, setPlayers] = useState<Player[]>([]);
  const [settings, setSettings] = useState<RoomSettings>({
    category: 'easy',
    timeLimit: 60,
    customWords: []
  });

  const [booklets, setBooklets] = useState<Booklet[]>([]);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [totalRounds, setTotalRounds] = useState<number>(4);
  const [passAndPlayIndex, setPassAndPlayIndex] = useState<number>(0);
  const [showShield, setShowShield] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Socket.io for Realtime Online mode
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineRoomId, setOnlineRoomId] = useState<string>('');

  useEffect(() => {
    // Initialize Socket connection conditionally
    const newSocket = io(window.location.origin, {
      autoConnect: false,
    });
    setSocket(newSocket);

    newSocket.on('roomUpdated', (room) => {
      setPlayers(room.players);
      setSettings(room.settings);
    });

    newSocket.on('gameStarted', (room) => {
      setBooklets(room.booklets);
      setCurrentRound(room.currentRound);
      setTotalRounds(room.totalRounds);
      setPhase('PLAYING');
    });

    newSocket.on('roundAdvanced', (room) => {
      setBooklets(room.booklets);
      setCurrentRound(room.currentRound);
    });

    newSocket.on('gameFinished', (room) => {
      setBooklets(room.booklets);
      setPhase('REVEAL');
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const toggleMute = () => {
    const muted = soundFx.toggleMute();
    setIsMuted(muted);
  };

  // Start Pass & Play Game Local
  const handleStartPassAndPlay = (selectedPlayers: Player[], roomSettings: RoomSettings) => {
    const N = selectedPlayers.length;
    const words = getRandomWords(N, roomSettings.category, roomSettings.customWords);
    const isOdd = N % 2 !== 0;

    // Initialize N booklets
    const initialBooklets: Booklet[] = selectedPlayers.map((p, idx) => {
      const secretWord = words[idx];
      return {
        id: `booklet_${idx}_${Date.now()}`,
        originalOwnerId: p.id,
        originalOwnerName: p.name,
        originalWord: secretWord,
        steps: [
          {
            stepIndex: 0,
            type: 'WORD',
            authorId: p.id,
            authorName: p.name,
            authorAvatar: p.avatar,
            content: secretWord
          }
        ]
      };
    });

    setMode('PASS_AND_PLAY');
    setPlayers(selectedPlayers);
    setSettings(roomSettings);
    setBooklets(initialBooklets);
    setCurrentRound(1);
    setTotalRounds(N);
    setPassAndPlayIndex(0);
    setShowShield(true); // Privacy curtain on first turn!
    setPhase('PLAYING');
  };

  // Submit Step for Pass & Play Mode
  const handleSubmitPassAndPlayStep = (content: string) => {
    const N = players.length;
    const isOdd = N % 2 !== 0;

    // Calculate which booklet active player held in currentRound
    let shift = isOdd ? (currentRound - 1) + 1 : (currentRound - 1);
    let bookletIdx = (passAndPlayIndex - shift + N * 10) % N;

    const activePlayer = players[passAndPlayIndex];

    // Push new step to booklet
    setBooklets(prevBooklets => {
      const nextBooklets = [...prevBooklets];
      const targetBooklet = { ...nextBooklets[bookletIdx] };
      
      const newStep: BookletStep = {
        stepIndex: targetBooklet.steps.length,
        type: currentRound % 2 === 1 ? 'DRAWING' : 'GUESS',
        authorId: activePlayer.id,
        authorName: activePlayer.name,
        authorAvatar: activePlayer.avatar,
        content
      };

      targetBooklet.steps = [...targetBooklet.steps, newStep];
      nextBooklets[bookletIdx] = targetBooklet;
      return nextBooklets;
    });

    // Advance Pass & Play turn
    if (passAndPlayIndex < N - 1) {
      setPassAndPlayIndex(prev => prev + 1);
      setShowShield(true);
    } else {
      // All players in this round have submitted!
      if (currentRound >= N) {
        // Game Over -> Reveal phase!
        setPhase('REVEAL');
      } else {
        // Next round
        setCurrentRound(prev => prev + 1);
        setPassAndPlayIndex(0);
        setShowShield(true);
      }
    }
  };

  // Join or Create Online Room
  const handleJoinOnlineRoom = (playerName: string, avatar: string, roomId?: string) => {
    if (!socket) return;
    socket.connect();

    if (roomId) {
      socket.emit('joinRoom', { roomId, playerName, avatar }, (res: any) => {
        if (res.success) {
          setOnlineRoomId(res.roomId);
          setPlayers(res.room.players);
          setSettings(res.room.settings);
          setMode('ONLINE');
        } else {
          alert(res.error || '방 입장에 실패했습니다.');
        }
      });
    } else {
      socket.emit('createRoom', { playerName, avatar }, (res: any) => {
        if (res.success) {
          setOnlineRoomId(res.roomId);
          setPlayers(res.room.players);
          setSettings(res.room.settings);
          setMode('ONLINE');
        }
      });
    }
  };

  const handlePlayAgain = () => {
    setPhase('LOBBY');
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between py-6 px-3">
      {/* Active Phase Display */}
      {phase === 'LOBBY' && (
        <Lobby
          onStartPassAndPlay={handleStartPassAndPlay}
          onJoinOnlineRoom={handleJoinOnlineRoom}
          isMuted={isMuted}
          onToggleMute={toggleMute}
        />
      )}

      {phase === 'PLAYING' && (
        <GameRoom
          players={players}
          settings={settings}
          booklets={booklets}
          currentRound={currentRound}
          totalRounds={totalRounds}
          passAndPlayIndex={passAndPlayIndex}
          showShield={showShield}
          onShieldReady={() => setShowShield(false)}
          onSubmitStep={(content) => {
            if (mode === 'PASS_AND_PLAY') {
              handleSubmitPassAndPlayStep(content);
            } else if (socket) {
              socket.emit('submitStep', { roomId: onlineRoomId, content });
            }
          }}
        />
      )}

      {phase === 'REVEAL' && (
        <RevealPresentation
          booklets={booklets}
          onPlayAgain={handlePlayAgain}
        />
      )}

      {/* Footer */}
      <footer className="text-center text-slate-500 text-xs py-4">
        텔레스트레이션 Online - 보드게임 완벽 구현 파티 웹 앱
      </footer>
    </div>
  );
};

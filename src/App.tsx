import React, { useState } from 'react';
import { useLocalGame } from './hooks/useLocalGame';
import { useOnlineGame } from './hooks/useOnlineGame';
import { useWakeLock } from './hooks/useWakeLock';
import { soundFx } from './utils/sound';
import { Lobby } from './components/Lobby';
import { OnlineLobby } from './components/OnlineLobby';
import { WordPickPhase } from './components/WordPickPhase';
import { PassAndPlayShield } from './components/PassAndPlayShield';
import { GameRoom } from './components/GameRoom';
import { RevealPresentation } from './components/RevealPresentation';
import { RulesModal } from './components/RulesModal';

export const App: React.FC = () => {
  const [mode, setMode] = useState<'PASS_AND_PLAY' | 'ONLINE'>('PASS_AND_PLAY');
  const [showRules, setShowRules] = useState(false);

  const [isMuted, setIsMuted] = useState(() => soundFx.isMuted());
  const [isBgmOn, setIsBgmOn] = useState(() => soundFx.isBgmOn());

  const local = useLocalGame();
  const online = useOnlineGame();

  const handleToggleMute = () => {
    setIsMuted(soundFx.toggleMute());
  };

  const handleToggleBgm = () => {
    setIsBgmOn(soundFx.toggleBgm());
  };

  const handleUserInteraction = () => {
    soundFx.resumeBgmIfNeeded();
  };

  const isOnlineActive = mode === 'ONLINE' && online.state !== null;

  // 게임 중에는 모바일 화면이 꺼져 연결이 끊기지 않도록 유지
  useWakeLock(isOnlineActive || local.game !== null);

  return (
    <div onClick={handleUserInteraction}>
      {isOnlineActive && online.status === 'connecting' && (
        <div className="reconnect-banner" role="status">
          📡 연결이 끊겼어요. 다시 연결하는 중...
        </div>
      )}

      {/* 1. ONLINE LOBBY */}
      {isOnlineActive && online.state?.phase === 'LOBBY' && (
        <OnlineLobby
          state={online.state}
          onUpdateSettings={online.updateSettings}
          onShufflePlayers={online.shufflePlayers}
          onStartGame={online.startGame}
          onLeaveRoom={online.leaveRoom}
          onOpenRules={() => setShowRules(true)}
          isMuted={isMuted}
          isBgmOn={isBgmOn}
          onToggleMute={handleToggleMute}
          onToggleBgm={handleToggleBgm}
        />
      )}

      {/* 2. ONLINE WORD PICK PHASE */}
      {isOnlineActive && online.state?.phase === 'WORD_PICK' && (
        <WordPickPhase
          card={online.state.card || []}
          onPickWord={online.pickWord}
          isPicked={online.state.picked}
        />
      )}

      {/* 3. ONLINE PLAYING IN-GAME */}
      {isOnlineActive && online.state?.phase === 'PLAYING' && online.task && (
        <GameRoom
          task={online.task}
          round={online.state.round}
          totalRounds={online.state.totalRounds}
          deadline={online.state.deadline}
          serverOffset={online.offset}
          activePlayer={
            online.state.players.find((p) => p.id === online.state?.youId) || {
              id: 'you',
              name: '나',
              avatar: '🐶',
            }
          }
          players={online.state.players}
          submittedCount={online.state.players.filter((p) => p.submitted).length}
          totalCount={online.state.players.length}
          isSubmitted={
            online.state.players.find((p) => p.id === online.state?.youId)?.submitted || false
          }
          onSubmit={(content) => online.submit(online.state!.round, content)}
          onOpenRules={() => setShowRules(true)}
          isMuted={isMuted}
          isBgmOn={isBgmOn}
          onToggleMute={handleToggleMute}
          onToggleBgm={handleToggleBgm}
        />
      )}

      {/* 4. ONLINE REVEAL PRESENTATION */}
      {isOnlineActive && online.state?.phase === 'REVEAL' && (
        <RevealPresentation
          booklets={online.booklets}
          pos={online.state.reveal}
          reactions={online.state.reactions}
          isHost={online.state.hostId === online.state.youId}
          onNav={online.revealNav}
          onReact={online.react}
          onPlayAgain={online.playAgain}
          onOpenRules={() => setShowRules(true)}
          isMuted={isMuted}
          isBgmOn={isBgmOn}
          onToggleMute={handleToggleMute}
          onToggleBgm={handleToggleBgm}
        />
      )}

      {/* 5. PASS AND PLAY (LOCAL MODE) VIEWS */}
      {!isOnlineActive && local.game && (
        <>
          {local.game.phase === 'SHIELD' && (
            <PassAndPlayShield
              targetPlayerName={local.game.players[local.game.cursor].name}
              targetPlayerAvatar={local.game.players[local.game.cursor].avatar}
              roundNumber={local.game.round}
              totalRounds={local.game.totalRounds}
              isPickPhase={local.game.shieldNext === 'PICK'}
              onReady={local.ready}
            />
          )}

          {local.game.phase === 'PICK' && (
            <WordPickPhase
              card={local.game.cards[local.game.cursor]}
              onPickWord={local.pick}
              playerName={local.game.players[local.game.cursor].name}
              isLocalMode
            />
          )}

          {local.game.phase === 'TURN' && (
            <GameRoom
              task={{
                round: local.game.round,
                type: local.game.round % 2 === 1 ? 'DRAWING' : 'GUESS',
                text:
                  local.game.round === 1
                    ? local.game.booklets[
                        (((local.game.cursor - (local.game.players.length % 2 === 1 ? 1 : 0)) %
                          local.game.players.length) +
                          local.game.players.length) %
                          local.game.players.length
                      ].steps[0].content
                    : local.game.booklets[
                        (((local.game.cursor -
                          (local.game.round - 1) -
                          (local.game.players.length % 2 === 1 ? 1 : 0)) %
                          local.game.players.length) +
                          local.game.players.length) %
                          local.game.players.length
                      ].steps[
                        local.game.booklets[
                          (((local.game.cursor -
                            (local.game.round - 1) -
                            (local.game.players.length % 2 === 1 ? 1 : 0)) %
                            local.game.players.length) +
                            local.game.players.length) %
                            local.game.players.length
                        ].steps.length - 1
                      ].type === 'DRAWING'
                    ? null
                    : local.game.booklets[
                        (((local.game.cursor -
                          (local.game.round - 1) -
                          (local.game.players.length % 2 === 1 ? 1 : 0)) %
                          local.game.players.length) +
                          local.game.players.length) %
                          local.game.players.length
                      ].steps[
                        local.game.booklets[
                          (((local.game.cursor -
                            (local.game.round - 1) -
                            (local.game.players.length % 2 === 1 ? 1 : 0)) %
                            local.game.players.length) +
                            local.game.players.length) %
                            local.game.players.length
                        ].steps.length - 1
                      ].content,
                image:
                  local.game.round > 1 &&
                  local.game.booklets[
                    (((local.game.cursor -
                      (local.game.round - 1) -
                      (local.game.players.length % 2 === 1 ? 1 : 0)) %
                      local.game.players.length) +
                      local.game.players.length) %
                      local.game.players.length
                  ].steps[
                    local.game.booklets[
                      (((local.game.cursor -
                        (local.game.round - 1) -
                        (local.game.players.length % 2 === 1 ? 1 : 0)) %
                        local.game.players.length) +
                        local.game.players.length) %
                        local.game.players.length
                    ].steps.length - 1
                  ].type === 'DRAWING'
                    ? local.game.booklets[
                        (((local.game.cursor -
                          (local.game.round - 1) -
                          (local.game.players.length % 2 === 1 ? 1 : 0)) %
                          local.game.players.length) +
                          local.game.players.length) %
                          local.game.players.length
                      ].steps[
                        local.game.booklets[
                          (((local.game.cursor -
                            (local.game.round - 1) -
                            (local.game.players.length % 2 === 1 ? 1 : 0)) %
                            local.game.players.length) +
                            local.game.players.length) %
                            local.game.players.length
                        ].steps.length - 1
                      ].content
                    : null,
              }}
              round={local.game.round}
              totalRounds={local.game.totalRounds}
              deadline={local.game.deadline}
              activePlayer={local.game.players[local.game.cursor]}
              onSubmit={local.submit}
              onOpenRules={() => setShowRules(true)}
              isMuted={isMuted}
              isBgmOn={isBgmOn}
              onToggleMute={handleToggleMute}
              onToggleBgm={handleToggleBgm}
            />
          )}

          {local.game.phase === 'REVEAL' && (
            <RevealPresentation
              booklets={local.game.booklets}
              pos={local.game.reveal}
              reactions={local.game.reactions}
              onNav={local.setReveal}
              onReact={local.react}
              onPlayAgain={local.reset}
              onOpenRules={() => setShowRules(true)}
              isMuted={isMuted}
              isBgmOn={isBgmOn}
              onToggleMute={handleToggleMute}
              onToggleBgm={handleToggleBgm}
            />
          )}
        </>
      )}

      {/* 6. MAIN LOBBY */}
      {!isOnlineActive && !local.game && (
        <Lobby
          onStartPassAndPlay={(players, settings) => {
            setMode('PASS_AND_PLAY');
            local.start(players, settings);
          }}
          onCreateOnlineRoom={async (name, avatar) => {
            setMode('ONLINE');
            return online.createRoom(name, avatar);
          }}
          onJoinOnlineRoom={async (code, name, avatar) => {
            setMode('ONLINE');
            return online.joinRoom(code, name, avatar);
          }}
          onOpenRules={() => setShowRules(true)}
          isMuted={isMuted}
          isBgmOn={isBgmOn}
          onToggleMute={handleToggleMute}
          onToggleBgm={handleToggleBgm}
          onlineError={online.error}
          setOnlineError={online.setError}
        />
      )}

      {/* Official Rules Modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
};

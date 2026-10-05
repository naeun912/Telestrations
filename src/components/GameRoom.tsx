import React, { useState, useEffect } from 'react';
import { Clock, Send, CheckCircle2, Sparkles } from 'lucide-react';
import { Player, StepType, Task } from '../types/game';
import { DrawingCanvas } from './DrawingCanvas';
import { soundFx } from '../utils/sound';
import { Header } from './Header';

interface GameRoomProps {
  task: Task;
  round: number;
  totalRounds: number;
  deadline: number;
  serverOffset?: number;
  activePlayer: Player;
  players?: { id: string; name: string; avatar: string; submitted: boolean }[];
  submittedCount?: number;
  totalCount?: number;
  isSubmitted?: boolean;
  onSubmit: (content: string) => void;
  onOpenRules: () => void;
  isMuted: boolean;
  isBgmOn: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
}

export const GameRoom: React.FC<GameRoomProps> = ({
  task,
  round,
  totalRounds,
  deadline,
  serverOffset = 0,
  activePlayer,
  players,
  submittedCount,
  totalCount,
  isSubmitted = false,
  onSubmit,
  onOpenRules,
  isMuted,
  isBgmOn,
  onToggleMute,
  onToggleBgm,
}) => {
  const [guessInput, setGuessInput] = useState<string>('');
  const [canvasData, setCanvasData] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(60);

  // Timer Countdown loop
  useEffect(() => {
    const updateTime = () => {
      const now = Date.now() + serverOffset;
      const rem = Math.max(0, Math.ceil((deadline - now) / 1000));
      setTimeLeft(rem);

      if (rem <= 10 && rem > 0) {
        soundFx.tick(true);
      } else if (rem > 0 && rem % 5 === 0) {
        soundFx.tick(false);
      }

      if (rem <= 0 && !isSubmitted) {
        soundFx.whistle();
        handleAutoSubmit();
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [deadline, serverOffset, isSubmitted, task]);

  const handleAutoSubmit = () => {
    if (task.type === 'DRAWING') {
      onSubmit(canvasData);
    } else {
      onSubmit(guessInput.trim() || '???');
    }
  };

  const handleSubmit = () => {
    soundFx.pop();
    if (task.type === 'DRAWING') {
      onSubmit(canvasData);
    } else {
      onSubmit(guessInput.trim() || '???');
    }
  };

  const isUrgent = timeLeft <= 10;

  return (
    <div className="screen animate-fadeIn">
      <Header
        onOpenRules={onOpenRules}
        isMuted={isMuted}
        isBgmOn={isBgmOn}
        onToggleMute={onToggleMute}
        onToggleBgm={onToggleBgm}
        smallLogo
      />

      {/* Turn Topbar */}
      <div className="turn-bar">
        <div className="turn-bar__who">
          <span className="avatar avatar--sm">{activePlayer.avatar}</span>
          <div>
            <h2>{activePlayer.name} 님의 차례</h2>
            <span className="small muted">
              라운드 {round} / {totalRounds} ({task.type === 'DRAWING' ? '그리기' : '맞히기'})
            </span>
          </div>
        </div>

        {/* Sandglass Timer */}
        <div className={`sand ${isUrgent ? 'is-urgent' : ''}`}>
          <Clock size={20} className={isUrgent ? 'text-red' : ''} />
          <span className="sand__num font-bold">{timeLeft}초</span>
        </div>
      </div>

      {/* Online Progress (if online mode) */}
      {totalCount !== undefined && submittedCount !== undefined && (
        <div className="stack" style={{ gap: 4 }}>
          <div className="row row--between small muted">
            <span>제출 현황</span>
            <span>{submittedCount} / {totalCount} 명 완료</span>
          </div>
          <div className="progress">
            <div style={{ width: `${(submittedCount / totalCount) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Main Sketchbook Page */}
      <div className="sketchbook sketchbook--yellow">
        <div className="sketchbook__page">
          {task.type === 'DRAWING' ? (
            <div className="stack center">
              {/* Sticky Note Prompt */}
              <div className="sticky sticky--yellow">
                <small>스케치북에 그릴 단어</small>
                <b>"{task.text}"</b>
              </div>

              {/* Drawing Canvas */}
              {!isSubmitted ? (
                <DrawingCanvas onCanvasChange={setCanvasData} />
              ) : (
                <div className="notice notice--odd center" style={{ margin: '20px 0' }}>
                  <b>제출 완료!</b> 다른 플레이어가 작성을 마칠 때까지 기다려 주세요...
                </div>
              )}
            </div>
          ) : (
            <div className="stack center">
              <div className="sticky sticky--blue">
                <small>이 그림을 보고 무엇인지 맞히세요!</small>
              </div>

              {/* Previous Drawing Preview */}
              <div className="guess-img">
                {task.image ? (
                  <img src={task.image} alt="Previous Player Drawing" />
                ) : (
                  <div className="empty-note">그림 로딩 중...</div>
                )}
              </div>

              {/* Guess Text Input Line */}
              {!isSubmitted ? (
                <div className="guess-line">
                  <input
                    type="text"
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    maxLength={30}
                    placeholder="추측 단어 입력 (예: 강아지, 피카츄)..."
                    autoFocus
                  />
                </div>
              ) : (
                <div className="notice notice--odd center" style={{ margin: '20px 0' }}>
                  <b>제출 완료!</b> 다른 플레이어가 작성을 마칠 때까지 기다려 주세요...
                </div>
              )}
            </div>
          )}

          {/* Action Submit Button */}
          {!isSubmitted && (
            <button
              type="button"
              className="btn btn--yellow btn--lg btn--block"
              onClick={handleSubmit}
              style={{ marginTop: 10 }}
            >
              <Send size={24} />
              <span>{task.type === 'DRAWING' ? '그림 작성 완료 & 제출' : '추측 단어 작성 완료 & 제출'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

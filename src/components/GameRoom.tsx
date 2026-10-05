import React, { useState, useEffect, useRef } from 'react';
import { Clock, Send, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { Booklet, Player, RoomSettings, StepType } from '../types/game';
import { DrawingCanvas } from './DrawingCanvas';
import { PassAndPlayShield } from './PassAndPlayShield';
import { soundFx } from '../utils/sound';

interface GameRoomProps {
  players: Player[];
  settings: RoomSettings;
  booklets: Booklet[];
  currentRound: number;
  totalRounds: number;
  passAndPlayIndex: number;
  showShield: boolean;
  onShieldReady: () => void;
  onSubmitStep: (content: string) => void;
}

export const GameRoom: React.FC<GameRoomProps> = ({
  players,
  settings,
  booklets,
  currentRound,
  totalRounds,
  passAndPlayIndex,
  showShield,
  onShieldReady,
  onSubmitStep,
}) => {
  const [guessInput, setGuessInput] = useState<string>('');
  const [currentCanvasData, setCurrentCanvasData] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(settings.timeLimit || 60);

  const numPlayers = players.length;
  const isOdd = numPlayers % 2 !== 0;

  // Calculate which Booklet the active player is holding in the current round
  // For Pass & Play mode: active player is players[passAndPlayIndex]
  const activePlayer = players[passAndPlayIndex] || players[0];

  // Which booklet is activePlayer holding in currentRound?
  // Round 1 (1-indexed):
  //   EVEN: Player i holds Booklet i (originalOwner = i)
  //   ODD:  Player i holds Booklet (i - 1 + N) % N
  let bookletHolderShift = 0;
  if (isOdd) {
    // In odd mode, booklet was shifted 1 step right before round 1 drawing
    bookletHolderShift = (currentRound - 1) + 1;
  } else {
    bookletHolderShift = (currentRound - 1);
  }

  // Active booklet index
  const activeBookletIndex = (passAndPlayIndex - bookletHolderShift + numPlayers * 10) % numPlayers;
  const activeBooklet = booklets[activeBookletIndex] || booklets[0];

  // Determine current turn step type:
  // Round 1 is ALWAYS DRAWING (drawing the secret word!)
  // Round 2 is GUESS
  // Round 3 is DRAWING
  // Round 4 is GUESS ...
  const currentStepType: StepType = currentRound % 2 === 1 ? 'DRAWING' : 'GUESS';

  // Extract previous step's content to display to the player:
  // If DRAWING turn: needs to see previous WORD or GUESS text
  // If GUESS turn: needs to see previous DRAWING image
  const lastStep = activeBooklet && activeBooklet.steps.length > 0
    ? activeBooklet.steps[activeBooklet.steps.length - 1]
    : null;

  const previousContentText = lastStep ? lastStep.content : activeBooklet?.originalWord || '';
  const previousDrawingImage = (currentStepType === 'GUESS' && lastStep?.type === 'DRAWING') ? lastStep.content : '';

  // Timer countdown
  useEffect(() => {
    setTimeLeft(settings.timeLimit || 60);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          soundFx.playWhistle();
          // Auto submit on time out
          handleSubmit();
          return 0;
        }
        if (prev <= 10) {
          soundFx.playTimerTick(true);
        } else if (prev % 5 === 0) {
          soundFx.playTimerTick(false);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentRound, passAndPlayIndex]);

  const handleSubmit = () => {
    soundFx.playClick();
    if (currentStepType === 'DRAWING') {
      onSubmitStep(currentCanvasData);
    } else {
      const text = guessInput.trim() || '알 수 없음';
      onSubmitStep(text);
      setGuessInput('');
    }
  };

  if (showShield) {
    return (
      <PassAndPlayShield
        targetPlayerName={activePlayer.name}
        targetPlayerAvatar={activePlayer.avatar}
        roundNumber={currentRound}
        totalRounds={totalRounds}
        onReady={onShieldReady}
      />
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-4 p-4 sm:p-6 animate-fadeIn select-none">
      {/* Top Header Bar */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between flex-wrap gap-3">
        {/* Active Player Profile */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-3xl shadow-inner">
            {activePlayer.avatar}
          </div>
          <div>
            <h3 className="text-white font-extrabold text-lg flex items-center gap-2">
              <span>{activePlayer.name}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                라운드 {currentRound} / {totalRounds}
              </span>
            </h3>
            <p className="text-slate-400 text-xs">
              스케치북 주인: <strong className="text-amber-300">{activeBooklet?.originalOwnerName}</strong> 님
            </p>
          </div>
        </div>

        {/* Countdown Timer */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-lg border ${
          timeLeft <= 10 
            ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse' 
            : 'bg-slate-950 border-slate-800 text-amber-300'
        }`}>
          <Clock size={20} />
          <span>{timeLeft}초</span>
        </div>
      </div>

      {/* Main Task Card */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center gap-5">
        {/* Task Instruction Banner */}
        <div className="w-full bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border border-indigo-500/20 p-4 rounded-2xl text-center space-y-1">
          {currentStepType === 'DRAWING' ? (
            <>
              <span className="text-xs font-extrabold text-indigo-400 flex items-center justify-center gap-1">
                <Sparkles size={14} />
                주어진 단어를 스케치북에 그리세요!
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-300 to-indigo-300">
                "{previousContentText}"
              </h2>
            </>
          ) : (
            <>
              <span className="text-xs font-extrabold text-pink-400 flex items-center justify-center gap-1">
                <Sparkles size={14} />
                아래 그림을 보고 무엇인지 단어를 맞히세요!
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                이 그림의 정체는 무엇일까요?
              </h2>
            </>
          )}
        </div>

        {/* Task Work Area */}
        {currentStepType === 'DRAWING' ? (
          <DrawingCanvas
            onCanvasChange={setCurrentCanvasData}
          />
        ) : (
          <div className="w-full max-w-[600px] flex flex-col items-center gap-4">
            {/* Display Previous Player's Drawing */}
            <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-white border-4 border-slate-700 shadow-2xl flex items-center justify-center">
              {previousDrawingImage ? (
                <img
                  src={previousDrawingImage}
                  alt="Previous Player Drawing"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-slate-400 font-bold text-sm">그림 데이터 로딩 중...</span>
              )}
            </div>

            {/* Guess Text Input */}
            <div className="w-full flex gap-2">
              <input
                type="text"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="추측한 단어 입력 (예: 강아지, 피카츄)..."
                autoFocus
                className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white text-lg font-bold placeholder-slate-500 focus:outline-none focus:border-pink-500 shadow-inner"
              />
            </div>
          </div>
        )}

        {/* Action Submit Button */}
        <div className="w-full max-w-[600px] pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-extrabold text-xl shadow-xl shadow-indigo-500/25 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Send size={22} />
            <span>작성 완료 및 스케치북 제출</span>
          </button>
        </div>
      </div>
    </div>
  );
};

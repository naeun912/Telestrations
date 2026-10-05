import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Sparkles, 
  Laugh, 
  Palette, 
  Zap, 
  Download,
  BookOpen
} from 'lucide-react';
import { Booklet } from '../types/game';
import { soundFx } from '../utils/sound';

interface RevealPresentationProps {
  booklets: Booklet[];
  onPlayAgain: () => void;
}

export const RevealPresentation: React.FC<RevealPresentationProps> = ({
  booklets,
  onPlayAgain,
}) => {
  const [currentBookletIndex, setCurrentBookletIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [votes, setVotes] = useState<Record<string, { funny: number; best: number; twist: number }>>({});
  const [votedMap, setVotedMap] = useState<Record<string, string>>({}); // bookletId -> votedType

  useEffect(() => {
    // Fire celebratory confetti on initial load
    soundFx.playVictoryFanfare();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }, []);

  const currentBooklet = booklets[currentBookletIndex] || booklets[0];
  const steps = currentBooklet ? currentBooklet.steps : [];
  const currentStep = steps[currentStepIndex] || steps[0];

  const handleNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      soundFx.playPageFlip();
    } else if (currentBookletIndex < booklets.length - 1) {
      setCurrentBookletIndex(prev => prev + 1);
      setCurrentStepIndex(0);
      soundFx.playPageFlip();
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      soundFx.playPageFlip();
    } else if (currentBookletIndex > 0) {
      setCurrentBookletIndex(prev => prev - 1);
      setCurrentStepIndex(booklets[currentBookletIndex - 1].steps.length - 1);
      soundFx.playPageFlip();
    }
  };

  const handleVote = (type: 'funny' | 'best' | 'twist') => {
    if (!currentBooklet) return;
    const bId = currentBooklet.id;
    if (votedMap[bId] === type) return;

    soundFx.playClick();
    setVotes(prev => {
      const bVotes = prev[bId] || { funny: 0, best: 0, twist: 0 };
      const oldType = votedMap[bId] as 'funny' | 'best' | 'twist' | undefined;
      return {
        ...prev,
        [bId]: {
          funny: bVotes.funny + (type === 'funny' ? 1 : 0) - (oldType === 'funny' ? 1 : 0),
          best: bVotes.best + (type === 'best' ? 1 : 0) - (oldType === 'best' ? 1 : 0),
          twist: bVotes.twist + (type === 'twist' ? 1 : 0) - (oldType === 'twist' ? 1 : 0),
        }
      };
    });
    setVotedMap(prev => ({ ...prev, [bId]: type }));
  };

  if (!currentBooklet) {
    return <div className="text-white text-center p-8">결과 데이터를 불러오는 중...</div>;
  }

  const bookletVotes = votes[currentBooklet.id] || { funny: 0, best: 0, twist: 0 };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-6 p-4 sm:p-6 animate-fadeIn select-none">
      {/* Top Banner Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-pink-500/20 border border-amber-500/30 text-amber-300 font-extrabold text-sm">
          <Sparkles size={16} />
          <span>최종 스케치북 결과 발표!</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-pink-400 to-indigo-400">
            {currentBooklet.originalOwnerName}
          </span> 님의 스케치북
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          최초 제시어: <strong className="text-amber-300 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">{currentBooklet.originalWord}</strong>
        </p>
      </div>

      {/* Booklet Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 scrollbar-none justify-center">
        {booklets.map((b, idx) => (
          <button
            key={b.id}
            type="button"
            onClick={() => {
              setCurrentBookletIndex(idx);
              setCurrentStepIndex(0);
              soundFx.playPageFlip();
            }}
            className={`px-4 py-2 rounded-xl text-sm font-extrabold transition-all whitespace-nowrap flex items-center gap-2 ${
              idx === currentBookletIndex
                ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-lg scale-105'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <BookOpen size={16} />
            <span>{b.originalOwnerName} 스케치북</span>
          </button>
        ))}
      </div>

      {/* Main Flipbook Card */}
      <div className="w-full bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-6 relative overflow-hidden">
        {/* Step Progress Tracker */}
        <div className="w-full flex items-center justify-between text-xs sm:text-sm font-bold text-slate-400 border-b border-slate-800 pb-4">
          <span>페이지 {currentStepIndex + 1} / {steps.length}</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{currentStep.authorAvatar}</span>
            <span className="text-slate-200">{currentStep.authorName}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400 border border-indigo-500/30">
              {currentStep.type === 'WORD' ? '최초 제시어' : currentStep.type === 'DRAWING' ? '그림 작성' : '추측 작성'}
            </span>
          </div>
        </div>

        {/* Content Showcase Area */}
        <div className="w-full min-h-[320px] flex flex-col items-center justify-center p-4 bg-slate-950 rounded-2xl border border-slate-800 relative">
          {currentStep.type === 'DRAWING' ? (
            <div className="w-full max-w-[500px] aspect-[4/3] rounded-xl overflow-hidden bg-white shadow-xl">
              <img
                src={currentStep.content}
                alt="Player Drawing"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="text-center p-8 space-y-3 animate-scaleUp">
              <span className="text-slate-500 text-sm block">
                {currentStep.type === 'WORD' ? '원래 제시어' : '작성한 추측 단어'}
              </span>
              <h2 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-400 to-indigo-300">
                "{currentStep.content}"
              </h2>
            </div>
          )}
        </div>

        {/* Reaction Voting Buttons */}
        <div className="flex items-center justify-center gap-3 flex-wrap w-full pt-2">
          <button
            type="button"
            onClick={() => handleVote('funny')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-extrabold transition-all ${
              votedMap[currentBooklet.id] === 'funny'
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 scale-105 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <Laugh size={18} className="text-amber-400" />
            <span>너무 웃김 🤣 ({bookletVotes.funny})</span>
          </button>

          <button
            type="button"
            onClick={() => handleVote('best')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-extrabold transition-all ${
              votedMap[currentBooklet.id] === 'best'
                ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 scale-105 shadow-lg shadow-indigo-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <Palette size={18} className="text-indigo-400" />
            <span>금손 명화 🎨 ({bookletVotes.best})</span>
          </button>

          <button
            type="button"
            onClick={() => handleVote('twist')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-extrabold transition-all ${
              votedMap[currentBooklet.id] === 'twist'
                ? 'bg-pink-500/20 border-pink-500 text-pink-300 scale-105 shadow-lg shadow-pink-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <Zap size={18} className="text-pink-400" />
            <span>충격의 변질 😱 ({bookletVotes.twist})</span>
          </button>
        </div>

        {/* Navigation Buttons */}
        <div className="w-full flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handlePrevStep}
            disabled={currentBookletIndex === 0 && currentStepIndex === 0}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-sm disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            <ChevronLeft size={20} />
            <span>이전 페이지</span>
          </button>

          <button
            type="button"
            onClick={handleNextStep}
            disabled={currentBookletIndex === booklets.length - 1 && currentStepIndex === steps.length - 1}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:brightness-110 text-white font-extrabold text-sm disabled:opacity-30 disabled:pointer-events-none transition-all shadow-lg"
          >
            <span>다음 페이지</span>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            onPlayAgain();
          }}
          className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-lg shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
        >
          <RotateCcw size={22} />
          <span>새 게임 시작하기</span>
        </button>
      </div>
    </div>
  );
};

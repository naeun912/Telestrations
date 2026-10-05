import React from 'react';
import { EyeOff, Play, ShieldAlert } from 'lucide-react';
import { soundFx } from '../utils/sound';

interface PassAndPlayShieldProps {
  targetPlayerName: string;
  targetPlayerAvatar: string;
  roundNumber: number;
  totalRounds: number;
  onReady: () => void;
}

export const PassAndPlayShield: React.FC<PassAndPlayShieldProps> = ({
  targetPlayerName,
  targetPlayerAvatar,
  roundNumber,
  totalRounds,
  onReady,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
      {/* Privacy Warning Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold text-sm mb-8 animate-bounce">
        <ShieldAlert size={18} />
        <span>비밀보장! 이전 플레이어의 그림/단어가 숨겨져 있습니다</span>
      </div>

      {/* Pass Target Player Avatar Card */}
      <div className="relative mb-6">
        <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-indigo-600 to-pink-500 p-1 shadow-2xl shadow-indigo-500/30">
          <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-6xl">
            {targetPlayerAvatar}
          </div>
        </div>
        <div className="absolute -bottom-2 -right-2 bg-slate-800 border-2 border-slate-700 p-2 rounded-full text-slate-300">
          <EyeOff size={22} />
        </div>
      </div>

      <h2 className="text-3xl sm:text-4xl font-black text-white mb-2">
        <span className="text-indigo-400">{targetPlayerName}</span> 님의 차례입니다!
      </h2>
      
      <p className="text-slate-400 text-lg max-w-md mb-8">
        기기를 <strong className="text-amber-300">{targetPlayerName}</strong> 님에게 전달해 주세요.<br />
        (진행도: {roundNumber} / {totalRounds} 라운드)
      </p>

      {/* Start Button */}
      <button
        type="button"
        onClick={() => {
          soundFx.playPageFlip();
          onReady();
        }}
        className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-extrabold text-xl shadow-xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
      >
        <Play size={24} className="fill-current" />
        <span>스케치북 펼치기</span>
      </button>
    </div>
  );
};

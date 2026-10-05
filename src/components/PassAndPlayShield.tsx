import React from 'react';
import { EyeOff, Play, ShieldAlert } from 'lucide-react';
import { soundFx } from '../utils/sound';

interface PassAndPlayShieldProps {
  targetPlayerName: string;
  targetPlayerAvatar: string;
  roundNumber: number;
  totalRounds: number;
  onReady: () => void;
  isPickPhase?: boolean;
}

export const PassAndPlayShield: React.FC<PassAndPlayShieldProps> = ({
  targetPlayerName,
  targetPlayerAvatar,
  roundNumber,
  totalRounds,
  onReady,
  isPickPhase = false,
}) => {
  return (
    <div className="shield">
      <div className="pill pill--odd">
        <ShieldAlert size={18} /> 비밀보장 가림막
      </div>

      <div className="avatar avatar--lg" style={{ '--c': 'var(--yellow)' } as React.CSSProperties}>
        {targetPlayerAvatar}
      </div>

      <h2 className="shield__title">
        <b>{targetPlayerName}</b> 님의 차례입니다!
      </h2>

      <p className="small" style={{ opacity: 0.85, maxWidth: 380, lineHeight: 1.5 }}>
        {isPickPhase ? (
          <>스케치북을 <b>{targetPlayerName}</b> 님에게 건네주세요.<br />준비되면 아래 버튼을 눌러 제시어를 뽑으세요!</>
        ) : (
          <>스케치북을 <b>{targetPlayerName}</b> 님에게 건네주세요.<br />(진행도: {roundNumber} / {totalRounds} 라운드)</>
        )}
      </p>

      <button
        type="button"
        className="btn btn--yellow btn--lg"
        onClick={() => {
          soundFx.flip();
          onReady();
        }}
        style={{ marginTop: 12 }}
      >
        <Play size={24} className="fill-current" />
        <span>스케치북 펼치기</span>
      </button>
    </div>
  );
};

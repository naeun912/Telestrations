import React from 'react';
import { Volume2, VolumeX, Music, HelpCircle, Home } from 'lucide-react';
import { soundFx } from '../utils/sound';

interface HeaderProps {
  onOpenRules: () => void;
  onGoHome?: () => void;
  isMuted: boolean;
  isBgmOn: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
  smallLogo?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenRules,
  onGoHome,
  isMuted,
  isBgmOn,
  onToggleMute,
  onToggleBgm,
  smallLogo = false,
}) => {
  return (
    <header className="topbar">
      <div 
        className={`logo ${smallLogo ? 'logo--small' : ''}`}
        onClick={onGoHome}
        style={{ cursor: onGoHome ? 'pointer' : 'default' }}
        title="홈으로 이동"
      >
        <span className="logo__tile" style={{ backgroundColor: 'var(--red)' }}>텔</span>
        <span className="logo__tile" style={{ backgroundColor: 'var(--orange)' }}>레</span>
        <span className="logo__tile" style={{ backgroundColor: 'var(--yellow)' }}>스</span>
        <span className="logo__tile" style={{ backgroundColor: 'var(--teal)' }}>트</span>
        <span className="logo__tile" style={{ backgroundColor: 'var(--blue)' }}>레이션</span>
      </div>

      <div className="topbar__right">
        {onGoHome && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              soundFx.click();
              onGoHome();
            }}
            title="홈으로 가기"
          >
            <Home size={20} />
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            soundFx.click();
            onOpenRules();
          }}
          title="공식 규칙 보기"
        >
          <HelpCircle size={20} />
        </button>
        <button
          type="button"
          className={`icon-btn ${!isBgmOn ? 'is-off' : ''}`}
          onClick={() => {
            soundFx.click();
            onToggleBgm();
          }}
          title={isBgmOn ? '배경음악 끄기' : '배경음악 켜기'}
        >
          <Music size={20} />
        </button>
        <button
          type="button"
          className={`icon-btn ${isMuted ? 'is-off' : ''}`}
          onClick={() => {
            soundFx.click();
            onToggleMute();
          }}
          title={isMuted ? '음소거 해제' : '음소거'}
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import { Dices, Check, Sparkles } from 'lucide-react';
import { soundFx } from '../utils/sound';

interface WordPickPhaseProps {
  card: string[];
  onPickWord: (index: number) => void;
  isPicked?: boolean;
  pickedIndex?: number;
  playerName?: string;
  isLocalMode?: boolean;
}

export const WordPickPhase: React.FC<WordPickPhaseProps> = ({
  card,
  onPickWord,
  isPicked = false,
  pickedIndex,
  playerName,
  isLocalMode = false,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(pickedIndex ?? null);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [dieValue, setDieValue] = useState<number>(1);

  const handleRollDice = () => {
    if (isPicked || isRolling) return;
    soundFx.dice();
    setIsRolling(true);

    let count = 0;
    const interval = setInterval(() => {
      const rand = Math.floor(Math.random() * 6);
      setDieValue(rand + 1);
      count++;
      if (count >= 10) {
        clearInterval(interval);
        setIsRolling(false);
        setSelectedIndex(rand);
      }
    }, 60);
  };

  const handleConfirm = () => {
    if (selectedIndex === null) return;
    soundFx.pop();
    onPickWord(selectedIndex);
  };

  return (
    <div className="screen screen--narrow animate-fadeIn">
      <div className="card card--yellow center stack">
        <span className="pill pill--even" style={{ margin: '0 auto' }}>
          <Sparkles size={16} /> 제시어 뽑기 단계
        </span>
        <h2>
          {playerName ? `${playerName} 님의 비밀 제시어를 고르세요!` : '비밀 제시어를 선택하세요!'}
        </h2>
        <p className="muted small">
          주사위를 굴리거나 카드에서 마음에 드는 단어를 직접 터치하세요.
        </p>

        {/* Dice Roller */}
        <div className="row row--between" style={{ justifyContent: 'center', margin: '10px 0' }}>
          <div
            className={`die ${isRolling ? 'is-rolling' : ''}`}
            onClick={handleRollDice}
            style={{ cursor: isPicked ? 'not-allowed' : 'pointer' }}
            title="주사위 굴리기"
          >
            {/* Pip rendering according to die value */}
            {dieValue === 1 && <div className="die__pip is-red" style={{ gridArea: '2/2' }} />}
            {dieValue === 2 && (
              <>
                <div className="die__pip" style={{ gridArea: '1/1' }} />
                <div className="die__pip" style={{ gridArea: '3/3' }} />
              </>
            )}
            {dieValue === 3 && (
              <>
                <div className="die__pip" style={{ gridArea: '1/1' }} />
                <div className="die__pip is-red" style={{ gridArea: '2/2' }} />
                <div className="die__pip" style={{ gridArea: '3/3' }} />
              </>
            )}
            {dieValue === 4 && (
              <>
                <div className="die__pip" style={{ gridArea: '1/1' }} />
                <div className="die__pip" style={{ gridArea: '1/3' }} />
                <div className="die__pip" style={{ gridArea: '3/1' }} />
                <div className="die__pip" style={{ gridArea: '3/3' }} />
              </>
            )}
            {dieValue === 5 && (
              <>
                <div className="die__pip" style={{ gridArea: '1/1' }} />
                <div className="die__pip" style={{ gridArea: '1/3' }} />
                <div className="die__pip is-red" style={{ gridArea: '2/2' }} />
                <div className="die__pip" style={{ gridArea: '3/1' }} />
                <div className="die__pip" style={{ gridArea: '3/3' }} />
              </>
            )}
            {dieValue === 6 && (
              <>
                <div className="die__pip" style={{ gridArea: '1/1' }} />
                <div className="die__pip" style={{ gridArea: '1/3' }} />
                <div className="die__pip" style={{ gridArea: '2/1' }} />
                <div className="die__pip" style={{ gridArea: '2/3' }} />
                <div className="die__pip" style={{ gridArea: '3/1' }} />
                <div className="die__pip" style={{ gridArea: '3/3' }} />
              </>
            )}
          </div>

          <button
            type="button"
            className="btn btn--blue"
            onClick={handleRollDice}
            disabled={isPicked || isRolling}
          >
            <Dices size={20} /> 주사위 굴리기
          </button>
        </div>

        {/* 6 Word Card */}
        <div className="wordcard">
          {card.map((word, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <div
                key={idx}
                className={`wordcard__row ${isSelected ? 'is-picked' : selectedIndex !== null ? 'is-dim' : ''}`}
                onClick={() => {
                  if (isPicked) return;
                  soundFx.click();
                  setSelectedIndex(idx);
                }}
                style={{ cursor: isPicked ? 'not-allowed' : 'pointer' }}
              >
                <i>{idx + 1}</i>
                <span style={{ fontWeight: 'bold', flex: 1 }}>{word}</span>
                {isSelected && <Check size={24} className="text-red" />}
              </div>
            );
          })}
        </div>

        {!isPicked ? (
          <button
            type="button"
            className="btn btn--teal btn--lg btn--block"
            disabled={selectedIndex === null}
            onClick={handleConfirm}
          >
            <Check size={24} /> 이 단어로 확정하기!
          </button>
        ) : (
          <div className="notice notice--odd center">
            <b>선택 완료!</b> 다른 플레이어가 제시어를 고를 때까지 기다려 주세요...
          </div>
        )}
      </div>
    </div>
  );
};

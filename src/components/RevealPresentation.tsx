import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Sparkles, 
  Download, 
  BookOpen, 
  Trophy, 
  Laugh, 
  Palette, 
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Booklet, Reactions, ReactionType, RevealPos } from '../types/game';
import { soundFx } from '../utils/sound';
import { downloadBooklet } from '../utils/exportImage';
import { normalizeAnswer } from '../game/logic';
import { Header } from './Header';

interface RevealPresentationProps {
  booklets: Booklet[];
  pos: RevealPos;
  reactions: Reactions;
  isHost?: boolean;
  onNav: (b: number, s: number) => void;
  onReact: (key: string, type: ReactionType) => void;
  onPlayAgain: () => void;
  onOpenRules: () => void;
  isMuted: boolean;
  isBgmOn: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
}

export const RevealPresentation: React.FC<RevealPresentationProps> = ({
  booklets,
  pos,
  reactions,
  isHost = true,
  onNav,
  onReact,
  onPlayAgain,
  onOpenRules,
  isMuted,
  isBgmOn,
  onToggleMute,
  onToggleBgm,
}) => {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    soundFx.fanfare();
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
    });
  }, []);

  const totalBooklets = booklets.length;
  const isSummaryPage = pos.b >= totalBooklets;
  const activeBooklet = !isSummaryPage ? booklets[pos.b] : null;
  const steps = activeBooklet ? activeBooklet.steps : [];
  const activeStep = steps[pos.s] || steps[0];
  const originalWord = activeBooklet?.steps[0]?.content || '';

  const handleNext = () => {
    if (isSummaryPage) return;
    if (pos.s < steps.length - 1) {
      soundFx.flip();
      onNav(pos.b, pos.s + 1);
    } else {
      soundFx.flip();
      onNav(pos.b + 1, 0);
    }
  };

  const handlePrev = () => {
    if (pos.b === 0 && pos.s === 0) return;
    soundFx.flip();
    if (isSummaryPage) {
      const lastB = totalBooklets - 1;
      onNav(lastB, booklets[lastB].steps.length - 1);
    } else if (pos.s > 0) {
      onNav(pos.b, pos.s - 1);
    } else {
      const prevB = pos.b - 1;
      onNav(prevB, booklets[prevB].steps.length - 1);
    }
  };

  const handleDownload = async () => {
    if (!activeBooklet || downloading) return;
    soundFx.click();
    setDownloading(true);
    try {
      await downloadBooklet(activeBooklet);
    } catch {
      alert('이미지 저장 중 오류가 발생했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  // Calculate Awards (Funny, Art, Twist votes tally)
  const getTopBookletFor = (type: ReactionType): Booklet | null => {
    let bestCount = -1;
    let bestB: Booklet | null = null;

    booklets.forEach((b) => {
      let count = 0;
      b.steps.forEach((_, idx) => {
        const key = `${b.id}:${idx}`;
        count += (reactions[key]?.[type] || []).length;
      });
      if (count > bestCount) {
        bestCount = count;
        bestB = b;
      }
    });
    return bestB;
  };

  const funnyWinner = getTopBookletFor('funny');
  const artWinner = getTopBookletFor('art');
  const twistWinner = getTopBookletFor('twist');

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

      <div className="hero center">
        <div className="hero__tag pill pill--even">
          <Sparkles size={16} /> 텔레스트레이션 스케치북 결과 발표!
        </div>

        {/* Booklet Tabs */}
        <div className="book-tabs">
          {booklets.map((b, idx) => (
            <button
              key={b.id}
              type="button"
              className={`book-tab ${pos.b === idx ? 'is-on' : ''}`}
              onClick={() => {
                soundFx.flip();
                onNav(idx, 0);
              }}
            >
              <span className="avatar avatar--sm">{b.ownerAvatar}</span>
              <span>{b.ownerName}</span>
            </button>
          ))}
          <button
            type="button"
            className={`book-tab ${isSummaryPage ? 'is-on' : ''}`}
            onClick={() => {
              soundFx.flip();
              onNav(totalBooklets, 0);
            }}
          >
            <Trophy size={18} />
            <span>최종 결과 & 어워드</span>
          </button>
        </div>
      </div>

      {!isSummaryPage && activeBooklet && activeStep && (
        <div className="sketchbook sketchbook--yellow">
          <div className="sketchbook__page flip">
            {/* Page Meta Header */}
            <div className="page-meta">
              <span className="pill pill--even">
                <BookOpen size={16} /> {activeBooklet.ownerName}의 스케치북 ({pos.s + 1} / {steps.length}페이지)
              </span>

              <div className="row">
                <span className="avatar avatar--sm">{activeStep.authorAvatar}</span>
                <span className="font-bold">{activeStep.authorName}</span>
                <span className="badge">
                  {activeStep.type === 'WORD' ? '최초 제시어' : activeStep.type === 'DRAWING' ? '그림 작성' : '추측 작성'}
                </span>
              </div>
            </div>

            {/* Page Content Display */}
            {activeStep.type === 'DRAWING' ? (
              <div className="guess-img" style={{ margin: '10px 0' }}>
                <img src={activeStep.content} alt="Drawing Step" />
              </div>
            ) : (
              <div className={`reveal-word ${activeStep.type === 'GUESS' ? 'reveal-word--guess' : ''}`}>
                "{activeStep.content}"
              </div>
            )}

            {/* Comparison Badge if final guess */}
            {pos.s === steps.length - 1 && activeStep.type === 'GUESS' && (
              <div className={`compare ${normalizeAnswer(originalWord) === normalizeAnswer(activeStep.content) ? 'is-ok' : ''}`}>
                {normalizeAnswer(originalWord) === normalizeAnswer(activeStep.content) ? (
                  <span className="row row--between" style={{ justifyContent: 'center' }}>
                    <CheckCircle2 size={20} className="text-teal" />
                    <b>정답 일치!</b> 원본 단어 "{originalWord}"가 무사히 전달되었습니다!
                  </span>
                ) : (
                  <span className="row row--between" style={{ justifyContent: 'center' }}>
                    <AlertCircle size={20} className="text-red" />
                    <b>황당 변질!</b> 원본 단어 "{originalWord}" ➔ 최종 추측 "{activeStep.content}"
                  </span>
                )}
              </div>
            )}

            {/* Reactions Voting */}
            <div className="reactions">
              {(['funny', 'art', 'twist'] as ReactionType[]).map((type) => {
                const key = `${activeBooklet.id}:${pos.s}`;
                const count = (reactions[key]?.[type] || []).length;
                const emoji = type === 'funny' ? '🤣' : type === 'art' ? '🎨' : '😱';
                const label = type === 'funny' ? '너무 웃김' : type === 'art' ? '금손 명화' : '충격 변질';
                return (
                  <button
                    key={type}
                    type="button"
                    className="reaction"
                    onClick={() => {
                      soundFx.click();
                      onReact(key, type);
                    }}
                  >
                    <span>{emoji} {label}</span>
                    <b>({count})</b>
                  </button>
                );
              })}

              <button
                type="button"
                className="btn btn--sm btn--blue"
                onClick={handleDownload}
                disabled={downloading}
              >
                <Download size={16} />
                <span>{downloading ? '저장 중...' : '스케치북 PNG 저장'}</span>
              </button>
            </div>

            {/* Page Navigation */}
            <div className="nav-row">
              <button
                type="button"
                className="btn"
                disabled={pos.b === 0 && pos.s === 0}
                onClick={handlePrev}
              >
                <ChevronLeft size={20} /> 이전
              </button>

              <button
                type="button"
                className="btn btn--yellow"
                onClick={handleNext}
              >
                <span>다음</span> <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary & Awards Page */}
      {isSummaryPage && (
        <div className="card stack">
          <h2 className="card__title center">
            <Trophy className="text-yellow" size={28} />
            텔레스트레이션 명예의 전당 & 최종 결과
          </h2>

          <div className="awards">
            <div className="award">
              <div className="award__icon">🤣</div>
              <b className="award__title">최고의 폭소왕</b>
              <span className="award__name font-bold">
                {funnyWinner ? `${funnyWinner.ownerAvatar} ${funnyWinner.ownerName}` : '투표 대기 중'}
              </span>
            </div>

            <div className="award">
              <div className="award__icon">🎨</div>
              <b className="award__title">최고의 금손 명화</b>
              <span className="award__name font-bold">
                {artWinner ? `${artWinner.ownerAvatar} ${artWinner.ownerName}` : '투표 대기 중'}
              </span>
            </div>

            <div className="award">
              <div className="award__icon">😱</div>
              <b className="award__title">충격의 변질상</b>
              <span className="award__name font-bold">
                {twistWinner ? `${twistWinner.ownerAvatar} ${twistWinner.ownerName}` : '투표 대기 중'}
              </span>
            </div>
          </div>

          <div className="stack" style={{ marginTop: 14 }}>
            <span className="field__label"><b>스케치북 변질 요약</b></span>
            {booklets.map((b) => {
              const first = b.steps[0]?.content || '';
              const lastStep = b.steps[b.steps.length - 1];
              const last = lastStep ? lastStep.content : '???';
              const isOk = normalizeAnswer(first) === normalizeAnswer(last);

              return (
                <div key={b.id} className={`summary-row ${isOk ? 'is-ok' : ''}`}>
                  <span className="avatar avatar--sm">{b.ownerAvatar}</span>
                  <div className="summary-row__text">
                    <b>{b.ownerName}의 스케치북:</b> "{first}" ➔ "{last}"
                  </div>
                  <button
                    type="button"
                    className="btn btn--sm btn--blue"
                    onClick={() => downloadBooklet(b)}
                  >
                    <Download size={14} /> 저장
                  </button>
                </div>
              );
            })}
          </div>

          {isHost && (
            <button
              type="button"
              className="btn btn--yellow btn--lg btn--block"
              onClick={() => {
                soundFx.pop();
                onPlayAgain();
              }}
              style={{ marginTop: 12 }}
            >
              <RotateCcw size={24} /> 새 게임 시작하기
            </button>
          )}
        </div>
      )}
    </div>
  );
};

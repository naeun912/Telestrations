import React, { useState } from 'react';
import { Users, Copy, Check, Play, LogOut, Shuffle } from 'lucide-react';
import { OnlineState, Settings } from '../types/game';
import { WORD_CATEGORIES, TOTAL_WORD_COUNT, parseCustomWords } from '../data/words';
import { isOdd, totalRoundsFor } from '../game/logic';
import { soundFx } from '../utils/sound';
import { Header } from './Header';

interface OnlineLobbyProps {
  state: OnlineState;
  onUpdateSettings: (s: Settings) => void;
  onShufflePlayers: () => void;
  onStartGame: () => Promise<{ ok: boolean; error?: string }>;
  onLeaveRoom: () => void;
  onOpenRules: () => void;
  isMuted: boolean;
  isBgmOn: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
}

export const OnlineLobby: React.FC<OnlineLobbyProps> = ({
  state,
  onUpdateSettings,
  onShufflePlayers,
  onStartGame,
  onLeaveRoom,
  onOpenRules,
  isMuted,
  isBgmOn,
  onToggleMute,
  onToggleBgm,
}) => {
  const [copied, setCopied] = useState(false);
  const [customWordsText, setCustomWordsText] = useState(state.settings.customWords.join(', '));
  const [errorMsg, setErrorMsg] = useState('');

  const isHost = state.hostId === state.youId;
  const numPlayers = state.players.length;
  const odd = isOdd(numPlayers);
  const rounds = totalRoundsFor(numPlayers);

  const handleCopyCode = () => {
    soundFx.click();
    navigator.clipboard.writeText(state.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShuffle = () => {
    soundFx.dice();
    onShufflePlayers();
  };

  const handleStart = async () => {
    soundFx.pop();
    setErrorMsg('');
    const res = await onStartGame();
    if (!res.ok) {
      setErrorMsg(res.error || '게임을 시작할 수 없어요.');
    }
  };

  return (
    <div className="screen animate-fadeIn">
      <Header
        onOpenRules={onOpenRules}
        isMuted={isMuted}
        isBgmOn={isBgmOn}
        onToggleMute={onToggleMute}
        onToggleBgm={onToggleBgm}
      />

      {/* Ticket Banner with Room Code */}
      <div className="ticket">
        <span className="small muted">온라인 방 코드</span>
        <span className="ticket__code">{state.roomId}</span>
        <button
          type="button"
          className="btn btn--sm btn--blue"
          onClick={handleCopyCode}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          <span>{copied ? '복사됨!' : '코드 복사하기'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="notice notice--warn">
          {errorMsg}
        </div>
      )}

      {/* Main Waiting Card */}
      <div className="card stack">
        <div className="row row--between">
          <h3 className="card__title" style={{ margin: 0 }}>
            <Users size={22} className="text-teal" />
            <span>참가자 전달 순서 ({numPlayers}명)</span>
          </h3>
          <div className="row">
            {isHost && (
              <button
                type="button"
                className="btn btn--sm btn--purple"
                onClick={handleShuffle}
                title="전달 순서 무작위 섞기"
              >
                <Shuffle size={16} /> 순서 섞기
              </button>
            )}
            <span className={`pill ${odd ? 'pill--odd' : 'pill--even'}`}>
              {odd ? `⚡ 홀수 인원 (${rounds}R)` : `✨ 짝수 인원 (${rounds}R)`}
            </span>
          </div>
        </div>

        <div className="notice notice--odd">
          {odd ? (
            <b>⭐ 홀수 인원 룰: 1라운드에 그림을 그리지 않고 제시어를 바로 옆 사람에게 전달합니다! (총 {rounds}라운드)</b>
          ) : (
            <b>✨ 짝수 인원 룰: 1라운드에 자신의 제시어 첫 그림을 그린 후 전달합니다! (총 {rounds}라운드)</b>
          )}
        </div>

        {/* Players Grid with Order Numbers */}
        <div className="player-grid">
          {state.players.map((p, idx) => (
            <div key={p.id} className={`player-tag ${!p.connected ? 'is-off' : ''}`}>
              <span className="player-tag__num">{idx + 1}.</span>
              <span className="avatar avatar--sm">{p.avatar}</span>
              <span className="player-tag__name font-bold">{p.name}</span>
              {p.id === state.hostId && <span className="badge">방장</span>}
              {!p.connected && <span className="small muted">재연결 중...</span>}
            </div>
          ))}
        </div>

        {/* Settings Panel (Host controls) */}
        <div className="stack" style={{ borderTop: '3px dashed var(--ink)', paddingTop: 16 }}>
          <div>
            <span className="field__label"><b>제시어 카테고리</b></span>
            <div className="cat-grid">
              {WORD_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`cat ${state.settings.category === cat.id ? 'is-on' : ''}`}
                  disabled={!isHost}
                  onClick={() => {
                    soundFx.click();
                    onUpdateSettings({ ...state.settings, category: cat.id });
                  }}
                >
                  <span className="cat__name">{cat.emoji} {cat.name}</span>
                  <span className="cat__desc">{cat.desc} ({cat.words.length}개)</span>
                </button>
              ))}
              <button
                type="button"
                className={`cat ${state.settings.category === 'all' ? 'is-on' : ''}`}
                disabled={!isHost}
                onClick={() => {
                  soundFx.click();
                  onUpdateSettings({ ...state.settings, category: 'all' });
                }}
              >
                <span className="cat__name">🎲 전체 섞기</span>
                <span className="cat__desc">모든 카테고리 포함 ({TOTAL_WORD_COUNT}개)</span>
              </button>
              <button
                type="button"
                className={`cat ${state.settings.category === 'custom' ? 'is-on' : ''}`}
                disabled={!isHost}
                onClick={() => {
                  soundFx.click();
                  onUpdateSettings({ ...state.settings, category: 'custom' });
                }}
              >
                <span className="cat__name">✏️ 직접 입력</span>
                <span className="cat__desc">나만의 제시어 등록</span>
              </button>
            </div>
          </div>

          {state.settings.category === 'custom' && isHost && (
            <div>
              <span className="field__label"><b>커스텀 제시어 (쉼표로 구분)</b></span>
              <textarea
                className="textarea"
                value={customWordsText}
                onChange={(e) => {
                  setCustomWordsText(e.target.value);
                  onUpdateSettings({ ...state.settings, customWords: parseCustomWords(e.target.value) });
                }}
                placeholder="예: 민트초코, 파인애플피자, 수건돌리기, 감자튀김"
              />
            </div>
          )}

          <div className="row row--wrap" style={{ gap: 20 }}>
            <div>
              <span className="field__label"><b>그리기 시간</b></span>
              <div className="chips">
                {[30, 45, 60, 90, 120].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={`chip ${state.settings.drawTime === sec ? 'is-on' : ''}`}
                    disabled={!isHost}
                    onClick={() => {
                      soundFx.click();
                      onUpdateSettings({ ...state.settings, drawTime: sec });
                    }}
                  >
                    {sec}초
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="field__label"><b>맞히기 시간</b></span>
              <div className="chips">
                {[15, 20, 30, 45, 60].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={`chip ${state.settings.guessTime === sec ? 'is-on' : ''}`}
                    disabled={!isHost}
                    onClick={() => {
                      soundFx.click();
                      onUpdateSettings({ ...state.settings, guessTime: sec });
                    }}
                  >
                    {sec}초
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn--red"
            onClick={() => {
              soundFx.click();
              onLeaveRoom();
            }}
          >
            <LogOut size={20} /> 방 나가기
          </button>

          {isHost ? (
            <button
              type="button"
              className="btn btn--yellow btn--lg flex-1"
              disabled={numPlayers < 3}
              onClick={handleStart}
            >
              <Play size={24} className="fill-current" />
              <span>게임 시작하기 ({numPlayers}명)</span>
            </button>
          ) : (
            <div className="notice center flex-1">
              방장이 게임을 시작하기를 기다리고 있습니다...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

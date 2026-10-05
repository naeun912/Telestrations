import React, { useState } from 'react';
import { 
  Users, 
  Smartphone, 
  Globe, 
  Sparkles, 
  Plus, 
  X, 
  Play, 
  CheckCircle2, 
  Shuffle
} from 'lucide-react';
import { Player, Settings } from '../types/game';
import { WORD_CATEGORIES, TOTAL_WORD_COUNT, parseCustomWords } from '../data/words';
import { isOdd, totalRoundsFor } from '../game/logic';
import { AVATARS, randomAvatar } from '../utils/players';
import { soundFx } from '../utils/sound';
import { Header } from './Header';

interface LobbyProps {
  onStartPassAndPlay: (players: Player[], settings: Settings) => void;
  onCreateOnlineRoom: (name: string, avatar: string) => Promise<boolean>;
  onJoinOnlineRoom: (code: string, name: string, avatar: string) => Promise<boolean>;
  onOpenRules: () => void;
  isMuted: boolean;
  isBgmOn: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
  onlineError?: string;
  setOnlineError?: (err: string) => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  onStartPassAndPlay,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  onOpenRules,
  isMuted,
  isBgmOn,
  onToggleMute,
  onToggleBgm,
  onlineError,
  setOnlineError,
}) => {
  const [tab, setTab] = useState<'PASS_AND_PLAY' | 'ONLINE'>('PASS_AND_PLAY');

  // Player Profile
  const [name, setName] = useState<string>('그림왕');
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);

  // Online Room Code
  const [roomCode, setRoomCode] = useState<string>('');

  // Local Players List
  const [localPlayers, setLocalPlayers] = useState<Player[]>([
    { id: '1', name: '플레이어 1', avatar: '🐶' },
    { id: '2', name: '플레이어 2', avatar: '🐱' },
    { id: '3', name: '플레이어 3', avatar: '🦊' },
    { id: '4', name: '플레이어 4', avatar: '🐸' },
  ]);
  const [newPlayerName, setNewPlayerName] = useState<string>('');

  // Settings
  const [category, setCategory] = useState<string>('easy');
  const [drawTime, setDrawTime] = useState<number>(60);
  const [guessTime, setGuessTime] = useState<number>(30);
  const [customWordsText, setCustomWordsText] = useState<string>('');

  const numLocalPlayers = localPlayers.length;
  const localIsOdd = isOdd(numLocalPlayers);
  const localRounds = totalRoundsFor(numLocalPlayers);

  const handleAddLocalPlayer = () => {
    if (localPlayers.length >= 10) return;
    const pName = newPlayerName.trim() || `플레이어 ${localPlayers.length + 1}`;
    setLocalPlayers((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: pName,
        avatar: randomAvatar(),
      },
    ]);
    setNewPlayerName('');
    soundFx.click();
  };

  const handleRemoveLocalPlayer = (id: string) => {
    if (localPlayers.length <= 3) return;
    setLocalPlayers((prev) => prev.filter((p) => p.id !== id));
    soundFx.click();
  };

  const handleShuffleLocalPlayers = () => {
    soundFx.dice();
    setLocalPlayers((prev) => {
      const arr = [...prev];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
  };

  const handleStartPassAndPlay = () => {
    soundFx.pop();
    const customWords = parseCustomWords(customWordsText);
    onStartPassAndPlay(localPlayers, {
      category,
      drawTime,
      guessTime,
      customWords,
    });
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

      {/* Hero Header */}
      <div className="hero center">
        <div className="hero__tag pill pill--even">
          <Sparkles size={16} /> 그림으로 전하는 수건돌리기 파티 보드게임!
        </div>

        {/* Telestrations Animated Chain Demo */}
        <div className="chain-demo">
          <div className="chain-demo__page">
            <small>제시어</small>
            <b>피카츄</b>
          </div>
          <span className="chain-demo__arrow">➔</span>
          <div className="chain-demo__page">
            <small>그림</small>
            <b>🎨</b>
          </div>
          <span className="chain-demo__arrow">➔</span>
          <div className="chain-demo__page">
            <small>추측</small>
            <b>노란쥐</b>
          </div>
          <span className="chain-demo__arrow">➔</span>
          <div className="chain-demo__page">
            <small>최종</small>
            <b>햄스터</b>
          </div>
        </div>

        <p className="muted small">
          주어진 제시어를 그리고 릴레이로 전달하세요.<br />
          스케치북이 원래 주인에게 돌아오면 웃음 폭발 결과가 펼쳐집니다! (총 {TOTAL_WORD_COUNT}+ 단어 포함)
        </p>
      </div>

      {/* Mode Selector Cards */}
      <div className="mode-grid">
        <div
          className={`mode-card mode-card--yellow ${tab === 'PASS_AND_PLAY' ? 'card--yellow' : ''}`}
          onClick={() => {
            setTab('PASS_AND_PLAY');
            soundFx.click();
          }}
          style={{
            transform: tab === 'PASS_AND_PLAY' ? 'translate(-2px, -3px) rotate(-1deg)' : 'none',
            borderColor: tab === 'PASS_AND_PLAY' ? 'var(--ink)' : 'var(--ink-soft)',
          }}
        >
          <div className="mode-card__icon">📱</div>
          <h2 className="mode-card__title">한 기기로 같이 하기</h2>
          <p className="mode-card__desc">
            노트북, 태블릿, PC 1대로 친구들과 돌아가며 스케치북을 넘겨요! (비밀 가림막 지원)
          </p>
        </div>

        <div
          className={`mode-card mode-card--teal ${tab === 'ONLINE' ? 'card--teal' : ''}`}
          onClick={() => {
            setTab('ONLINE');
            soundFx.click();
          }}
          style={{
            transform: tab === 'ONLINE' ? 'translate(-2px, -3px) rotate(1deg)' : 'none',
            borderColor: tab === 'ONLINE' ? 'var(--ink)' : 'var(--ink-soft)',
          }}
        >
          <div className="mode-card__icon">🌐</div>
          <h2 className="mode-card__title">실시간 멀티플레이</h2>
          <p className="mode-card__desc">
            각자 스마트폰/PC에서 4자리 방 코드로 접속하여 동시에 그리기 & 맞히기!
          </p>
        </div>
      </div>

      {/* PASS AND PLAY CONTENT */}
      {tab === 'PASS_AND_PLAY' && (
        <div className="card stack">
          <div className="row row--between">
            <h3 className="card__title" style={{ margin: 0 }}>
              <Users size={22} className="text-teal" />
              <span>참가 플레이어 순서 ({numLocalPlayers}명)</span>
            </h3>
            <div className="row">
              <button
                type="button"
                className="btn btn--sm btn--purple"
                onClick={handleShuffleLocalPlayers}
                title="전달 순서 무작위 섞기"
              >
                <Shuffle size={16} /> 순서 섞기
              </button>
              <span className={`pill ${localIsOdd ? 'pill--odd' : 'pill--even'}`}>
                {localIsOdd ? `⚡ 홀수 인원 (${localRounds}R)` : `✨ 짝수 인원 (${localRounds}R)`}
              </span>
            </div>
          </div>

          <div className="notice notice--odd">
            {localIsOdd ? (
              <b>⭐ 홀수 인원 룰: 1라운드에 그림을 그리지 않고 제시어를 바로 옆 사람에게 전달합니다! (총 {localRounds}라운드)</b>
            ) : (
              <b>✨ 짝수 인원 룰: 1라운드에 자신의 제시어 첫 그림을 그린 후 전달합니다! (총 {localRounds}라운드)</b>
            )}
          </div>

          {/* Players Grid with Order Sequence Numbers */}
          <div className="player-grid">
            {localPlayers.map((p, idx) => (
              <div key={p.id} className="player-tag">
                <span className="player-tag__num">{idx + 1}.</span>
                <span className="avatar avatar--sm">{p.avatar}</span>
                <span className="player-tag__name font-bold">{p.name}</span>
                {localPlayers.length > 3 && (
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 30, height: 30, fontSize: '0.9rem' }}
                    onClick={() => handleRemoveLocalPlayer(p.id)}
                    title="삭제"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Player Row */}
          {localPlayers.length < 10 && (
            <div className="row">
              <input
                type="text"
                className="input"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLocalPlayer()}
                placeholder="새 플레이어 이름..."
              />
              <button
                type="button"
                className="btn btn--blue shrink-0"
                onClick={handleAddLocalPlayer}
              >
                <Plus size={18} /> 추가
              </button>
            </div>
          )}

          {/* Settings Panel */}
          <div className="stack" style={{ borderTop: '3px dashed var(--ink)', paddingTop: 16 }}>
            <div>
              <span className="field__label"><b>제시어 카테고리</b></span>
              <div className="cat-grid">
                {WORD_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`cat ${category === cat.id ? 'is-on' : ''}`}
                    onClick={() => {
                      setCategory(cat.id);
                      soundFx.click();
                    }}
                  >
                    <span className="cat__name">{cat.emoji} {cat.name}</span>
                    <span className="cat__desc">{cat.desc} ({cat.words.length}개)</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={`cat ${category === 'all' ? 'is-on' : ''}`}
                  onClick={() => {
                    setCategory('all');
                    soundFx.click();
                  }}
                >
                  <span className="cat__name">🎲 전체 섞기</span>
                  <span className="cat__desc">모든 카테고리 포함 ({TOTAL_WORD_COUNT}개)</span>
                </button>
                <button
                  type="button"
                  className={`cat ${category === 'custom' ? 'is-on' : ''}`}
                  onClick={() => {
                    setCategory('custom');
                    soundFx.click();
                  }}
                >
                  <span className="cat__name">✏️ 직접 입력</span>
                  <span className="cat__desc">나만의 제시어 등록</span>
                </button>
              </div>
            </div>

            {category === 'custom' && (
              <div>
                <span className="field__label"><b>커스텀 제시어 (쉼표 또는 줄바꿈으로 구분)</b></span>
                <textarea
                  className="textarea"
                  value={customWordsText}
                  onChange={(e) => setCustomWordsText(e.target.value)}
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
                      className={`chip ${drawTime === sec ? 'is-on' : ''}`}
                      onClick={() => {
                        setDrawTime(sec);
                        soundFx.click();
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
                      className={`chip ${guessTime === sec ? 'is-on' : ''}`}
                      onClick={() => {
                        setGuessTime(sec);
                        soundFx.click();
                      }}
                    >
                      {sec}초
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn--yellow btn--lg btn--block"
            onClick={handleStartPassAndPlay}
            style={{ marginTop: 12 }}
          >
            <Play size={24} className="fill-current" />
            <span>텔레스트레이션 시작하기!</span>
          </button>
        </div>
      )}

      {/* ONLINE MULTIPLAYER CONTENT */}
      {tab === 'ONLINE' && (
        <div className="card stack">
          <div className="stack">
            <span className="field__label"><b>내 캐릭터 & 닉네임 설정</b></span>
            <div className="row">
              <span className="avatar avatar--lg">{avatar}</span>
              <input
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={10}
                placeholder="닉네임 입력..."
              />
            </div>
            <div className="avatar-pick">
              {AVATARS.map((av) => (
                <button
                  key={av}
                  type="button"
                  className={avatar === av ? 'is-on' : ''}
                  onClick={() => {
                    setAvatar(av);
                    soundFx.click();
                  }}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {onlineError && (
            <div className="notice notice--warn">
              {onlineError}
            </div>
          )}

          <div className="mode-grid" style={{ marginTop: 10 }}>
            <div className="card card--yellow stack center">
              <h4>새 게임 방 만들기</h4>
              <p className="muted small">방장이 되어 친구들을 초대하세요.</p>
              <button
                type="button"
                className="btn btn--blue btn--block"
                onClick={async () => {
                  soundFx.click();
                  const ok = await onCreateOnlineRoom(name, avatar);
                  if (!ok && setOnlineError) {
                    setOnlineError('방 생성 실패. 잠시 후 다시 시도해 주세요.');
                  }
                }}
              >
                <Plus size={20} /> 방 만들기
              </button>
            </div>

            <div className="card card--teal stack center">
              <h4>참가 코드로 입장</h4>
              <p className="muted small">방장에게 전해 들은 4자리 코드 입력</p>
              <input
                type="text"
                className="input input--code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={4}
                placeholder="ABCD"
              />
              <button
                type="button"
                className="btn btn--yellow btn--block"
                disabled={roomCode.length < 4}
                onClick={async () => {
                  soundFx.click();
                  const ok = await onJoinOnlineRoom(roomCode, name, avatar);
                  if (!ok && setOnlineError) {
                    setOnlineError('방 입장 실패. 방 코드를 확인해 주세요.');
                  }
                }}
              >
                <CheckCircle2 size={20} /> 참가하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

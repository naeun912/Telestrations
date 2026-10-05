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
  HelpCircle,
  Volume2,
  VolumeX,
  Clock,
  Layers
} from 'lucide-react';
import { GameMode, Player, RoomSettings } from '../types/game';
import { WORD_CATEGORIES } from '../data/words';
import { soundFx } from '../utils/sound';

const EMOJI_AVATARS = [
  '🐶', '🐱', '🦊', '🐸', '🦄', '🐼', '🐯', '🤖',
  '👽', '💩', '🤡', '🎃', '👻', '🥑', '🍕', '🚀',
  '👑', '🐙', '🦖', '🎨', '🔥', '⚡', '🌈', '💎'
];

interface LobbyProps {
  onStartPassAndPlay: (players: Player[], settings: RoomSettings) => void;
  onJoinOnlineRoom: (playerName: string, avatar: string, roomId?: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  onStartPassAndPlay,
  onJoinOnlineRoom,
  isMuted,
  onToggleMute,
}) => {
  const [mode, setMode] = useState<GameMode>('PASS_AND_PLAY');
  const [playerName, setPlayerName] = useState<string>('그림왕');
  const [avatar, setAvatar] = useState<string>(EMOJI_AVATARS[0]);
  const [roomIdInput, setRoomIdInput] = useState<string>('');

  // Pass & Play Local Players state
  const [localPlayers, setLocalPlayers] = useState<Player[]>([
    { id: '1', name: '플레이어 1', avatar: '🐶', isHost: true, isReady: true, hasSubmittedCurrentStep: false },
    { id: '2', name: '플레이어 2', avatar: '🐱', isHost: false, isReady: true, hasSubmittedCurrentStep: false },
    { id: '3', name: '플레이어 3', avatar: '🦊', isHost: false, isReady: true, hasSubmittedCurrentStep: false },
    { id: '4', name: '플레이어 4', avatar: '🐸', isHost: false, isReady: true, hasSubmittedCurrentStep: false },
  ]);
  const [newPlayerName, setNewPlayerName] = useState<string>('');

  // Room Settings
  const [category, setCategory] = useState<string>('easy');
  const [timeLimit, setTimeLimit] = useState<number>(60);
  const [customWordsText, setCustomWordsText] = useState<string>('');
  const [showRuleModal, setShowRuleModal] = useState<boolean>(false);

  const isOddPlayerCount = localPlayers.length % 2 !== 0;

  const handleAddLocalPlayer = () => {
    if (localPlayers.length >= 10) return;
    const name = newPlayerName.trim() || `플레이어 ${localPlayers.length + 1}`;
    const randomAvatar = EMOJI_AVATARS[localPlayers.length % EMOJI_AVATARS.length];
    
    setLocalPlayers(prev => [
      ...prev,
      {
        id: String(Date.now()),
        name,
        avatar: randomAvatar,
        isHost: false,
        isReady: true,
        hasSubmittedCurrentStep: false
      }
    ]);
    setNewPlayerName('');
    soundFx.playClick();
  };

  const handleRemoveLocalPlayer = (id: string) => {
    if (localPlayers.length <= 3) return; // minimum 3 players for telestrations
    setLocalPlayers(prev => prev.filter(p => p.id !== id));
    soundFx.playClick();
  };

  const handleStartPassAndPlay = () => {
    soundFx.playClick();
    const customWords = customWordsText
      .split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0);

    onStartPassAndPlay(localPlayers, {
      category,
      timeLimit,
      customWords
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-6 p-4 sm:p-6 animate-fadeIn select-none">
      {/* Top Header & Mute Button */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-3xl">✏️</span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            텔레스트레이션 <span className="text-indigo-400">온라인</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRuleModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs sm:text-sm border border-slate-700 transition-all"
          >
            <HelpCircle size={16} />
            <span>공식 규칙</span>
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            title={isMuted ? '음소거 해제' : '음소거'}
          >
            {isMuted ? <VolumeX size={18} className="text-rose-400" /> : <Volume2 size={18} className="text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Main Banner Hero */}
      <div className="w-full bg-gradient-to-r from-indigo-900/60 via-purple-900/60 to-pink-900/60 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center gap-3 backdrop-blur-md">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-extrabold border border-indigo-500/30">
          <Sparkles size={14} />
          그림과 단어로 전달하는 유쾌한 수건돌리기 릴레이!
        </span>
        <h2 className="text-3xl sm:text-4xl font-black text-white">
          원래 단어는 어디로 사라졌을까? 🎨
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-xl">
          친구들과 그림을 그리고 추측 단어를 넘겨주세요.<br />
          마지막에 공개되는 황당한 결과에 배꼽을 잡게 됩니다!
        </p>
      </div>

      {/* Game Mode Tab Selector */}
      <div className="w-full grid grid-cols-2 gap-3 bg-slate-900/80 p-2 rounded-2xl border border-slate-800 shadow-lg">
        <button
          type="button"
          onClick={() => { setMode('PASS_AND_PLAY'); soundFx.playClick(); }}
          className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl font-extrabold text-sm sm:text-base transition-all ${
            mode === 'PASS_AND_PLAY'
              ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Smartphone size={20} />
          <span>한 기기 모드 (Pass & Play)</span>
        </button>

        <button
          type="button"
          onClick={() => { setMode('ONLINE'); soundFx.playClick(); }}
          className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl font-extrabold text-sm sm:text-base transition-all ${
            mode === 'ONLINE'
              ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Globe size={20} />
          <span>실시간 멀티플레이 (온라인)</span>
        </button>
      </div>

      {/* Mode Content: PASS AND PLAY */}
      {mode === 'PASS_AND_PLAY' && (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          {/* Player List Setup */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="text-indigo-400" size={20} />
                <span>참가 플레이어 ({localPlayers.length}명)</span>
              </h3>
              <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
                isOddPlayerCount 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                  : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
              }`}>
                {isOddPlayerCount ? '⚡ 홀수 인원 (1R 제시어 바로 전달)' : '✨ 짝수 인원 (1R 내 그림 그리기)'}
              </span>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {localPlayers.map((p) => (
                <div
                  key={p.id}
                  className="bg-slate-800 border border-slate-700 p-3 rounded-2xl flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className="text-2xl shrink-0">{p.avatar}</span>
                    <span className="font-bold text-white text-sm truncate">{p.name}</span>
                  </div>
                  {localPlayers.length > 3 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLocalPlayer(p.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      title="삭제"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Player Input */}
            {localPlayers.length < 10 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLocalPlayer()}
                  placeholder="플레이어 이름 입력..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddLocalPlayer}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <Plus size={18} />
                  <span>추가</span>
                </button>
              </div>
            )}
          </div>

          {/* Game Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-5">
            {/* Word Category */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <Layers size={16} className="text-indigo-400" />
                <span>제시어 카테고리</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-indigo-500"
              >
                {WORD_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.name} ({cat.words.length}개)
                  </option>
                ))}
                <option value="all">🎲 전체 섞기</option>
                <option value="custom">✏️ 직접 단어 입력</option>
              </select>
            </div>

            {/* Turn Timer */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <Clock size={16} className="text-indigo-400" />
                <span>라운드 제한시간</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[30, 60, 90, 120].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setTimeLimit(sec)}
                    className={`py-2.5 rounded-xl font-extrabold text-sm border transition-all ${
                      timeLimit === sec
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {sec}초
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom Words Entry */}
          {category === 'custom' && (
            <div className="border-t border-slate-800 pt-4">
              <label className="block text-sm font-bold text-slate-300 mb-1">
                커스텀 단어들 (쉼표로 구분)
              </label>
              <input
                type="text"
                value={customWordsText}
                onChange={(e) => setCustomWordsText(e.target.value)}
                placeholder="예: 민트초코, 파인애플피자, 수건돌리기, 감자튀김"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* Start Game Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleStartPassAndPlay}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-extrabold text-xl shadow-xl shadow-indigo-500/25 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <Play size={24} className="fill-current" />
              <span>텔레스트레이션 시작하기!</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode Content: ONLINE MULTIPLAYER */}
      {mode === 'ONLINE' && (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Globe className="text-indigo-400" size={20} />
              <span>온라인 캐릭터 & 닉네임 설정</span>
            </h3>

            {/* Avatar Selector */}
            <div>
              <span className="text-xs font-bold text-slate-400 block mb-2">아바타 선택</span>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {EMOJI_AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setAvatar(av)}
                    className={`w-11 h-11 rounded-2xl text-2xl flex items-center justify-center shrink-0 border transition-all ${
                      avatar === av
                        ? 'bg-indigo-600/30 border-indigo-500 scale-110 shadow-lg'
                        : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            {/* Nickname Input */}
            <div>
              <span className="text-xs font-bold text-slate-400 block mb-1">닉네임</span>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={12}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-5">
            {/* Create Room */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between gap-4">
              <div>
                <h4 className="font-extrabold text-white text-base mb-1">새 게임 방 만들기</h4>
                <p className="text-slate-400 text-xs">방장이 되어 친구들을 초대하고 제시어 카테고리를 설정하세요.</p>
              </div>
              <button
                type="button"
                onClick={() => onJoinOnlineRoom(playerName, avatar)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                <Plus size={18} />
                <span>새 방 생성</span>
              </button>
            </div>

            {/* Join Room */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between gap-4">
              <div>
                <h4 className="font-extrabold text-white text-base mb-1">참가 코드로 입장</h4>
                <p className="text-slate-400 text-xs">방장에게 전달받은 4자리 방 코드를 입력하세요.</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                  maxLength={4}
                  placeholder="방 코드 (예: ABCD)"
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-center font-bold tracking-widest text-sm focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => roomIdInput && onJoinOnlineRoom(playerName, avatar, roomIdInput)}
                  disabled={!roomIdInput}
                  className="px-4 py-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white font-extrabold text-sm rounded-xl transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 size={18} />
                  <span>입장</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowRuleModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X size={20} />
            </button>

            <h3 className="text-2xl font-black text-white flex items-center gap-2">
              <Sparkles className="text-amber-400" size={24} />
              <span>텔레스트레이션 공식 룰 안내</span>
            </h3>

            <div className="space-y-3 text-sm text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <strong className="text-indigo-400 block mb-1">1. 게임의 기본 흐름</strong>
                제시어 ➔ 그림 그리기 ➔ 그림 보고 추측 단어 쓰기 ➔ 단어 보고 그림 그리기 ➔ 반복!
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/30">
                <strong className="text-amber-300 block mb-1">2. 짝수 vs 홀수 인원 전달 룰 차이 ⭐</strong>
                스케치북이 원래 주인에게 돌아왔을 때 마지막 결과가 **'추측(단어)'**으로 끝나도록 라운드가 조정됩니다.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong className="text-white">짝수 인원 (4, 6, 8명):</strong> 1라운드에 **자신이 제시어 첫 그림**을 그린 후 다음 사람에게 전달합니다.</li>
                  <li><strong className="text-amber-300">홀수 인원 (3, 5, 7명):</strong> 1라운드에 **그림을 그리지 않고 제시어를 바로 옆사람에게 전달**합니다! 옆사람이 첫 그림을 그리게 됩니다.</li>
                </ul>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <strong className="text-pink-400 block mb-1">3. 공개 및 발표 시간</strong>
                모든 라운드가 끝나면 첫 제시어부터 마지막 추측까지 스케치북이 어떻게 웃기게 변질되었는지 결과를 감상하고 투표합니다!
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRuleModal(false)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl transition-all"
            >
              확인했습니다!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

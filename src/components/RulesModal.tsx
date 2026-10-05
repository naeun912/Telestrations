import React, { useState } from 'react';
import { X, Sparkles, BookOpen, Layers } from 'lucide-react';
import { isOdd, totalRoundsFor } from '../game/logic';
import { soundFx } from '../utils/sound';

interface RulesModalProps {
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'oddEven'>('basic');
  const [simPlayers, setSimPlayers] = useState<number>(4);

  const simIsOdd = isOdd(simPlayers);
  const simTotalRounds = totalRoundsFor(simPlayers);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row row--between">
          <h2 className="card__title" style={{ margin: 0 }}>
            <Sparkles className="text-yellow" />
            텔레스트레이션 공식 룰 안내
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              soundFx.click();
              onClose();
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="tabs">
          <button
            type="button"
            className={`btn btn--sm ${activeTab === 'basic' ? 'btn--yellow' : ''}`}
            onClick={() => {
              soundFx.click();
              setActiveTab('basic');
            }}
          >
            <BookOpen size={16} /> 기본 규칙
          </button>

          <button
            type="button"
            className={`btn btn--sm ${activeTab === 'oddEven' ? 'btn--yellow' : ''}`}
            onClick={() => {
              soundFx.click();
              setActiveTab('oddEven');
            }}
          >
            <Layers size={16} /> 홀수/짝수 전달 순서 시뮬레이션
          </button>
        </div>

        {activeTab === 'basic' && (
          <div className="stack">
            <div className="notice">
              <b>💡 텔레스트레이션이란?</b><br />
              '그림으로 말 전달하기' 파티 보드게임입니다! 제시어를 그림으로 그리고, 그림을 보고 맞히고, 다시 단어를 보고 그림을 그리며 스케치북을 순서대로 전달합니다.
            </div>

            <div className="how">
              <div className="how__item">
                <b>1. 제시어 뽑기</b>
                6단어 제시어 카드에서 하나를 골라 스케치북 첫 장에 적습니다.
              </div>
              <div className="how__item">
                <b>2. 그림 그리기</b>
                주어진 단어를 보고 스케치북에 그림으로 표현합니다.
              </div>
              <div className="how__item">
                <b>3. 추측 단어 쓰기</b>
                이전 사람이 그린 그림만 보고 무엇인지 추측하여 단어를 적습니다.
              </div>
              <div className="how__item">
                <b>4. 결과 공개 & 투표</b>
                스케치북이 원래 주인에게 돌아오면 첫 단어부터 어떻게 변질되었는지 결과를 감상합니다!
              </div>
            </div>
          </div>
        )}

        {activeTab === 'oddEven' && (
          <div className="stack">
            <div className="notice notice--odd">
              <b>⭐ 핵심 규칙: 인원수에 따른 1라운드 차이</b><br />
              스케치북이 원래 주인에게 돌아왔을 때 마지막 페이지가 항상 <b>'추측(글)'</b>로 깔끔하게 끝나도록 1라운드 방식이 달라집니다.
            </div>

            <div className="card">
              <div className="row row--between" style={{ marginBottom: 12 }}>
                <span className="field__label" style={{ margin: 0 }}>인원수 변경 시뮬레이션:</span>
                <div className="num-stepper">
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={simPlayers <= 3}
                    onClick={() => {
                      soundFx.click();
                      setSimPlayers((p) => Math.max(3, p - 1));
                    }}
                  >
                    -
                  </button>
                  <b>{simPlayers}명</b>
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={simPlayers >= 10}
                    onClick={() => {
                      soundFx.click();
                      setSimPlayers((p) => Math.min(10, p + 1));
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="row" style={{ marginBottom: 10 }}>
                <span className={`pill ${simIsOdd ? 'pill--odd' : 'pill--even'}`}>
                  {simIsOdd ? '⚡ 홀수 인원' : '✨ 짝수 인원'}
                </span>
                <span className="small muted">
                  {simIsOdd
                    ? '1라운드에 그림을 그리지 않고 제시어를 바로 옆 사람에게 전달! (총 ' + simTotalRounds + '라운드)'
                    : '1라운드에 자신의 제시어 첫 그림을 그린 뒤 전달! (총 ' + simTotalRounds + '라운드)'}
                </span>
              </div>

              <div className="sim-wrap">
                <table className="sim-table">
                  <thead>
                    <tr>
                      <th>플레이어</th>
                      <th>제시어</th>
                      {Array.from({ length: simTotalRounds }, (_, i) => (
                        <th key={i}>{i + 1}R ({i % 2 === 0 ? '그림' : '추측'})</th>
                      ))}
                      <th>최종 수령 스케치북</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: simPlayers }, (_, pIdx) => (
                      <tr key={pIdx}>
                        <td><b>P{pIdx + 1}</b></td>
                        <td className="sim-cell" style={{ background: '#ffe9a8' }}>스케치북 {pIdx + 1}</td>
                        {Array.from({ length: simTotalRounds }, (_, rIdx) => {
                          const round = rIdx + 1;
                          const shift = simIsOdd ? round : round - 1;
                          const bIdx = (((pIdx - shift) % simPlayers) + simPlayers) % simPlayers;
                          return (
                            <td key={rIdx} className="sim-cell">
                              스케치북 {bIdx + 1}
                            </td>
                          );
                        })}
                        <td className="sim-cell sim-cell--skip">
                          <b>스케치북 {pIdx + 1}</b> (원래 주인)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn btn--yellow btn--block"
          onClick={() => {
            soundFx.click();
            onClose();
          }}
        >
          확인했습니다!
        </button>
      </div>
    </div>
  );
};

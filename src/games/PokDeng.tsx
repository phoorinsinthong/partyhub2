import React, { useState, useEffect, useRef } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGame } from '../contexts/GameContext';
import { useTranslation } from 'react-i18next';
import PlayingCard from '../components/PlayingCard';
import { createDeck, shuffleDeck, calculatePokDeng } from './logic/cards';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { recordWin } from '../components/Scoreboard';

const PokDeng: React.FC = () => {
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { t } = useTranslation();
  const { confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');

  const [errorMsg, setErrorMsg] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState({ startingChips: 1000 });
  const advancingRef = useRef(false);

  const gameData = roomData?.gameData || {};
  
  if (!roomData) return null;

  // Derived variables
  const phase = gameData.phase || 'waiting'; // waiting, playing, dealer_action, result
  const deck = gameData.deck || [];
  const playersData = gameData.players || {};
  const playerNames = Object.keys(roomData?.players || {});

  const renderErrorToast = () => {
    if (!errorMsg) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in fade-in slide-in-from-top-4">
        <div className="bg-red-500 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3">
          <div className="p-1 bg-white/20 rounded-lg">
            <span className="text-white">⚠️</span>
          </div>
          <p className="text-[14px] font-bold">{errorMsg}</p>
        </div>
      </div>
    );
  };

  const safeUpdate = async (updates: any) => {
    try {
      await update(ref(db, `rooms/${roomId}/gameData`), updates);
    } catch {
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  const startGame = async () => {
    if (!isHost) return;
    const newDeck = shuffleDeck(createDeck());
    const playersInit: Record<string, any> = {};
    const startChips = gameData.settings?.startingChips || localSettings.startingChips || 1000;
    
    playerNames.forEach(name => {
      const c1 = newDeck.pop();
      const c2 = newDeck.pop();
      playersInit[name] = {
        hand: [c1, c2],
        status: 'playing', // playing, stand, draw
        chips: playersData[name]?.chips || startChips,
        bet: name === roomData.host ? 0 : 50, // Dealer doesn't bet against himself
        isPok: false,
      };
      
      const stats = calculatePokDeng([c1, c2]);
      if (stats.weight >= 8) {
        playersInit[name].isPok = true;
        playersInit[name].status = 'stand'; // Pok forces stand
      }
    });

    await safeUpdate({
      phase: 'playing',
      deck: newDeck,
      players: playersInit,
      settings: localSettings,
    });
  };

  const drawCard = async (playerName: string) => {
    const pData = playersData[playerName];
    if (pData.hand.length >= 3 || pData.status !== 'playing') return;
    if (advancingRef.current) return;
    advancingRef.current = true;

    const newDeck = [...deck];
    const newCard = newDeck.pop();

    await safeUpdate({
      deck: newDeck,
      [`players/${playerName}/hand`]: [...pData.hand, newCard],
      [`players/${playerName}/status`]: 'stand'
    });
    advancingRef.current = false;
  };

  const setStand = async (playerName: string) => {
    await safeUpdate({
      [`players/${playerName}/status`]: 'stand'
    });
  };

  const finishPhase = async () => {
    if (!isHost) return;
    if (phase === 'playing') {
      await safeUpdate({ phase: 'dealer_action' });
    } else if (phase === 'dealer_action') {
      // Calculate winnings
      const dealerName = roomData.host;
      const dealer = playersData[dealerName];
      const dStats = calculatePokDeng(dealer.hand);
      
      const updates: Record<string, any> = { phase: 'result' };
      let hostWonAny = false;

      Object.entries(playersData).forEach(([name, p]: [string, any]) => {
        if (name === dealerName) return; // Skip dealer

        const pStats = calculatePokDeng(p.hand);
        let winAmount = 0;

        if (pStats.weight > dStats.weight) {
          winAmount = p.bet * pStats.deng;
          recordWin(roomId!, name, 'pokdeng');
        } else if (pStats.weight < dStats.weight) {
          winAmount = -(p.bet * dStats.deng);
          hostWonAny = true;
        } else if (pStats.deng > dStats.deng) {
          winAmount = p.bet * pStats.deng;
          recordWin(roomId!, name, 'pokdeng');
        } else if (pStats.deng < dStats.deng) {
          winAmount = -(p.bet * dStats.deng);
          hostWonAny = true;
        }

        updates[`players/${name}/chips`] = (p.chips || 1000) + winAmount;
        updates[`players/${name}/lastResult`] = winAmount;

        // Host balance tracking (Host plays against everyone)
        const hostCurrent = updates[`players/${dealerName}/chips`] !== undefined ? updates[`players/${dealerName}/chips`] : (dealer.chips || 1000);
        updates[`players/${dealerName}/chips`] = hostCurrent - winAmount;
      });

      if (hostWonAny) recordWin(roomId!, dealerName, 'pokdeng');
      
      await safeUpdate(updates);
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await update(ref(db, `rooms/${roomId}`), { status: 'waiting', currentGame: null, gameData: null });
  };

  if (phase === 'waiting') {
    return (
      <div className="flex-center flex-col gap-lg flex-1 text-center p-md animate-fade-in">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        {showSettings && isHost && (
          <div className="fixed inset-0 z-50 flex-center p-6 bg-stone-900/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
            <div className="card p-6 w-full max-w-[320px] bg-white flex flex-col gap-4 text-left" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg text-stone-800">⚙️ {t('pokdeng.settings') || 'ตั้งค่ากติกา'}</h3>
              <label className="flex flex-col gap-1">
                <span className="font-bold text-sm">{t('pokdeng.startingChips') || 'ชิปเริ่มต้น'}</span>
                <input type="number" value={localSettings.startingChips} onChange={(e) => setLocalSettings({...localSettings, startingChips: Number(e.target.value)})} className="input py-2 px-3 border border-stone-300 rounded-lg font-bold" />
              </label>
              <button className="btn btn-primary mt-4 py-3 font-bold" onClick={() => setShowSettings(false)}>{t('common.save') || 'บันทึกการตั้งค่า'}</button>
            </div>
          </div>
        )}
        <div className="text-6xl animate-bounce-soft">💰</div>
        <div>
          <h2 className="font-display font-bold text-[24px] text-stone-800 mb-1">{t('pokdeng.title') || 'ป๊อกเด้ง'}</h2>
          <p className="text-stone-400 text-sm">{t('pokdeng.description') || 'ป๊อก 8 ป๊อก 9 กินรอบวง! เกมไพ่ยอดฮิตของชาวไทย'}</p>
        </div>
        {isHost ? (
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={startGame} className="btn btn-primary py-4 rounded-3xl text-lg shadow-lg">
                {t('pokdeng.startGame') || 'เริ่มแจกไพ่!'}
            </button>
            <button onClick={() => setShowSettings(true)} className="btn btn-outline py-3 text-sm font-bold border-stone-200">
                {t('pokdeng.settings') || 'ตั้งค่ากติกา'}
            </button>
          </div>
        ) : (
          <p className="text-stone-400 font-bold animate-pulse">{t('pokdeng.waitingHost') || 'รอ Host เริ่มเกม...'}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col py-2 animate-fade-in relative h-full">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}

      {/* Players List */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-24 custom-scrollbar">
        {Object.entries(playersData).map(([name, data]: [string, any]) => {
          const isMe = name === userNickname;
          const isDealer = name === roomData.host;
          const stats = calculatePokDeng(data.hand);
          const isStanding = data.status === 'stand';
          const showCards = isMe || phase === 'result' || (phase === 'dealer_action' && isDealer);

          return (
            <div key={name} className={`card p-4 mx-1 transition-all ${isDealer ? 'bg-stone-50 border-stone-200 ring-2 ring-stone-100' : 'border-stone-50'}`}>
              <div className="flex-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex-center text-sm shadow-sm ${isDealer ? 'bg-amber-100' : 'bg-stone-100'}`}>
                    {isDealer ? '🏦' : (roomData.players[name]?.avatar || '👤')}
                  </div>
                  <div className="flex flex-col">
                    <span className={`font-bold text-[13px] ${isMe ? 'text-amber-600' : 'text-stone-700'}`}>
                        {name} {isDealer ? `(${t('pokdeng.dealer') || 'เจ้ามือ'})` : ''}
                    </span>
                    <span className="text-[10px] font-black text-stone-400">{data.chips} 🪙</span>
                  </div>
                </div>
                {phase === 'result' && (
                    <div className="text-right flex flex-col">
                        {data.isPok && <span className="text-[10px] font-black text-red-500 uppercase tracking-tighter">POK {stats.weight}!</span>}
                        <span className={`text-lg font-black ${stats.weight >= 8 ? 'text-red-500' : 'text-stone-700'}`}>
                            {stats.weight} {t('pokdeng.points') || 'แต้ม'} {stats.deng > 1 ? `${stats.deng} ${t('pokdeng.deng') || 'เด้ง'}` : ''}
                        </span>
                        {data.lastResult !== undefined && (
                            <span className={`text-[11px] font-black ${data.lastResult > 0 ? 'text-green-500' : data.lastResult < 0 ? 'text-red-400' : 'text-stone-400'}`}>
                                {data.lastResult > 0 ? `+${data.lastResult}` : data.lastResult}
                            </span>
                        )}
                    </div>
                )}
                {phase === 'playing' && !isDealer && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${isStanding ? 'bg-stone-200 text-stone-500' : 'bg-amber-100 text-amber-600 animate-pulse'}`}>
                        {isStanding ? 'READY' : 'PLAYING'}
                    </span>
                )}
              </div>

              <div className="flex gap-[-10px] justify-center sm:justify-start">
                {data.hand.map((card: any, i: number) => (
                  <div key={i} className={i > 0 ? '-ml-12' : ''}>
                    <PlayingCard card={card} hidden={!showCards} size="sm" />
                  </div>
                ))}
                {data.hand.length < 3 && isMe && phase === 'playing' && !data.isPok && !isDealer && !isStanding && (
                  <button onClick={() => drawCard(name)} className="w-24 h-36 border-2 border-dashed border-stone-200 rounded-2xl ml-[-48px] bg-stone-50/50 flex-center flex-col gap-2 text-stone-300 hover:text-stone-400 hover:border-stone-300 transition-all">
                    <span className="text-2xl">+</span>
                    <span className="text-[10px] font-black">{t('pokdeng.draw') || 'จั่วเพิ่ม'}</span>
                  </button>
                )}
              </div>

              {isMe && phase === 'playing' && !isStanding && !data.isPok && !isDealer && (
                <button onClick={() => setStand(name)} className="btn btn-outline w-full py-3 mt-4 text-[13px] font-black border-stone-200 rounded-xl">
                  {t('pokdeng.stand') || 'ไม่จั่ว (อยู่)'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Host Controls */}
      <div className="absolute bottom-4 left-0 w-full px-4">
        {isHost && phase === 'playing' && (
            <button onClick={finishPhase} className="btn btn-primary w-full py-4 rounded-2xl shadow-xl">
                {t('pokdeng.nextPhase') || 'เจ้ามือเล่นต่อ'}
            </button>
        )}
        {isHost && phase === 'dealer_action' && (
            <div className="flex flex-col gap-3">
                <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-100 text-center">
                    <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest mb-1">{t('pokdeng.dealerAction') || 'ตาเจ้ามือแล้ว!'}</p>
                    <p className="text-sm font-bold text-amber-600">{t('pokdeng.dealerActionDesc') || 'เลือกว่าจะจั่วเพิ่มหรือวัดแต้มเลย'}</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => drawCard(userNickname!)} disabled={playersData[userNickname!].hand.length >= 3} className="btn btn-outline flex-1 py-4 text-[14px] bg-white rounded-2xl">{t('pokdeng.draw') || 'จั่วไพ่'}</button>
                    <button onClick={finishPhase} className="btn btn-primary flex-1 py-4 text-[14px] rounded-2xl shadow-lg">{t('pokdeng.measure') || 'วัดแต้มทั้งหมด'}</button>
                </div>
            </div>
        )}
        {isHost && phase === 'result' && (
            <div className="flex gap-3">
                <button onClick={startGame} className="btn btn-primary flex-1 py-4 rounded-2xl shadow-lg">{t('common.playAgain') || 'เล่นรอบใหม่'}</button>
                <button onClick={handleBackToLobby} className="btn btn-outline flex-1 py-4 rounded-2xl bg-white">{t('common.backToLobby') || 'Lobby'}</button>
            </div>
        )}
      </div>
    </div>
  );
};

export default PokDeng;

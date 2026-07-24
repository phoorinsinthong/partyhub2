import React, { useState, useEffect, useRef } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../../firebase';
import { useGameLeave } from '../../hooks/useGameLeave';
import { useGame } from '../../contexts/GameContext';
import { useGameUpdate } from '../../hooks/useGameUpdate';
import { useTranslation } from 'react-i18next';
import PlayingCard from '../../components/ui/PlayingCard';
import { createDeck, shuffleDeck, calculatePokDeng } from '../../utils/cards';
import LeaveConfirmModal from '../../components/ui/LeaveConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { recordWin } from '../../components/features/Scoreboard';
import NeonCard from '../../components/ui/NeonCard';
import GiantButton from '../../components/ui/GiantButton';
import { SwipeableHand } from '../../components/ui/SwipeableHand';

const PokDeng: React.FC = () => {
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);
  const { t } = useTranslation();
  const { confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');

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
      <div className="flex-center flex-col gap-6 flex-1 text-center p-4 animate-fade-in bg-slate-950 text-slate-200">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        {showSettings && isHost && (
          <div className="fixed inset-0 z-50 flex-center p-6 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
            <div className="p-6 w-full max-w-[320px] bg-slate-900 border border-slate-700 rounded-3xl flex flex-col gap-4 text-left shadow-[0_0_30px_rgba(0,0,0,0.8)]" onClick={e => e.stopPropagation()}>
              <h3 className="font-black text-lg text-slate-200 tracking-widest uppercase">⚙️ ตั้งค่ากติกา</h3>
              <label className="flex flex-col gap-2 mt-2">
                <span className="font-bold text-xs text-slate-400 uppercase tracking-widest">ชิปเริ่มต้น</span>
                <input type="number" value={localSettings.startingChips} onChange={(e) => setLocalSettings({...localSettings, startingChips: Number(e.target.value)})} className="py-3 px-4 bg-slate-800 border border-slate-700 rounded-xl font-bold text-white focus:border-amber-500 focus:outline-none transition-colors" />
              </label>
              <GiantButton color="amber" onClick={() => setShowSettings(false)} className="mt-4">
                บันทึกการตั้งค่า
              </GiantButton>
            </div>
          </div>
        )}
        <div className="text-6xl animate-bounce-soft drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">💰</div>
        <div>
          <h2 className="font-black text-[28px] uppercase tracking-widest text-slate-200 mb-2 drop-shadow-md">ป๊อก<span className="text-amber-500">เด้ง</span></h2>
          <p className="text-slate-400 text-xs font-bold">ป๊อก 8 ป๊อก 9 กินรอบวง! เกมไพ่ยอดฮิตของชาวไทย</p>
        </div>
        {isHost ? (
          <div className="flex flex-col gap-3 w-full max-w-xs mt-8">
            <GiantButton color="amber" onClick={startGame}>
                เริ่มแจกไพ่!
            </GiantButton>
            <button onClick={() => setShowSettings(true)} className="py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
                ⚙️ ตั้งค่ากติกา
            </button>
          </div>
        ) : (
          <p className="text-slate-500 font-black uppercase tracking-widest text-xs mt-8 animate-pulse">รอ Host เริ่มเกม...</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col py-2 animate-fade-in relative h-full bg-slate-950 text-slate-200">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}

      {/* Header Info */}
      <div className="px-4 py-2 flex justify-between items-center mb-2">
         <h2 className="text-[14px] font-black uppercase tracking-widest text-slate-400">
          ป๊อก<span className="text-amber-500">เด้ง</span>
        </h2>
        <button onClick={requestLeave} className="text-[10px] font-black uppercase tracking-widest text-red-500 px-3 py-1.5 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-all">
          ออก
        </button>
      </div>

      {/* Players List */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-32 hide-scrollbar px-2">
        {Object.entries(playersData).map(([name, data]: [string, any]) => {
          const isMe = name === userNickname;
          const isDealer = name === roomData.host;
          const stats = calculatePokDeng(data.hand);
          const isStanding = data.status === 'stand';
          const showCards = isMe || phase === 'result' || (phase === 'dealer_action' && isDealer);

          return (
            <NeonCard key={name} color={isDealer ? 'amber' : 'slate'} className={`p-4 mx-2 transition-all ${isDealer ? 'bg-amber-900/20 border-amber-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
              <div className="flex-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex-center text-lg shadow-sm border ${isDealer ? 'bg-amber-500/20 border-amber-500/50' : 'bg-slate-800 border-slate-700'}`}>
                    {isDealer ? '🏦' : (roomData.players[name]?.avatar || '👤')}
                  </div>
                  <div className="flex flex-col">
                    <span className={`font-bold text-[13px] ${isMe ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {name} {isDealer ? <span className="text-[10px] text-amber-500 ml-1 uppercase tracking-widest">(เจ้ามือ)</span> : ''}
                    </span>
                    <span className="text-[11px] font-black text-amber-500">{data.chips} 🪙</span>
                  </div>
                </div>
                {phase === 'result' && (
                    <div className="text-right flex flex-col">
                        {data.isPok && <span className="text-[10px] font-black text-red-500 uppercase tracking-widest drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">POK {stats.weight}!</span>}
                        <span className={`text-lg font-black ${stats.weight >= 8 ? 'text-red-500' : 'text-slate-200'}`}>
                            {stats.weight} แต้ม {stats.deng > 1 ? <span className="text-amber-500 text-sm">{stats.deng} เด้ง</span> : ''}
                        </span>
                        {data.lastResult !== undefined && (
                            <span className={`text-[12px] font-black ${data.lastResult > 0 ? 'text-emerald-400' : data.lastResult < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                {data.lastResult > 0 ? `+${data.lastResult}` : data.lastResult}
                            </span>
                        )}
                    </div>
                )}
                {phase === 'playing' && !isDealer && (
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border ${isStanding ? 'bg-slate-800/50 text-slate-500 border-slate-700' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.3)]'}`}>
                        {isStanding ? 'READY' : 'PLAYING'}
                    </span>
                )}
              </div>

              <div className="flex justify-center sm:justify-start -mt-6 -mb-6 relative z-10">
                 <div className="w-full max-w-[200px] h-[120px] relative flex justify-center">
                    <SwipeableHand 
                      cards={showCards ? data.hand : data.hand.map(() => ({ value: '?', suit: '?' }))} 
                      hidden={!showCards}
                      fanAngle={15}
                      cardClassName="scale-75"
                    />
                 </div>
              </div>

              {/* Draw Action (if playing, not pok, not stand, and is me) */}
              <div className="flex justify-center mt-2 relative z-20">
                  {data.hand.length < 3 && isMe && phase === 'playing' && !data.isPok && !isDealer && !isStanding && (
                    <button onClick={() => drawCard(name)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 rounded-xl font-black uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 transition-all">
                      <span className="text-lg leading-none">+</span> จั่วเพิ่ม
                    </button>
                  )}
              </div>

              {isMe && phase === 'playing' && !isStanding && !data.isPok && !isDealer && (
                <button onClick={() => setStand(name)} className="w-full mt-4 py-3 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-400 rounded-xl active:scale-95 transition-all">
                  ไม่จั่ว (อยู่)
                </button>
              )}
            </NeonCard>
          );
        })}
      </div>

      {/* Host Controls */}
      <div className="absolute bottom-4 left-0 w-full px-4 z-50">
        {isHost && phase === 'playing' && (
            <GiantButton color="amber" onClick={finishPhase} className="w-full shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                เจ้ามือเล่นต่อ
            </GiantButton>
        )}
        {isHost && phase === 'dealer_action' && (
            <div className="flex flex-col gap-3 bg-slate-900 p-4 rounded-3xl border border-slate-800 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
                <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/30 text-center">
                    <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest mb-1 animate-pulse">ตาเจ้ามือแล้ว!</p>
                    <p className="text-xs font-bold text-slate-300">เลือกว่าจะจั่วเพิ่มหรือวัดแต้มเลย</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => drawCard(userNickname!)} disabled={playersData[userNickname!].hand.length >= 3} className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest bg-slate-800 text-slate-300 rounded-xl border border-slate-700 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale">จั่วไพ่</button>
                    <button onClick={finishPhase} className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest bg-amber-500 text-slate-900 rounded-xl border border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] active:scale-95 transition-all">วัดแต้มทั้งหมด</button>
                </div>
            </div>
        )}
        {isHost && phase === 'result' && (
            <div className="flex gap-3 bg-slate-900 p-4 rounded-3xl border border-slate-800 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
                <GiantButton color="amber" onClick={startGame} className="flex-1">
                    เล่นรอบใหม่
                </GiantButton>
                <button onClick={handleBackToLobby} className="flex-1 py-3 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-400 rounded-2xl active:scale-95 transition-all">
                   กลับ Lobby
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default PokDeng;

import React, { useState, useEffect } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { useGameLeave } from '../hooks/useGameLeave';
import PlayingCard from '../components/PlayingCard';
import { createDeck, shuffleDeck } from '../utils/cards';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { recordWin } from '../components/Scoreboard';

// --- PokDeng Logic ---
const calculatePokDeng = (cards) => {
  if (!cards || cards.length === 0) return { score: 0, deng: 1, type: 'Normal' };
  
  const getVal = (c) => {
    if (['10', 'J', 'Q', 'K'].includes(c.value)) return 0;
    if (c.value === 'A') return 1;
    return parseInt(c.value);
  };
  
  const total = cards.reduce((sum, c) => sum + getVal(c), 0);
  const score = total % 10;
  
  let deng = 1;
  let type = 'Normal';

  // 2 Cards
  if (cards.length === 2) {
    const isSameSuit = cards[0].suit === cards[1].suit;
    const isSameVal = cards[0].value === cards[1].value;
    if (isSameSuit || isSameVal) deng = 2;
    
    if (score >= 8) {
      type = `Pok ${score}`;
    }
  } 
  // 3 Cards
  else if (cards.length === 3) {
    const isSameSuit = cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
    const isTong = cards[0].value === cards[1].value && cards[1].value === cards[2].value;
    const isFace = ['J','Q','K'].includes(cards[0].value) && ['J','Q','K'].includes(cards[1].value) && ['J','Q','K'].includes(cards[2].value);
    
    if (isTong) {
      return { score: 10, deng: 5, type: 'Tong (ตอง)' }; // Special pseudo-score
    }
    if (isFace) {
      return { score: 9.5, deng: 3, type: 'Sam Lueng (เซียน)' };
    }
    if (isSameSuit) {
      deng = 3;
    }
  }
  
  return { score, deng, type };
};

const PokDeng = ({ roomId, roomData, userNickname }) => {
  const isHost = userNickname === roomData.host;
  const gameData = roomData.gameData || {};
  const phase = gameData.phase || 'waiting'; // waiting, playing, dealer_action, result
  const deck = gameData.deck || [];
  const playersData = gameData.players || {};
  const [errorMsg, setErrorMsg] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState({ startingChips: 1000 });
  
  const { confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const playerNames = Object.keys(roomData.players || {});

  const safeUpdate = async (updates) => {
    try {
      await update(ref(db, `rooms/${roomId}/gameData`), updates);
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  const startGame = async () => {
    if (!isHost) return;
    const newDeck = shuffleDeck(createDeck());
    const playersInit = {};
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
      if (stats.score >= 8) {
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

  const drawCard = async (playerName) => {
    const pData = playersData[playerName];
    if (pData.hand.length >= 3 || pData.status !== 'playing') return;

    const newDeck = [...deck];
    const newCard = newDeck.pop();
    
    await safeUpdate({
      deck: newDeck,
      [`players/${playerName}/hand`]: [...pData.hand, newCard],
      [`players/${playerName}/status`]: 'stand'
    });
  };

  const setStand = async (playerName) => {
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
      const dealer = playersData[roomData.host];
      const dStats = calculatePokDeng(dealer.hand);
      
      const updates = { phase: 'result' };
      
      Object.entries(playersData).forEach(([name, p]) => {
        if (name === roomData.host) return; // Skip dealer
        
        const pStats = calculatePokDeng(p.hand);
        let winAmount = 0;
        
        let hostWinCount = 0;
        
        // Dealer wins if score is higher, or if score is same but Dealer is Host (usually dealer wins ties in simple rules, but let's do push for ties unless Deng differs)
        if (pStats.score > dStats.score) {
          winAmount = p.bet * pStats.deng;
          recordWin(roomId, name, 'pokdeng');
        } else if (pStats.score < dStats.score) {
          winAmount = -(p.bet * dStats.deng);
          hostWinCount++;
        } else {
          // Tie score, check deng
          if (pStats.deng > dStats.deng) { winAmount = p.bet * pStats.deng; recordWin(roomId, name, 'pokdeng'); }
          else if (pStats.deng < dStats.deng) { winAmount = -(p.bet * dStats.deng); hostWinCount++; }
          else winAmount = 0; // Push
        }
        
        updates[`players/${name}/chips`] = (p.chips || 1000) + winAmount;
        updates[`players/${name}/lastResult`] = winAmount;
        
        // Host balance tracking (Host plays against everyone)
        const hostCurrent = updates[`players/${roomData.host}/chips`] !== undefined ? updates[`players/${roomData.host}/chips`] : (dealer.chips || 1000);
        updates[`players/${roomData.host}/chips`] = hostCurrent - winAmount;
        
        if (hostWinCount > 0) recordWin(roomId, roomData.host, 'pokdeng');
      });
      
      await safeUpdate(updates);
    }
  };

  if (phase === 'waiting') {
    return (
      <div className="flex-center flex-col gap-lg flex-1 text-center p-md animate-fade-in">
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        {showSettings && isHost && (
          <div className="fixed inset-0 z-50 flex-center p-6 bg-stone-900/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
            <div className="card p-6 w-full max-w-[320px] bg-white flex flex-col gap-4 text-left" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg text-stone-800">⚙️ ตั้งค่ากติกา (House Rules)</h3>
              <label className="flex flex-col gap-1">
                <span className="font-bold text-sm">ชิปเริ่มต้น</span>
                <input type="number" value={localSettings.startingChips} onChange={(e) => setLocalSettings({...localSettings, startingChips: Number(e.target.value)})} className="input py-2 px-3 border border-stone-300 rounded-lg font-bold" />
              </label>
              <button className="btn btn-primary mt-4 py-3 font-bold" onClick={() => setShowSettings(false)}>บันทึกการตั้งค่า</button>
            </div>
          </div>
        )}
        <div className="text-6xl drop-shadow-xl animate-bounce-slow">💰</div>
        <h2 className="text-3xl font-black text-rose-800 tracking-tight">ป๊อกเด้ง (Pok Deng)</h2>
        <p className="text-rose-600 font-medium">เจ้ามือ 1 คน ปะทะ ผู้เล่นทุกคน! ป๊อก 8 ป๊อก 9 ได้เลย!</p>
        
        {isHost ? (
          <div className="flex gap-2 w-full max-w-[280px]">
            <button className="btn btn-primary flex-1 py-4 text-lg font-bold shadow-xl shadow-primary/30" onClick={startGame}>
              แจกไพ่! (คุณเป็นเจ้ามือ)
            </button>
            <button className="btn bg-stone-100 border border-stone-300 px-4 shadow-sm" onClick={() => setShowSettings(true)}>
              ⚙️
            </button>
          </div>
        ) : (
          <div className="card w-full max-w-[280px] p-xl bg-rose-50/50 border-2 border-rose-100 flex-center">
            <span className="font-bold text-rose-500 animate-pulse">รอเจ้ามือแจกไพ่...</span>
          </div>
        )}
      </div>
    );
  }

  const dealer = playersData[roomData.host];
  const dealerStats = calculatePokDeng(dealer?.hand);
  const myData = playersData[userNickname] || {};
  const myStats = calculatePokDeng(myData.hand);
  
  // Check if everyone is ready
  const everyoneStood = Object.entries(playersData).every(([name, p]) => name === roomData.host || p.status === 'stand');

  return (
    <div className="flex flex-col flex-1 pb-24 relative max-w-2xl mx-auto w-full animate-fade-in bg-stone-50">
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      
      {/* Dealer Area */}
      <div className="bg-stone-800 text-white p-md text-center rounded-b-3xl shadow-xl z-10 relative">
        <h3 className="font-black text-stone-400 text-xs uppercase tracking-widest mb-2">เจ้ามือ (Dealer): {roomData.host}</h3>
        <div className="flex-center gap-xs min-h-[100px]">
          {dealer?.hand?.map((c, i) => (
            <div key={i} className="-ml-4 first:ml-0">
               <PlayingCard card={c} hidden={phase === 'playing' && !dealer.isPok && i > 0} />
            </div>
          ))}
        </div>
        {(phase === 'dealer_action' || phase === 'result' || dealer?.isPok) && (
          <div className="mt-2 text-rose-400 font-bold text-sm bg-rose-900/30 inline-block px-3 py-1 rounded-full">
            {dealerStats.type !== 'Normal' ? dealerStats.type : `${dealerStats.score} แต้ม`} {dealerStats.deng > 1 && `(${dealerStats.deng} เด้ง)`}
          </div>
        )}
      </div>

      {/* Players Area */}
      <div className="flex-1 overflow-y-auto p-md space-y-md">
        {Object.entries(playersData).filter(([name]) => name !== roomData.host).map(([name, p]) => {
          const stats = calculatePokDeng(p.hand);
          return (
            <div key={name} className={`card p-md border-2 ${name === userNickname ? 'border-primary shadow-md' : 'border-stone-200'}`}>
              <div className="flex justify-between items-center mb-sm">
                <div>
                  <span className="font-bold">{name}</span>
                  <span className="text-xs text-stone-500 ml-2">💰 {p.chips}</span>
                </div>
                {p.status === 'stand' && phase === 'playing' && <span className="text-xs font-bold text-success bg-success/10 px-2 py-1 rounded">พร้อมแล้ว</span>}
                {p.isPok && <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded border border-rose-200 animate-pulse">ป๊อก!</span>}
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex -space-x-4">
                  {p.hand?.map((c, i) => (
                    <div key={i} style={{ transform: 'scale(0.7)', transformOrigin: 'left center' }}><PlayingCard card={c} hidden={name !== userNickname && phase === 'playing' && !p.isPok} animated={false} /></div>
                  ))}
                </div>
                
                {(name === userNickname || phase === 'result' || p.isPok || phase === 'dealer_action') && (
                  <div className="text-right">
                    <p className="font-black text-lg text-stone-800">{stats.type !== 'Normal' ? stats.type : `${stats.score} แต้ม`}</p>
                    {stats.deng > 1 && <p className="text-sm font-bold text-orange-500">{stats.deng} เด้ง</p>}
                  </div>
                )}
              </div>
              
              {phase === 'result' && p.lastResult !== undefined && (
                <div className={`text-center mt-2 font-black text-lg ${p.lastResult > 0 ? 'text-success' : p.lastResult < 0 ? 'text-danger' : 'text-stone-400'}`}>
                  {p.lastResult > 0 ? `+${p.lastResult}` : p.lastResult < 0 ? p.lastResult : 'เจ๊า'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="mt-auto bg-white border-t p-md shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
        {phase === 'playing' && !isHost && myData.status === 'playing' && !myData.isPok ? (
          <div className="flex gap-sm">
            <button className="btn btn-primary flex-1 py-3 text-lg font-bold shadow-md" onClick={() => setStand(userNickname)}>
              พอแล้ว (STAND)
            </button>
            <button className="btn btn-outline flex-1 py-3 text-lg font-bold border-stone-300" onClick={() => drawCard(userNickname)}>
              จั่วไพ่ (DRAW)
            </button>
          </div>
        ) : phase === 'playing' && isHost ? (
          <button className="btn btn-primary w-full py-3 font-bold shadow-md" disabled={!everyoneStood && !dealer?.isPok} onClick={finishPhase}>
            {dealer?.isPok ? 'เปิดไพ่ผู้เล่นทุกคน (เจ้ามือป๊อก)' : everyoneStood ? 'ลูกมือพร้อมแล้ว เปิดไพ่!' : 'รอลูกมือตัดสินใจ...'}
          </button>
        ) : phase === 'dealer_action' && isHost ? (
          <div className="flex gap-sm">
            <button className="btn btn-primary flex-1 py-3 font-bold shadow-md" onClick={finishPhase}>
              วัดแต้มเลย (ไม่จั่ว)
            </button>
            {dealer?.hand?.length < 3 && (
              <button className="btn btn-outline flex-1 py-3 font-bold border-stone-300" onClick={() => drawCard(roomData.host)}>
                จั่วใบที่ 3
              </button>
            )}
          </div>
        ) : phase === 'result' && isHost ? (
          <button className="btn btn-primary w-full py-4 font-black shadow-xl" onClick={startGame}>
            เริ่มตาต่อไป
          </button>
        ) : (
          <div className="text-center font-bold text-stone-400 py-2">
            {phase === 'result' ? 'รอเจ้ามือเริ่มตาถัดไป...' : 'รอเจ้ามือดำเนินการ...'}
          </div>
        )}
      </div>
    </div>
  );
};

export default PokDeng;

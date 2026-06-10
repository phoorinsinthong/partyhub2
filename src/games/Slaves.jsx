import React, { useState, useEffect } from 'react';
import { ref, get, update } from 'firebase/database';
import { db } from '../firebase';
import { useGameLeave } from '../hooks/useGameLeave';
import PlayingCard from '../components/PlayingCard';
import { createDeck, shuffleDeck, sortCardsSlaves } from '../utils/cards';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { recordWin } from '../components/Scoreboard';

// Helper to determine combination type and highest card
const analyzePlay = (cards) => {
  if (!cards || cards.length === 0) return null;
  const sorted = sortCardsSlaves(cards);
  const highestCard = sorted[sorted.length - 1];

  // All cards must have the same value rank for single, pair, triple, quad
  const isSameValue = sorted.every(c => c.valueRank === sorted[0].valueRank);
  
  if (isSameValue) {
    if (cards.length === 1) return { type: 'single', highestCard, count: 1 };
    if (cards.length === 2) return { type: 'pair', highestCard, count: 2 };
    if (cards.length === 3) return { type: 'triple', highestCard, count: 3 };
    if (cards.length === 4) return { type: 'quad', highestCard, count: 4 }; // Bomb
  }
  return null; // Invalid combination (straights are omitted for simplicity)
};

const validatePlay = (selectedCards, table) => {
  const play = analyzePlay(selectedCards);
  if (!play) return false;

  // If table is empty, any valid combination is allowed
  if (!table || table.cards.length === 0) return true;

  // Must match the number of cards (except if bombing a single/pair, but let's stick to standard matching first)
  if (play.count !== table.type.count) {
    // Optional: Quad (Bomb) beats any single/pair/triple. Uncomment to add bomb rule.
    // if (play.count === 4) return true; 
    return false;
  }

  // Compare highest card
  if (play.highestCard.valueRank > table.highestCard.valueRank) return true;
  if (play.highestCard.valueRank === table.highestCard.valueRank) {
    return play.highestCard.suitRank > table.highestCard.suitRank;
  }

  return false;
};

const Slaves = ({ roomId, roomData, userNickname }) => {
  const isHost = userNickname === roomData.host;
  const gameData = roomData.gameData || {};
  const phase = gameData.phase || 'waiting'; // waiting, playing, result
  const playersData = gameData.players || {};
  const currentTurn = gameData.currentTurn || null;
  const table = gameData.table || { cards: [] };
  const passCount = gameData.passCount || 0;
  const roundCount = gameData.roundCount || 1;
  const ranks = gameData.ranks || []; // Ordered list of nicknames who finished
  
  const [errorMsg, setErrorMsg] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedCards, setSelectedCards] = useState([]);
  const [localSettings, setLocalSettings] = useState({ enableBomb: true, allowStraight: true });
  
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
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
    if (playerNames.length < 2) {
      setErrorMsg('ต้องมีผู้เล่นอย่างน้อย 2 คน');
      return;
    }

    const deck = shuffleDeck(createDeck());
    const playersInit = {};
    let firstTurn = playerNames[0];

    // Deal cards
    playerNames.forEach(name => { playersInit[name] = { hand: [], isPass: false }; });
    let i = 0;
    while (deck.length > 0) {
      const card = deck.pop();
      playersInit[playerNames[i % playerNames.length]].hand.push(card);
      // In round 1, person with 3♣️ goes first
      if (roundCount === 1 && card.id === '3_of_clubs') {
        firstTurn = playerNames[i % playerNames.length];
      }
      i++;
    }

    // Sort hands
    playerNames.forEach(name => {
      playersInit[name].hand = sortCardsSlaves(playersInit[name].hand);
    });

    // If round > 1, the first turn is the King (or whoever won)
    if (roundCount > 1 && ranks.length > 0) {
      firstTurn = ranks[0]; // King goes first
    }

    await safeUpdate({
      phase: 'playing',
      players: playersInit,
      settings: localSettings,
      currentTurn: firstTurn,
      table: { cards: [] },
      passCount: 0,
      ranks: [],
    });
  };

  const getNextTurn = (current, currentPlayers) => {
    const names = Object.keys(currentPlayers);
    let idx = names.indexOf(current);
    for (let i = 0; i < names.length; i++) {
      idx = (idx + 1) % names.length;
      const nextPlayer = names[idx];
      // Skip players who have finished (hand empty) or passed
      if (currentPlayers[nextPlayer].hand && currentPlayers[nextPlayer].hand.length > 0 && !currentPlayers[nextPlayer].isPass) {
        return nextPlayer;
      }
    }
    return null;
  };

  const toggleCardSelection = (card) => {
    if (selectedCards.some(c => c.id === card.id)) {
      setSelectedCards(selectedCards.filter(c => c.id !== card.id));
    } else {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const handlePlayCards = async () => {
    if (currentTurn !== userNickname) return;
    
    // In round 1, first play MUST include 3♣️ if table is empty
    if (roundCount === 1 && (!table || table.cards.length === 0)) {
      const has3Clubs = selectedCards.some(c => c.id === '3_of_clubs');
      const myHandHas3Clubs = playersData[userNickname].hand.some(c => c.id === '3_of_clubs');
      if (myHandHas3Clubs && !has3Clubs) {
        setErrorMsg('ตาแรกต้องลง 3 ดอกจิก');
        setTimeout(() => setErrorMsg(''), 2000);
        return;
      }
    }

    const play = analyzePlay(selectedCards);
    if (!play) {
      setErrorMsg('รูปแบบไพ่ไม่ถูกต้อง (ลงได้แค่ เดี่ยว, คู่, ตอง, โฟร์)');
      setTimeout(() => setErrorMsg(''), 2000);
      return;
    }

    if (!validatePlay(selectedCards, table)) {
      setErrorMsg('ไพ่เล็กกว่าบนโต๊ะ หรือจำนวนไม่ตรงกัน');
      setTimeout(() => setErrorMsg(''), 2000);
      return;
    }

    // Remove cards from hand
    const myHand = playersData[userNickname].hand || [];
    const newHand = myHand.filter(c => !selectedCards.some(sc => sc.id === c.id));
    
    const updates = {
      table: {
        cards: selectedCards,
        playedBy: userNickname,
        type: play,
        highestCard: play.highestCard
      },
      [`players/${userNickname}/hand`]: newHand,
      [`players/${userNickname}/isPass`]: false
    };

    let nextRanks = [...ranks];
    if (newHand.length === 0) {
      nextRanks.push(userNickname);
      updates.ranks = nextRanks;
    }

    // Check game end condition (only 1 player has cards left)
    const activePlayers = Object.keys(playersData).filter(name => 
      (name === userNickname ? newHand.length : playersData[name].hand?.length) > 0
    );

    if (activePlayers.length <= 1) {
      if (activePlayers.length === 1) nextRanks.push(activePlayers[0]); // Last player is slave
      updates.phase = 'result';
      updates.ranks = nextRanks;
      updates.roundCount = roundCount + 1;
    } else {
      // Only update my isPass. DO NOT clear for everyone.
      updates.currentTurn = getNextTurn(userNickname, { ...playersData, [userNickname]: { ...playersData[userNickname], hand: newHand, isPass: false } });
    }

    setSelectedCards([]);
    await safeUpdate(updates);
  };

  const handlePass = async () => {
    if (currentTurn !== userNickname) return;
    if (!table || table.cards.length === 0) {
      setErrorMsg('คุณเป็นคนเริ่ม ต้องลงไพ่');
      setTimeout(() => setErrorMsg(''), 2000);
      return;
    }

    const nextPlayersData = { ...playersData, [userNickname]: { ...playersData[userNickname], isPass: true } };
    const activePlayers = Object.keys(nextPlayersData).filter(name => nextPlayersData[name].hand?.length > 0);
    const passedPlayers = activePlayers.filter(name => nextPlayersData[name].isPass);
    
    const updates = {
      [`players/${userNickname}/isPass`]: true,
    };

    if (passedPlayers.length >= activePlayers.length - 1) {
      // Everyone else passed, table is cleared
      updates.table = { cards: [] };
      
      // Create a temporary state to calculate next turn since everyone's pass is cleared
      const nextClearedPlayersData = {};
      Object.keys(playersData).forEach(n => { 
         updates[`players/${n}/isPass`] = false; 
         nextClearedPlayersData[n] = { ...playersData[n], isPass: false };
      });
      
      // The person who played the last cards gets the turn
      // If that person has finished their hand, next available player gets the turn
      let nextTurn = table.playedBy;
      if (nextClearedPlayersData[nextTurn]?.hand?.length === 0) {
         nextTurn = getNextTurn(nextTurn, nextClearedPlayersData);
      }
      updates.currentTurn = nextTurn;
    } else {
      updates.currentTurn = getNextTurn(userNickname, nextPlayersData);
    }

    setSelectedCards([]);
    await safeUpdate(updates);
  };

  // Apply settings to logic (mock example)
  const isBombEnabled = gameData.settings?.enableBomb ?? true;
  const isStraightEnabled = gameData.settings?.allowStraight ?? true;

  if (phase === 'waiting') {
    return (
      <div className="flex-center flex-col gap-lg flex-1 text-center p-md animate-fade-in">
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        {showSettings && isHost && (
          <div className="fixed inset-0 z-50 flex-center p-6 bg-stone-900/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
            <div className="card p-6 w-full max-w-[320px] bg-white flex flex-col gap-4 text-left" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg text-stone-800">⚙️ ตั้งค่ากติกา (House Rules)</h3>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={localSettings.enableBomb} onChange={(e) => setLocalSettings({...localSettings, enableBomb: e.target.checked})} className="w-5 h-5 accent-primary" />
                <span className="font-bold text-sm">ทิ้งตอง 4 (บอมบ์) ล้างโต๊ะได้</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={localSettings.allowStraight} onChange={(e) => setLocalSettings({...localSettings, allowStraight: e.target.checked})} className="w-5 h-5 accent-primary" />
                <span className="font-bold text-sm">อนุญาตให้ลงไพ่เรียง (Straight)</span>
              </label>
              <button className="btn btn-primary mt-4 py-3 font-bold" onClick={() => setShowSettings(false)}>บันทึกการตั้งค่า</button>
            </div>
          </div>
        )}
        <div className="text-6xl drop-shadow-xl animate-bounce-slow">👑</div>
        <h2 className="text-3xl font-black text-indigo-800 tracking-tight">สลาฟ (Slaves)</h2>
        <p className="text-indigo-600 font-medium">เกมชิงตำแหน่งราชาแห่งไพ่!</p>
        
        {isHost ? (
          <div className="flex gap-2 w-full max-w-[280px]">
            <button className="btn btn-primary flex-1 py-4 text-lg font-bold shadow-xl" onClick={startGame}>
              เริ่มเกมเลย!
            </button>
            <button className="btn bg-stone-100 border border-stone-300 px-4 shadow-sm" onClick={() => setShowSettings(true)}>
              ⚙️
            </button>
          </div>
        ) : (
          <div className="card w-full max-w-[280px] p-xl bg-olive-50/50 border-2 border-olive-100 flex-center">
            <span className="font-bold text-olive-500 animate-pulse">รอ Host เริ่มเกม...</span>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'result') {
    return (
      <div className="flex flex-col gap-md flex-1 p-md max-w-md mx-auto w-full animate-fade-in">
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-center mb-lg">
          <div className="text-5xl mb-sm">👑</div>
          <h2 className="text-2xl font-black text-olive-800">สรุปผลรอบที่ {roundCount - 1}</h2>
        </div>
        
        <div className="space-y-sm">
          {ranks.map((name, idx) => {
            let role = 'ประชาชน';
            let icon = '🧑‍🌾';
            if (idx === 0) { role = 'King'; icon = '👑'; }
            if (idx === 1 && ranks.length > 2) { role = 'Queen'; icon = '👸'; }
            if (idx === ranks.length - 1) { role = 'Slave'; icon = '🧹'; }
            
            return (
              <div key={name} className="flex justify-between items-center p-md bg-white rounded-xl shadow-sm border border-stone-200">
                <div className="flex items-center gap-md">
                  <span className="text-2xl">{icon}</span>
                  <span className="font-bold">{name}</span>
                </div>
                <span className="text-sm font-black text-stone-400 uppercase tracking-widest">{role}</span>
              </div>
            );
          })}
        </div>
        
        {isHost && (
          <button className="btn btn-primary w-full py-4 mt-lg font-black shadow-lg" onClick={startGame}>
            เริ่มรอบต่อไป
          </button>
        )}
      </div>
    );
  }

  const myData = playersData[userNickname] || { hand: [] };
  const myHand = myData.hand || [];

  return (
    <div className="flex flex-col flex-1 pb-24 relative max-w-4xl mx-auto w-full overflow-hidden animate-fade-in">
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      {errorMsg && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-xl z-50 text-sm font-bold shadow-lg">{errorMsg}</div>}

      {/* Opponents Area (Top & Sides conceptually, placed at top for mobile) */}
      <div className="flex gap-xs p-sm overflow-x-auto bg-stone-100/50 shadow-inner">
        {Object.entries(playersData).filter(([name]) => name !== userNickname).map(([name, p]) => (
          <div key={name} className={`flex-shrink-0 card p-xs px-sm flex items-center gap-sm transition-colors ${currentTurn === name ? 'ring-2 ring-primary bg-white' : 'bg-stone-50 border-stone-200'} ${p.isPass ? 'opacity-50' : ''}`}>
            <div className="text-xs">
              <p className="font-bold text-stone-700 truncate max-w-[80px]">{name}</p>
              <p className="text-[10px] text-stone-400">{p.isPass ? 'ผ่าน' : p.hand?.length === 0 ? 'หมดมือ' : `${p.hand?.length || 0} ใบ`}</p>
            </div>
            {currentTurn === name && <span className="animate-pulse text-primary text-xs">💬</span>}
          </div>
        ))}
      </div>

      {/* Table Area */}
      <div className="flex-1 flex-center flex-col relative p-md">
        {table.cards && table.cards.length > 0 ? (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
            <div className="flex-center -space-x-8 mb-sm">
              {table.cards.map((card, idx) => (
                <div key={card.id} className="hover:-translate-y-2 transition-transform" style={{ zIndex: idx, rotate: `${(idx - table.cards.length/2)*5}deg` }}>
                  <PlayingCard card={card} />
                </div>
              ))}
            </div>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest bg-stone-100 px-3 py-1 rounded-full">วางโดย: {table.playedBy}</p>
          </motion.div>
        ) : (
          <div className="w-32 h-40 border-4 border-dashed border-stone-200 rounded-2xl flex-center text-stone-300 font-bold text-sm">
            โต๊ะว่าง
          </div>
        )}
      </div>

      {/* My Hand Area */}
      <div className={`mt-auto bg-white border-t border-stone-200 p-md pb-6 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] transition-colors ${currentTurn === userNickname ? 'bg-primary/5' : ''}`}>
        
        {/* Actions */}
        <div className="flex-between mb-sm h-12">
          {currentTurn === userNickname ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-sm w-full">
              <button className="btn btn-outline flex-1 font-bold text-danger border-danger/30 hover:bg-danger/10" onClick={handlePass}>
                ผ่าน
              </button>
              <button 
                className={`btn btn-primary flex-2 font-bold shadow-lg ${selectedCards.length === 0 ? 'opacity-50' : 'animate-pulse-soft'}`} 
                onClick={handlePlayCards}
                disabled={selectedCards.length === 0}
              >
                ลงไพ่ ({selectedCards.length} ใบ)
              </button>
            </motion.div>
          ) : (
            <div className="w-full text-center text-stone-500 font-bold text-sm">
              กำลังรอ {currentTurn} เล่น...
            </div>
          )}
        </div>

        {/* Hand Cards */}
        <div className="flex justify-center flex-wrap gap-xs sm:gap-sm mt-md">
          <AnimatePresence>
            {myHand.map((card) => {
              const isSelected = selectedCards.some(c => c.id === card.id);
              return (
                <PlayingCard 
                  key={card.id} 
                  card={card} 
                  selected={isSelected}
                  onClick={toggleCardSelection}
                  className="sm:w-16 sm:h-24 w-12 h-16 text-[10px]"
                />
              );
            })}
          </AnimatePresence>
          {myHand.length === 0 && (
            <p className="text-center w-full font-bold text-success py-md">🎉 ไพ่หมดมือแล้ว!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Slaves;

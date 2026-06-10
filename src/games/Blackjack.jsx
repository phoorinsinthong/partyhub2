import React, { useState, useEffect, useRef } from 'react';
import { ref, get, update } from 'firebase/database';
import { db } from '../firebase';
import { useGameLeave } from '../hooks/useGameLeave';
import PlayingCard from '../components/PlayingCard';
import { createDeck, shuffleDeck, calculateBlackjackScore } from '../utils/cards';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { recordWin } from '../components/Scoreboard';

const Blackjack = ({ roomId, roomData, userNickname }) => {
  const isHost = userNickname === roomData.host;
  const gameData = roomData.gameData || {};
  const phase = gameData.phase || 'waiting'; // waiting, playing, dealerTurn, result
  const deck = gameData.deck || [];
  const dealer = gameData.dealer || { hand: [] };
  const playersData = gameData.players || {};
  const currentTurn = gameData.currentTurn || null;
  const [errorMsg, setErrorMsg] = useState('');
  
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
    
    let newDeck = shuffleDeck(createDeck());
    const playersInit = {};
    const dealerInit = { hand: [newDeck.pop(), newDeck.pop()] };

    const activePlayers = playerNames.filter(name => name !== roomData.host);
    activePlayers.forEach(name => {
      playersInit[name] = {
        hand: [newDeck.pop(), newDeck.pop()],
        status: 'playing', // playing, stand, bust
      };
    });

    if (activePlayers.length === 0) {
      setErrorMsg('ต้องมีผู้เล่นอื่นอย่างน้อย 1 คน');
      return;
    }

    await safeUpdate({
      phase: 'playing',
      deck: newDeck,
      dealer: dealerInit,
      players: playersInit,
      currentTurn: activePlayers[0],
    });
  };

  const handleHit = async () => {
    if (currentTurn !== userNickname) return;
    
    const newDeck = [...deck];
    if (newDeck.length === 0) return;
    
    const card = newDeck.pop();
    const myHand = [...(playersData[userNickname]?.hand || []), card];
    const score = calculateBlackjackScore(myHand);
    
    let nextStatus = 'playing';
    let nextTurn = currentTurn;

    if (score > 21) {
      nextStatus = 'bust';
      // Pass turn to next player
      nextTurn = getNextTurn(currentTurn);
    }

    const updates = {
      deck: newDeck,
      [`players/${userNickname}/hand`]: myHand,
      [`players/${userNickname}/status`]: nextStatus,
    };

    if (nextTurn !== currentTurn) {
      updates.currentTurn = nextTurn;
      if (!nextTurn) updates.phase = 'dealerTurn';
    }

    await safeUpdate(updates);
  };

  const handleStand = async () => {
    if (currentTurn !== userNickname) return;
    
    const nextTurn = getNextTurn(currentTurn);
    const updates = {
      [`players/${userNickname}/status`]: 'stand',
      currentTurn: nextTurn,
    };

    if (!nextTurn) {
      updates.phase = 'dealerTurn';
    }

    await safeUpdate(updates);
  };

  const getNextTurn = (current) => {
    const names = Object.keys(playersData);
    const idx = names.indexOf(current);
    if (idx === -1 || idx === names.length - 1) return null; // No more players
    return names[idx + 1];
  };

  // Dealer Auto Play
  useEffect(() => {
    if (!isHost || phase !== 'dealerTurn') return;
    
    const playDealer = async () => {
      let currentHand = [...(dealer.hand || [])];
      let currentDeck = [...deck];
      
      let score = calculateBlackjackScore(currentHand);
      while (score < 17 && currentDeck.length > 0) {
        currentHand.push(currentDeck.pop());
        score = calculateBlackjackScore(currentHand);
      }
      
      await safeUpdate({
        phase: 'result',
        deck: currentDeck,
        [`dealer/hand`]: currentHand,
      });
    };

    playDealer();
  }, [phase, isHost]); // Only trigger when entering dealerTurn

  const playAgain = async () => {
    if (!isHost) return;
    await safeUpdate({
      phase: 'waiting',
      deck: null,
      dealer: null,
      players: null,
      currentTurn: null,
    });
  };

  // Rendering
  if (phase === 'waiting') {
    return (
      <div className="flex-center flex-col gap-lg flex-1 text-center p-md animate-fade-in">
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-6xl drop-shadow-xl animate-bounce-slow">🃏</div>
        <h2 className="text-3xl font-black text-olive-800 tracking-tight">BLACKJACK</h2>
        <p className="text-olive-600 font-medium">ไพ่แบล็คแจ็ค 21 แต้ม! เจ้ามือรอสับไพ่อยู่</p>
        
        {isHost ? (
          <button className="btn btn-primary w-full max-w-[280px] py-4 text-lg font-bold shadow-xl shadow-primary/30 hover:scale-105 transition-transform" onClick={startGame}>
            แจกไพ่!
          </button>
        ) : (
          <div className="card w-full max-w-[280px] p-xl bg-olive-50/50 border-2 border-olive-100 flex-center">
            <span className="font-bold text-olive-500 animate-pulse">รอ Host เริ่มเกม...</span>
          </div>
        )}
      </div>
    );
  }

  const dealerScore = calculateBlackjackScore(dealer.hand || []);
  const myData = playersData[userNickname] || { hand: [] };
  const myScore = calculateBlackjackScore(myData.hand);

  return (
    <div className="flex flex-col gap-md flex-1 pb-24 p-md relative max-w-lg mx-auto w-full">
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      {errorMsg && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-xl z-50 text-sm font-bold">{errorMsg}</div>}

      {/* Dealer Area */}
      <div className="card p-md bg-stone-800 text-white border-stone-700 shadow-xl text-center relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-stone-700 rounded-full opacity-50 blur-2xl"></div>
        <h3 className="font-black text-stone-300 uppercase tracking-widest text-xs mb-sm relative z-10">Dealer</h3>
        
        <div className="flex-center gap-xs relative z-10 mb-sm min-h-[120px]">
          <AnimatePresence>
            {(dealer.hand || []).map((card, idx) => (
              <div key={idx} className="-ml-6 first:ml-0 hover:-translate-y-2 transition-transform">
                <PlayingCard 
                  card={card} 
                  hidden={!isHost && phase === 'playing' && idx === 1} // Hide second card during playing
                />
              </div>
            ))}
          </AnimatePresence>
        </div>
        
        {phase === 'result' && (
          <div className={`inline-block px-4 py-1 rounded-full text-sm font-bold shadow-inner ${dealerScore > 21 ? 'bg-red-500/20 text-red-400' : 'bg-stone-700 text-white'}`}>
            {dealerScore > 21 ? 'Bust!' : `แต้ม: ${dealerScore}`}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="text-center font-bold text-sm bg-white p-sm rounded-xl shadow-sm border border-stone-100">
        {phase === 'playing' ? (
          currentTurn === userNickname ? <span className="text-primary animate-pulse">👉 ตาของคุณ! 👈</span> : <span className="text-stone-500">กำลังรอ {currentTurn} จั่วไพ่...</span>
        ) : phase === 'dealerTurn' ? (
          <span className="text-orange-500 animate-pulse">เจ้ามือกำลังจั่ว...</span>
        ) : (
          <span className="text-stone-800 text-lg uppercase tracking-wider">สรุปผล!</span>
        )}
      </div>

      {/* Result Board */}
      {phase === 'result' && (
        <div className="card p-md space-y-xs animate-fade-in">
          {Object.entries(playersData).map(([name, p]) => {
            const s = calculateBlackjackScore(p.hand || []);
            let res = '';
            let color = '';
            
            if (s > 21) { res = 'Bust'; color = 'text-red-500'; }
            else if (dealerScore > 21) { res = 'Win'; color = 'text-success'; }
            else if (s > dealerScore) { res = 'Win'; color = 'text-success'; }
            else if (s === dealerScore) { res = 'Push'; color = 'text-stone-500'; }
            else { res = 'Lose'; color = 'text-red-500'; }

            return (
              <div key={name} className={`flex justify-between items-center p-sm rounded-lg border ${name === userNickname ? 'bg-primary/5 border-primary/20' : 'bg-stone-50 border-stone-100'}`}>
                <span className="font-bold text-sm">{name}</span>
                <div className="flex items-center gap-md">
                  <span className="font-mono text-stone-600">{s}</span>
                  <span className={`font-black text-xs uppercase w-12 text-right ${color}`}>{res}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Other Players Preview (Very Small) */}
      <div className="flex gap-sm overflow-x-auto pb-sm snap-x">
        {Object.entries(playersData).filter(([name]) => name !== userNickname && name !== roomData.host).map(([name, p]) => (
          <div key={name} className="flex-shrink-0 card p-sm min-w-[120px] text-center snap-center bg-stone-50 border-stone-100">
            <p className="text-[10px] font-bold text-stone-500 truncate mb-xs">{name}</p>
            <div className="flex-center -space-x-4">
              {(p.hand || []).map((card, idx) => (
                <div key={idx} style={{ transform: 'scale(0.5)', margin: '-16px' }}>
                  <PlayingCard card={card} animated={false} />
                </div>
              ))}
            </div>
            {phase === 'result' && <p className="text-xs font-bold mt-sm">{calculateBlackjackScore(p.hand || [])}</p>}
          </div>
        ))}
      </div>

      {/* My Area (Hide for Host in Blackjack since Host is only Dealer) */}
      {!isHost && (
        <div className={`mt-auto card p-md shadow-xl border-t-4 transition-colors ${currentTurn === userNickname ? 'border-primary bg-primary/5' : 'border-stone-200'}`}>
          <div className="flex justify-between items-center mb-md">
            <div>
              <h3 className="font-black text-lg leading-none">ไพ่ของคุณ</h3>
              <p className="text-xs text-stone-500 font-bold">{userNickname}</p>
            </div>
            <div className={`px-4 py-1.5 rounded-full font-black text-lg shadow-inner ${myScore > 21 ? 'bg-red-500 text-white' : myScore === 21 ? 'bg-success text-white' : 'bg-stone-200 text-stone-700'}`}>
              {myScore > 21 ? 'BUST' : myScore === 21 ? '21!' : myScore}
            </div>
          </div>

          <div className="flex-center gap-xs min-h-[140px] mb-md relative">
            <AnimatePresence>
              {(myData.hand || []).map((card, idx) => (
                <div key={idx} className="-ml-6 first:ml-0 hover:-translate-y-4 transition-transform z-10 hover:z-20">
                  <PlayingCard card={card} />
                </div>
              ))}
            </AnimatePresence>
          </div>

          {/* Controls */}
          {phase === 'playing' && currentTurn === userNickname && myScore <= 21 && (
            <div className="flex gap-sm mt-4">
              <button className="btn btn-outline flex-1 py-4 text-lg font-black" onClick={handleStand}>STAND</button>
              <button className="btn btn-primary flex-1 py-4 text-lg font-black shadow-xl shadow-primary/30" onClick={handleHit}>HIT</button>
            </div>
          )}
        </div>
      )}

      {phase === 'result' && isHost && (
        <div className="p-md mt-auto">
          <button className="btn btn-primary w-full py-4 mt-4 font-black shadow-lg" onClick={playAgain}>
            เล่นรอบใหม่
          </button>
        </div>
      )}
    </div>
  );
};

export default Blackjack;

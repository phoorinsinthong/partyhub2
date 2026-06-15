import React, { useState, useEffect, useRef } from 'react';
import { ref, get, update } from 'firebase/database';
import { db } from '../firebase';
import { useGameLeave } from '../hooks/useGameLeave';
import PlayingCard from '../components/PlayingCard';
import { createDeck, shuffleDeck } from '../utils/cards';
import { evaluatePokerHand } from '../utils/pokerEvaluator';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { recordWin } from '../components/Scoreboard';

const STARTING_CHIPS = 1000;

const Poker = ({ roomId, roomData, userNickname }) => {
  const isHost = userNickname === roomData.host;
  const gameData = roomData.gameData || {};
  const phase = gameData.phase || 'waiting'; // waiting, pre-flop, flop, turn, river, showdown
  const deck = gameData.deck || [];
  const communityCards = gameData.communityCards || [];
  const pot = gameData.pot || 0;
  const currentBet = gameData.currentBet || 0;
  const playersData = gameData.players || {};
  const currentTurn = gameData.currentTurn || null;
  const activePlayers = Object.keys(playersData).filter(p => !playersData[p].folded && (playersData[p].chips > 0 || playersData[p].currentRoundBet > 0));

  const [errorMsg, setErrorMsg] = useState('');
  const [raiseAmount, setRaiseAmount] = useState(10);
  const [showSettings, setShowSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState({ startingChips: 1000 });
  const advancingRef = useRef(false);
  
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
    
    // First time init chips
    const playersInit = {};
    const startChips = gameData.settings?.startingChips || localSettings.startingChips || STARTING_CHIPS;

    playerNames.forEach(name => {
      const chips = playersData[name]?.chips !== undefined ? playersData[name].chips : startChips;
      playersInit[name] = {
        chips: chips, // Keep existing chips if playing next round
        hand: [],
        folded: chips <= 0, // Auto fold if out of chips
        currentRoundBet: 0,
        totalBet: 0,
        hasActed: false,
      };
    });

    const newDeck = shuffleDeck(createDeck());
    
    // Deal 2 cards each
    playerNames.forEach(name => {
      playersInit[name].hand = [newDeck.pop(), newDeck.pop()];
    });

    await safeUpdate({
      phase: 'pre-flop',
      deck: newDeck,
      communityCards: [],
      pot: 0,
      currentBet: 0,
      players: playersInit,
      settings: localSettings,
      currentTurn: playerNames[0], // simplified: host starts
    });
  };

  const getNextTurn = (current, currentPlayers) => {
    const names = Object.keys(currentPlayers);
    let idx = names.indexOf(current);
    for (let i = 0; i < names.length; i++) {
      idx = (idx + 1) % names.length;
      const nextPlayer = names[idx];
      // Skip folded players and all-in players
      if (!currentPlayers[nextPlayer].folded && currentPlayers[nextPlayer].chips > 0) {
        return nextPlayer;
      }
    }
    return null;
  };

  const checkRoundComplete = (currentPlayers) => {
    const active = Object.values(currentPlayers).filter(p => !p.folded);
    if (active.length <= 1) return true; // Everyone else folded
    
    const activeNonAllIn = active.filter(p => p.chips > 0);
    if (activeNonAllIn.length === 0) return true; // Everyone is all-in

    // Round is complete if all non-folded, non-all-in players have acted and matched the currentBet
    return activeNonAllIn.every(p => p.hasActed && p.currentRoundBet === currentBet);
  };

  const advancePhase = async (updates, currentPlayers) => {
    const active = Object.values(currentPlayers).filter(p => !p.folded);
    const activeNonAllIn = active.filter(p => p.chips > 0);
    
    if (active.length <= 1 || activeNonAllIn.length <= 1) {
      // Refund unmatched bets for the lone non-all-in player
      if (activeNonAllIn.length === 1 && active.length > 1) {
        const lonePlayer = activeNonAllIn[0];
        const lonePlayerName = Object.keys(currentPlayers).find(n => currentPlayers[n] === lonePlayer);
        const otherActive = active.filter(p => p !== lonePlayer);
        const maxOtherBet = Math.max(...otherActive.map(p => p.currentRoundBet));
        
        if (lonePlayer.currentRoundBet > maxOtherBet) {
          const refund = lonePlayer.currentRoundBet - maxOtherBet;
          updates[`players/${lonePlayerName}/chips`] = lonePlayer.chips + refund;
          updates.pot = (updates.pot !== undefined ? updates.pot : pot) - refund;
        }
      }

      // Fast-forward to showdown
      if (active.length > 1) {
         const newDeck = updates.deck || [...deck];
         const newCommunity = updates.communityCards || [...communityCards];
         while (newCommunity.length < 5) {
             newCommunity.push(newDeck.pop());
         }
         updates.deck = newDeck;
         updates.communityCards = newCommunity;
      }
      
      updates.phase = 'showdown';
      return updates;
    }

    // Reset currentRoundBet and hasActed for all players
    Object.keys(currentPlayers).forEach(n => {
      updates[`players/${n}/currentRoundBet`] = 0;
      updates[`players/${n}/hasActed`] = false;
      // Also update in our local object so getNextTurn works properly if called later
      currentPlayers[n].currentRoundBet = 0;
      currentPlayers[n].hasActed = false;
    });
    updates.currentBet = 0;

    const newDeck = [...deck];
    const newCommunity = [...communityCards];

    if (phase === 'pre-flop') {
      updates.phase = 'flop';
      newCommunity.push(newDeck.pop(), newDeck.pop(), newDeck.pop());
    } else if (phase === 'flop') {
      updates.phase = 'turn';
      newCommunity.push(newDeck.pop());
    } else if (phase === 'turn') {
      updates.phase = 'river';
      newCommunity.push(newDeck.pop());
    } else if (phase === 'river') {
      updates.phase = 'showdown';
    }

    updates.deck = newDeck;
    updates.communityCards = newCommunity;
    updates.currentTurn = getNextTurn(null, currentPlayers); // First active player

    return updates;
  };

  const handleAction = async (action, amount = 0) => {
    if (currentTurn !== userNickname) return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    
    const myData = playersData[userNickname];
    let newChips = myData.chips;
    let newRoundBet = myData.currentRoundBet;
    let newTotalBet = myData.totalBet;
    let newPot = pot;
    let newCurrentBet = currentBet;
    let folded = myData.folded;

    if (action === 'fold') {
      folded = true;
    } else if (action === 'call' || action === 'raise') {
      const callAmount = currentBet - myData.currentRoundBet;
      const totalAmount = callAmount + amount; // amount is extra raise
      
      const actualBet = Math.min(newChips, totalAmount); // Cap at all-in
      
      newChips -= actualBet;
      newRoundBet += actualBet;
      newTotalBet += actualBet;
      newPot += actualBet;
      if (newRoundBet > newCurrentBet) {
        newCurrentBet = newRoundBet;
      }
    }

    const nextPlayers = JSON.parse(JSON.stringify(playersData));
    nextPlayers[userNickname] = { ...myData, chips: newChips, currentRoundBet: newRoundBet, totalBet: newTotalBet, folded, hasActed: true };

    // If someone raises, everyone else's hasActed needs to be re-evaluated
    if (action === 'raise') {
        Object.keys(nextPlayers).forEach(n => {
            if (n !== userNickname && !nextPlayers[n].folded && nextPlayers[n].chips > 0) {
                nextPlayers[n].hasActed = false;
            }
        });
    }

    let updates = {
      [`players/${userNickname}/chips`]: newChips,
      [`players/${userNickname}/currentRoundBet`]: newRoundBet,
      [`players/${userNickname}/totalBet`]: newTotalBet,
      [`players/${userNickname}/folded`]: folded,
      [`players/${userNickname}/hasActed`]: true,
      pot: newPot,
      currentBet: newCurrentBet,
    };
    
    // Propagate hasActed = false for others if there was a raise
    if (action === 'raise') {
        Object.keys(nextPlayers).forEach(n => {
            if (n !== userNickname) {
                updates[`players/${n}/hasActed`] = nextPlayers[n].hasActed;
            }
        });
    }

    if (checkRoundComplete(nextPlayers)) {
      updates = await advancePhase(updates, nextPlayers);
    } else {
      updates.currentTurn = getNextTurn(userNickname, nextPlayers);
    }

    await safeUpdate(updates);
    advancingRef.current = false;
  };

  const resolveShowdown = async () => {
    if (!isHost) return;

    const activeNames = Object.keys(playersData).filter(n => !playersData[n].folded);
    let winners = [];
    let bestScore = -1;

    if (activeNames.length === 1) {
      winners = [activeNames[0]];
    } else {
      activeNames.forEach(name => {
        const ev = evaluatePokerHand(playersData[name].hand, communityCards);
        if (ev.score > bestScore) {
          bestScore = ev.score;
          winners = [name];
        } else if (ev.score === bestScore) {
          winners.push(name);
        }
      });
    }

    // Distribute pot
    const winAmount = Math.floor(pot / winners.length);
    const updates = { pot: 0, currentBet: 0, winners };

    Object.keys(playersData).forEach(n => {
      let chips = playersData[n].chips;
      if (winners.includes(n)) {
        chips += winAmount;
        recordWin(roomId, n, 'poker');
      }
      updates[`players/${n}/chips`] = chips;
    });

    await safeUpdate(updates);
  };

  const myData = playersData[userNickname] || {};
  const isMyTurn = currentTurn === userNickname;
  const toCall = currentBet - (myData.currentRoundBet || 0);

  useEffect(() => {
    setRaiseAmount(toCall + 10);
  }, [toCall]);

  // Rendering
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
        <div className="text-6xl drop-shadow-xl animate-bounce-slow">💵</div>
        <h2 className="text-3xl font-black text-emerald-800 tracking-tight">โป๊กเกอร์ (Texas Hold'em)</h2>
        <p className="text-emerald-600 font-medium">เดิมพันด้วยชิป ชิงไหวชิงพริบ ลักไก่ให้สุด!</p>

        {isHost ? (
          <div className="flex gap-2 w-full max-w-[280px]">
            <button className="btn btn-primary flex-1 py-4 text-lg font-bold shadow-xl shadow-primary/30" onClick={startGame}>
              แจกไพ่ เริ่มตาใหม่!
            </button>
            <button className="btn bg-stone-100 border border-stone-300 px-4 shadow-sm" onClick={() => setShowSettings(true)}>
              ⚙️
            </button>
          </div>
        ) : (
          <div className="card w-full max-w-[280px] p-xl bg-emerald-50/50 border-2 border-emerald-100 flex-center">
            <span className="font-bold text-emerald-500 animate-pulse">รอ Host เริ่มตาใหม่...</span>
          </div>
        )}

        <div className="mt-md flex flex-wrap justify-center gap-sm max-w-sm">
          {Object.entries(playersData).map(([name, p]) => (
            <div key={name} className="bg-white px-3 py-1.5 rounded-full shadow-sm text-sm border border-stone-200">
              <span className="font-bold">{name}</span>: <span className="text-emerald-600">💰 {p.chips || STARTING_CHIPS}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 pb-24 relative max-w-2xl mx-auto w-full animate-fade-in bg-stone-50">
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      {errorMsg && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-xl z-50 text-sm font-bold shadow-lg">{errorMsg}</div>}

      {/* Opponents Area */}
      <div className="flex gap-sm p-sm overflow-x-auto snap-x">
        {Object.entries(playersData).filter(([name]) => name !== userNickname).map(([name, p]) => (
          <div key={name} className={`flex-shrink-0 card p-sm min-w-[100px] text-center snap-center border-2 transition-all ${currentTurn === name ? 'border-primary shadow-md bg-white' : 'border-stone-200 bg-stone-100'} ${p.folded ? 'opacity-50' : ''}`}>
            <p className="text-[11px] font-bold text-stone-700 truncate">{name}</p>
            <p className="text-[10px] text-emerald-600 font-bold mb-xs">💰 {p.chips}</p>
            <div className="flex-center -space-x-4">
              {phase === 'showdown' && !p.folded ? (
                p.hand?.map((card, idx) => (
                  <div key={idx} style={{ transform: 'scale(0.5)', margin: '-16px' }}><PlayingCard card={card} animated={false} /></div>
                ))
              ) : (
                <>
                  <div style={{ transform: 'scale(0.5)', margin: '-16px' }}><PlayingCard hidden animated={false} /></div>
                  <div style={{ transform: 'scale(0.5)', margin: '-16px' }}><PlayingCard hidden animated={false} /></div>
                </>
              )}
            </div>
            <div className="mt-xs text-[9px] font-bold text-stone-500 uppercase">
              {p.folded ? 'Folded' : p.currentRoundBet > 0 ? `Bet: ${p.currentRoundBet}` : 'Waiting'}
            </div>
          </div>
        ))}
      </div>

      {/* Table / Community Cards */}
      <div className="flex-1 flex-center flex-col relative p-md">
        <div className="bg-emerald-800/10 border border-emerald-800/20 rounded-3xl p-md sm:p-lg w-full max-w-lg shadow-inner flex flex-col items-center">
          <div className="bg-white/80 px-4 py-1.5 rounded-full shadow-sm mb-md flex items-center gap-2">
            <span className="text-xs font-bold text-stone-500 uppercase">Pot</span>
            <span className="text-lg font-black text-emerald-600">💰 {pot}</span>
          </div>

          <div className="flex-center gap-xs sm:gap-sm h-[100px] sm:h-[120px]">
            <AnimatePresence>
              {communityCards.map((card, idx) => (
                <PlayingCard key={card.id || idx} card={card} className="w-14 h-20 sm:w-16 sm:h-24" />
              ))}
              {/* Placeholders for unrevealed cards */}
              {[...Array(5 - communityCards.length)].map((_, i) => (
                <div key={`empty-${i}`} className="w-14 h-20 sm:w-16 sm:h-24 border-2 border-dashed border-emerald-800/20 rounded-xl"></div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Showdown Board */}
      {phase === 'showdown' && (
        <div className="absolute inset-0 z-40 bg-stone-900/80 flex-center flex-col p-lg backdrop-blur-sm">
          <h2 className="text-4xl font-black text-white mb-lg animate-bounce-slow">SHOWDOWN!</h2>
          <div className="card p-md w-full max-w-md bg-white space-y-sm">
            {Object.entries(playersData).filter(([, p]) => !p.folded).map(([name, p]) => {
              const ev = evaluatePokerHand(p.hand, communityCards);
              const isWinner = gameData.winners?.includes(name);
              return (
                <div key={name} className={`flex justify-between items-center p-sm border-b border-stone-100 last:border-0 ${isWinner ? 'bg-success/10 rounded-lg' : ''}`}>
                  <div>
                    <span className="font-bold text-sm block">{name} {isWinner && '🏆'}</span>
                    <span className="text-xs text-primary font-bold uppercase">{ev.name}</span>
                  </div>
                  <div className="flex -space-x-3">
                    {p.hand.map((c, i) => <div key={i} style={{ transform: 'scale(0.4)', margin: '-24px' }}><PlayingCard card={c} animated={false} /></div>)}
                  </div>
                </div>
              );
            })}
          </div>
          {isHost && !gameData.winners && (
            <button className="btn btn-primary mt-lg py-4 px-8 text-lg font-black shadow-xl" onClick={resolveShowdown}>
              แบ่งเงินรางวัล
            </button>
          )}
          {isHost && gameData.winners && (
            <button className="btn btn-primary mt-lg py-4 px-8 text-lg font-black shadow-xl" onClick={startGame}>
              เริ่มตาใหม่
            </button>
          )}
          {!isHost && gameData.winners && (
            <p className="text-white/70 mt-lg font-bold">รอ Host เริ่มตาถัดไป...</p>
          )}
        </div>
      )}

      {/* My Hand & Controls */}
      <div className={`mt-auto bg-white border-t-4 transition-colors p-md pb-6 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] ${isMyTurn ? 'border-primary bg-primary/5' : 'border-stone-200'}`}>
        <div className="flex justify-between items-center mb-md">
          <div>
            <h3 className="font-black text-lg leading-none">ไพ่ของคุณ</h3>
            <p className="text-xs text-stone-500 font-bold">{userNickname} • 💰 {myData.chips}</p>
          </div>
          {myData.folded && <div className="px-3 py-1 bg-danger/10 text-danger rounded-full text-xs font-bold uppercase">Folded</div>}
        </div>

        <div className="flex justify-center gap-sm mb-md relative h-28">
          {myData.hand?.map((card, idx) => (
             <div key={idx} className={myData.folded ? 'opacity-50 grayscale' : 'hover:-translate-y-2 transition-transform'}><PlayingCard card={card} /></div>
          ))}
          {/* Hand Evaluator */}
          {!myData.folded && communityCards.length >= 3 && (
            <div className="absolute -bottom-4 bg-stone-800 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-md z-20">
              {evaluatePokerHand(myData.hand, communityCards).name}
            </div>
          )}
        </div>

        {/* Controls */}
        {phase !== 'showdown' && !myData.folded && isMyTurn ? (
          <div className="space-y-sm">
            <div className="flex gap-sm">
              <button className="btn btn-outline flex-1 text-danger border-danger/30 hover:bg-danger/10 font-bold" onClick={() => handleAction('fold')}>
                หมอบ (FOLD)
              </button>
              <button className="btn btn-primary flex-1 font-bold shadow-md" onClick={() => handleAction('call')}>
                {toCall > 0 ? (toCall >= myData.chips ? `เทหมดหน้าตัก (ALL-IN ${myData.chips})` : `ตาม (CALL ${toCall})`) : 'ผ่าน (CHECK)'}
              </button>
            </div>
            {toCall < myData.chips && (
              <div className="flex gap-sm items-center bg-stone-100 p-2 rounded-xl">
                <input 
                  type="range" 
                  min={toCall + 10} 
                  max={myData.chips} 
                  step={10} 
                  value={raiseAmount} 
                  onChange={(e) => setRaiseAmount(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <button 
                  className="btn bg-stone-800 text-white font-bold py-2 px-4 shadow-md" 
                  onClick={() => handleAction('raise', raiseAmount - toCall)}
                  disabled={raiseAmount > myData.chips || raiseAmount < toCall + 10}
                >
                  เกทับ (RAISE {raiseAmount})
                </button>
              </div>
            )}
          </div>
        ) : phase !== 'showdown' && (
          <div className="text-center text-stone-400 font-bold text-sm h-12 flex-center">
            {myData.folded ? 'คุณหมอบไปแล้ว รอรอบถัดไป...' : `กำลังรอ ${currentTurn} เล่น...`}
          </div>
        )}
      </div>
    </div>
  );
};

export default Poker;

import React, { useState, useEffect, useRef } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '@/firebase';
import { useGameLeave } from '@/hooks';
import { useGame } from '@/contexts/GameContext';
import { useGameUpdate } from '@/hooks';
import { useTranslation } from 'react-i18next';
import { PlayingCard } from '@/components/ui';
import { createDeck, shuffleDeck } from '@/utils/cards';
import { evaluatePokerHand } from './pokerEvaluator';
import { LeaveConfirmModal } from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { recordWin } from '@/components/features';
import { NeonCard } from '@/components/ui';
import { GiantButton } from '@/components/ui';
import { SwipeableHand } from '../../components/ui/SwipeableHand';

const STARTING_CHIPS = 1000;

const Poker: React.FC = () => {
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);
  const { t } = useTranslation();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);

    const [raiseAmount, setRaiseAmount] = useState(10);
  const [localSettings] = useState({ startingChips: 1000 });
  const advancingRef = useRef(false);

  const gameData = roomData?.gameData || {};

  if (!roomData) return null;

  // Derived variables
  const phase = gameData.phase || 'waiting'; // waiting, pre-flop, flop, turn, river, showdown
  const deck = gameData.deck || [];
  const communityCards = gameData.communityCards || [];
  const pot = gameData.pot || 0;
  const currentBet = gameData.currentBet || 0;
  const playersData = gameData.players || {};
  const currentTurn = gameData.currentTurn || null;
  const activePlayers = Object.keys(playersData).filter(p => !playersData[p].folded && (playersData[p].chips > 0 || playersData[p].currentRoundBet > 0));
  const playerNames = Object.keys(roomData?.players || {});
  const myData = playersData[userNickname!] || { hand: [], chips: 0, currentRoundBet: 0 };
  const callAmount = currentBet - myData.currentRoundBet;

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
    
    // First time init chips
    const playersInit: Record<string, any> = {};
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

  const getNextTurn = (current: string, currentPlayers: Record<string, any>) => {
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

  const advancePhase = async (updates: Record<string, any>, currentPlayers: Record<string, any>) => {
    const active = Object.values(currentPlayers).filter((p: any) => !p.folded);
    const activeNonAllIn = active.filter((p: any) => p.chips > 0);
    
    if (active.length <= 1 || activeNonAllIn.length <= 1) {
      // Refund unmatched bets for the lone non-all-in player
      if (activeNonAllIn.length === 1 && active.length > 1) {
        const lonePlayer: any = activeNonAllIn[0];
        const lonePlayerName = Object.keys(currentPlayers).find(n => currentPlayers[n] === lonePlayer);
        const otherActive = active.filter(p => p !== lonePlayer);
        const maxOtherBet = Math.max(...otherActive.map((p: any) => p.currentRoundBet));
        
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
    });
    updates.currentBet = 0;

    const newDeck = updates.deck || [...deck];
    const newCommunity = updates.communityCards || [...communityCards];

    switch (phase) {
      case 'pre-flop':
        updates.phase = 'flop';
        updates.communityCards = [newDeck.pop(), newDeck.pop(), newDeck.pop()];
        break;
      case 'flop':
        updates.phase = 'turn';
        updates.communityCards = [...newCommunity, newDeck.pop()];
        break;
      case 'turn':
        updates.phase = 'river';
        updates.communityCards = [...newCommunity, newDeck.pop()];
        break;
      case 'river':
        updates.phase = 'showdown';
        break;
    }
    updates.deck = newDeck;
    return updates;
  };

  const handleAction = async (type: 'fold' | 'call' | 'raise') => {
    if (currentTurn !== userNickname) return;
    if (advancingRef.current) return;
    advancingRef.current = true;

    const myDataLocal = playersData[userNickname!];
    const updates: Record<string, any> = {};
    const newPlayersData = JSON.parse(JSON.stringify(playersData));

    if (type === 'fold') {
      newPlayersData[userNickname!].folded = true;
    } else if (type === 'call') {
      const amountToCall = currentBet - myDataLocal.currentRoundBet;
      const callAmountLocal = Math.min(myDataLocal.chips, amountToCall);
      newPlayersData[userNickname!].chips -= callAmountLocal;
      newPlayersData[userNickname!].currentRoundBet += callAmountLocal;
      newPlayersData[userNickname!].totalBet += callAmountLocal;
      updates.pot = pot + callAmountLocal;
      newPlayersData[userNickname!].hasActed = true;
    } else if (type === 'raise') {
      const totalRaise = (currentBet - myDataLocal.currentRoundBet) + raiseAmount;
      const actualRaise = Math.min(myDataLocal.chips, totalRaise);
      newPlayersData[userNickname!].chips -= actualRaise;
      newPlayersData[userNickname!].currentRoundBet += actualRaise;
      newPlayersData[userNickname!].totalBet += actualRaise;
      updates.pot = pot + actualRaise;
      updates.currentBet = newPlayersData[userNickname!].currentRoundBet;
      
      // When raising, everyone else needs to act again
      Object.keys(newPlayersData).forEach(n => {
        if (n !== userNickname) newPlayersData[n].hasActed = false;
      });
      newPlayersData[userNickname!].hasActed = true;
    }

    updates.players = newPlayersData;
    
    // Check if round is over
    const active = Object.values(newPlayersData).filter((p: any) => !p.folded);
    const activeNonAllIn = active.filter((p: any) => p.chips > 0);
    const roundComplete = active.length <= 1 || (activeNonAllIn.every((p: any) => p.hasActed && p.currentRoundBet === (updates.currentBet || currentBet)));

    if (roundComplete) {
      await advancePhase(updates, newPlayersData);
      updates.currentTurn = activeNonAllIn.length > 0 ? getNextTurn(userNickname!, newPlayersData) : null;
    } else {
      updates.currentTurn = getNextTurn(userNickname!, newPlayersData);
    }

    await safeUpdate(updates);
    advancingRef.current = false;
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await update(ref(db, `rooms/${roomId}`), { status: 'waiting', currentGame: null, gameData: null });
  };

  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in bg-slate-950 text-slate-200">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-6xl animate-bounce-soft drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">🃏</div>
        <div className="text-center">
          <h2 className="font-black text-[24px] uppercase tracking-widest text-slate-300 mb-1 drop-shadow-md">
             <span className="text-emerald-500">♠️ Texas</span> Hold'em
          </h2>
          <p className="text-slate-400 text-[11px] font-bold mt-2">ใครจะเป็นเจ้าของ Pot ทั้งหมด?</p>
        </div>
        {isHost ? (
          <GiantButton color="emerald" onClick={startGame} className="mt-8 px-10">
            เริ่มเกมเลย!
          </GiantButton>
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
         <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-400">
          <span className="text-emerald-500">♠️ Texas</span> Hold'em
        </h2>
        <button onClick={requestLeave} className="text-[10px] font-black uppercase tracking-widest text-red-500 px-3 py-1.5 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-all">
          ออก
        </button>
      </div>

      {/* Community Cards Area */}
      <NeonCard color="emerald" className="mx-4 flex flex-col items-center gap-3 py-6 bg-emerald-900/10 mb-4 min-h-[140px] border-emerald-500/30">
        <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center gap-1.5 bg-amber-500/20 px-4 py-1.5 rounded-full border border-amber-500/50">
                <span className="text-[14px] font-black text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">POT: {pot}</span>
            </div>
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{phase}</span>
        </div>
        <div className="flex-center gap-2 min-h-[120px] w-full">
           <SwipeableHand cards={communityCards || []} fanAngle={0} cardClassName="scale-90" />
           {Array.from({ length: Math.max(0, 5 - (communityCards?.length || 0)) }).map((_, i) => (
            <div key={i} className="w-16 h-24 rounded-lg bg-slate-900/50 border-2 border-slate-700 border-dashed flex-center text-slate-600 scale-90">
                ?
            </div>
          ))}
        </div>
      </NeonCard>

      {/* Players Area */}
      <div className="flex gap-2 overflow-x-auto pb-4 px-4 hide-scrollbar">
        {playerNames.map(name => {
          const data = playersData[name];
          const isTurn = currentTurn === name;
          return (
            <div key={name} className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all shrink-0 min-w-[90px] ${isTurn ? 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-900 border-slate-800'} ${data.folded ? 'opacity-40 grayscale' : ''}`}>
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex-center text-lg shadow-sm border border-slate-700">
                  {roomData.players[name]?.avatar || '👤'}
                </div>
                {isTurn && <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse shadow-[0_0_10px_rgba(16,185,129,1)]" />}
              </div>
              <span className={`text-[11px] font-bold truncate max-w-[75px] ${isTurn ? 'text-emerald-400' : 'text-slate-400'}`}>{name}</span>
              <span className="text-[11px] font-black text-amber-500">{data.chips} 🪙</span>
              {data.currentRoundBet > 0 && <span className="text-[10px] font-bold text-slate-300">Bet: <span className="text-emerald-400">{data.currentRoundBet}</span></span>}
              {data.folded && <span className="text-[9px] font-black text-red-500 uppercase">FOLD</span>}
            </div>
          );
        })}
      </div>

      {/* Hand & Actions */}
      <div className="mt-auto bg-slate-900 rounded-t-[40px] p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] border-t border-slate-800 pb-8 relative z-10">
        <div className="flex-between mb-4">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ไพ่ของคุณ</span>
            <div className="flex items-center gap-2">
                <span className="text-[12px] font-black text-amber-500">{myData.chips} 🪙</span>
                {phase === 'showdown' && !myData.folded && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-lg border border-emerald-500/50">
                        {evaluatePokerHand(myData.hand, communityCards).handName}
                    </span>
                )}
            </div>
        </div>

        <div className="mb-8 -mt-4">
           <SwipeableHand cards={myData.hand || []} />
          {(!myData.hand || myData.hand.length === 0) && <div className="text-slate-600 font-bold uppercase tracking-widest text-[11px] text-center mt-8">ยังไม่มีไพ่</div>}
        </div>

        {currentTurn === userNickname && phase !== 'showdown' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => handleAction('fold')} className="flex-1 py-3 text-[12px] font-black uppercase tracking-widest rounded-xl border border-red-500/50 bg-red-500/10 text-red-500 active:scale-95 transition-all">FOLD</button>
              <button onClick={() => handleAction('call')} className="flex-1 py-3 text-[12px] font-black uppercase tracking-widest rounded-xl border border-blue-500/50 bg-blue-500/10 text-blue-400 active:scale-95 transition-all">
                {callAmount === 0 ? 'CHECK' : `CALL ${callAmount}`}
              </button>
              <button 
                onClick={() => handleAction('raise')} 
                disabled={myData.chips < (callAmount + raiseAmount)}
                className="flex-1 py-3 text-[12px] font-black uppercase tracking-widest rounded-xl border border-emerald-500 bg-emerald-500 text-slate-900 shadow-[0_0_15px_rgba(16,185,129,0.5)] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
              >
                RAISE
              </button>
            </div>
            
            {myData.chips > callAmount && (
                <div className="flex items-center gap-3 px-2 mt-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RAISE: <span className="text-emerald-400">{raiseAmount}</span></span>
                    <input 
                        type="range" min="10" max={myData.chips - callAmount} step="10" 
                        value={raiseAmount} onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
                        className="flex-1 accent-emerald-500 h-1.5 bg-slate-800 rounded-full appearance-none"
                    />
                </div>
            )}
          </div>
        )}

        {phase === 'showdown' && isHost && (
            <GiantButton color="emerald" onClick={startGame} className="w-full mt-4">
                เริ่มตาถัดไป
            </GiantButton>
        )}
      </div>
    </div>
  );
};

export default Poker;

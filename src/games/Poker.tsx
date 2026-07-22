import React, { useState, useEffect, useRef } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGame } from '../contexts/GameContext';
import { useTranslation } from 'react-i18next';
import PlayingCard from '../components/PlayingCard';
import { createDeck, shuffleDeck } from './logic/cards';
import { evaluatePokerHand } from './logic/pokerEvaluator';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { recordWin } from '../components/Scoreboard';

const STARTING_CHIPS = 1000;

const Poker: React.FC = () => {
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { t } = useTranslation();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);

  const [errorMsg, setErrorMsg] = useState('');
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
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-6xl animate-bounce-soft">💵</div>
        <div className="text-center">
          <h2 className="font-display font-bold text-[22px] text-olive-800 mb-1">{t('poker.title') || 'Poker (Texas Hold\'em)'}</h2>
          <p className="text-olive-400 text-[13px]">{t('poker.description') || 'สู้ด้วยไพ่และจิตวิทยา! ใครจะเป็นเจ้าของ Pot ทั้งหมด?'}</p>
        </div>
        {isHost ? (
          <button onClick={startGame} className="btn btn-primary px-10 py-4 rounded-3xl text-lg shadow-lg">
            {t('poker.startGame') || 'เริ่มเกมเลย!'}
          </button>
        ) : (
          <p className="text-olive-400 font-bold animate-pulse">{t('poker.waitingHost') || 'รอ Host เริ่มเกม...'}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col py-2 animate-fade-in relative h-full">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}

      {/* Community Cards Area */}
      <div className="flex flex-col items-center gap-3 py-6 bg-olive-50/30 rounded-3xl mb-4 min-h-[140px] border-2 border-dashed border-olive-100">
        <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center gap-1.5 bg-amber-100 px-3 py-1 rounded-full">
                <span className="text-[12px] font-black text-amber-700">POT: {pot}</span>
            </div>
            <span className="text-[10px] font-bold text-olive-400 uppercase tracking-widest">{phase}</span>
        </div>
        <div className="flex gap-1 justify-center flex-wrap">
          {communityCards.map((c: any, i: number) => (
            <PlayingCard key={i} card={c} size="xs" />
          ))}
          {Array.from({ length: 5 - communityCards.length }).map((_, i) => (
            <div key={i} className="w-12 h-16 rounded-lg bg-olive-100/50 border-2 border-white border-dashed flex-center text-olive-200">
                ?
            </div>
          ))}
        </div>
      </div>

      {/* Players Area */}
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
        {playerNames.map(name => {
          const data = playersData[name];
          const isTurn = currentTurn === name;
          return (
            <div key={name} className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all shrink-0 min-w-[85px] ${isTurn ? 'bg-white border-sage-400 shadow-sm' : 'bg-white/50 border-olive-50'} ${data.folded ? 'opacity-40 grayscale' : ''}`}>
              <div className="relative">
                <div className="w-8 h-8 rounded-xl bg-olive-100 flex-center text-sm shadow-sm">
                  {roomData.players[name]?.avatar || '👤'}
                </div>
                {isTurn && <div className="absolute -top-1 -right-1 w-3 h-3 bg-sage-500 rounded-full border-2 border-white animate-pulse" />}
              </div>
              <span className={`text-[10px] font-bold truncate max-w-[75px] ${isTurn ? 'text-sage-700' : 'text-olive-400'}`}>{name}</span>
              <span className="text-[10px] font-black text-amber-600">{data.chips}</span>
              {data.currentRoundBet > 0 && <span className="text-[9px] font-bold text-olive-400">Bet: {data.currentRoundBet}</span>}
              {data.folded && <span className="text-[9px] font-black text-red-400 uppercase">FOLD</span>}
            </div>
          );
        })}
      </div>

      {/* Hand & Actions */}
      <div className="mt-auto bg-white rounded-t-[40px] p-6 shadow-2xl border-t-2 border-olive-50 -mx-4 pb-8">
        <div className="flex-between mb-4">
            <span className="text-[12px] font-black text-olive-800 uppercase tracking-widest">{t('poker.yourHand') || 'ไพ่ของคุณ'}</span>
            <div className="flex items-center gap-2">
                <span className="text-[12px] font-black text-amber-600">{myData.chips} 🪙</span>
                {phase === 'showdown' && !myData.folded && (
                    <span className="text-[10px] font-bold text-sage-600 bg-sage-50 px-2 py-0.5 rounded-lg border border-sage-100">
                        {evaluatePokerHand(myData.hand, communityCards).handName}
                    </span>
                )}
            </div>
        </div>

        <div className="flex-center gap-3 mb-8">
          {(myData.hand || []).map((card: any, i: number) => (
            <PlayingCard key={i} card={card} size="sm" />
          ))}
          {myData.hand?.length === 0 && <div className="text-olive-200 italic text-sm">{t('poker.noHand') || 'ยังไม่มีไพ่'}</div>}
        </div>

        {currentTurn === userNickname && phase !== 'showdown' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => handleAction('fold')} className="btn btn-outline flex-1 py-3 text-[13px] border-red-200 text-red-500">{t('poker.fold') || 'FOLD'}</button>
              <button onClick={() => handleAction('call')} className="btn btn-outline flex-1 py-3 text-[13px] border-blue-200 text-blue-600">
                {callAmount === 0 ? (t('poker.check') || 'CHECK') : `${t('poker.call') || 'CALL'} ${callAmount}`}
              </button>
              <button 
                onClick={() => handleAction('raise')} 
                disabled={myData.chips < (callAmount + raiseAmount)}
                className="btn btn-primary flex-1 py-3 text-[13px]"
              >
                {t('poker.raise') || 'RAISE'}
              </button>
            </div>
            
            {myData.chips > callAmount && (
                <div className="flex items-center gap-3 px-2">
                    <span className="text-[11px] font-black text-olive-400">RAISE: {raiseAmount}</span>
                    <input 
                        type="range" min="10" max={myData.chips - callAmount} step="10" 
                        value={raiseAmount} onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
                        className="flex-1 accent-sage-500 h-1.5 bg-olive-50 rounded-full appearance-none"
                    />
                </div>
            )}
          </div>
        )}

        {phase === 'showdown' && isHost && (
            <button onClick={startGame} className="btn btn-primary w-full py-4 text-[16px] rounded-2xl shadow-lg shadow-sage-200 mt-2">
                {t('poker.nextHand') || 'เริ่มตาถัดไป'}
            </button>
        )}
      </div>

      {isHost && (
        <div className="mt-4 flex-center">
          <button onClick={handleBackToLobby} className="flex items-center gap-2 text-[12px] font-bold text-olive-300 hover:text-olive-500 transition-colors">
            <RotateCcw size={14} /> {t('common.backToLobby') || 'กลับ Lobby'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Poker;

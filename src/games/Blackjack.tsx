import React, { useState, useEffect, useRef } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGame } from '../contexts/GameContext';
import { useTranslation } from 'react-i18next';
import PlayingCard from '../components/PlayingCard';
import { createDeck, shuffleDeck, calculateBlackjackScore } from './logic/cards';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { recordWin } from '../components/Scoreboard';

const Blackjack: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  
  const gameData = roomData.gameData || {};
  const phase = gameData.phase || 'waiting'; // waiting, playing, dealerTurn, result
  const deck = gameData.deck || [];
  const dealer = gameData.dealer || { hand: [] };
  const playersData = gameData.players || {};
  const currentTurn = gameData.currentTurn || null;
  const [errorMsg, setErrorMsg] = useState('');
  const advancingRef = useRef(false);

  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const playerNames = Object.keys(roomData.players || {});

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
    const dealerInit = { hand: [newDeck.pop(), newDeck.pop()] };

    const activePlayers = playerNames.filter(name => name !== roomData.host);
    activePlayers.forEach(name => {
      const hand = [newDeck.pop(), newDeck.pop()];
      const score = calculateBlackjackScore(hand);
      playersInit[name] = {
        hand,
        status: score === 21 ? 'stand' : 'playing', // playing, stand, bust
      };
    });

    if (activePlayers.length === 0) {
      setErrorMsg(t('blackjack.minPlayers') || 'ต้องมีผู้เล่นอื่นอย่างน้อย 1 คน');
      return;
    }

    // Determine the first playing turn
    let startingTurn = null;
    let initialPhase = 'playing';
    for (const name of activePlayers) {
        if (playersInit[name].status === 'playing') {
            startingTurn = name;
            break;
        }
    }
    
    if (!startingTurn) {
        initialPhase = 'dealerTurn';
    }

    await safeUpdate({
      phase: initialPhase,
      deck: newDeck,
      dealer: dealerInit,
      players: playersInit,
      currentTurn: startingTurn,
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
      nextTurn = getNextTurn(currentTurn);
    } else if (score === 21) {
      nextStatus = 'stand';
      nextTurn = getNextTurn(currentTurn);
    }

    const updates: Record<string, any> = {
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
    const updates: Record<string, any> = {
      [`players/${userNickname}/status`]: 'stand',
      currentTurn: nextTurn,
    };

    if (!nextTurn) {
      updates.phase = 'dealerTurn';
    }

    await safeUpdate(updates);
  };

  const getNextTurn = (current: string | null) => {
    const names = Object.keys(playersData);
    const idx = current ? names.indexOf(current) : -1;
    for (let i = idx + 1; i < names.length; i++) {
      if (playersData[names[i]]?.status === 'playing') return names[i];
    }
    return null;
  };

  // Dealer Auto Play
  useEffect(() => {
    if (!isHost || phase !== 'dealerTurn') return;
    if (advancingRef.current) return;
    advancingRef.current = true;

    const playDealer = async () => {
      const currentHand = [...(dealer.hand || [])];
      const currentDeck = [...deck];
      
      let score = calculateBlackjackScore(currentHand);
      while (score < 17 && currentDeck.length > 0) {
        const card = currentDeck.pop();
        currentHand.push(card);
        score = calculateBlackjackScore(currentHand);
      }

      await new Promise(r => setTimeout(r, 1500));
      
      await safeUpdate({
        phase: 'result',
        deck: currentDeck,
        dealer: { hand: currentHand },
      });
      advancingRef.current = false;
    };

    playDealer();
  }, [phase, isHost]);

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await update(ref(db, `rooms/${roomId}`), { status: 'waiting', currentGame: null, gameData: null });
  };

  const renderErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl animate-fade-in">
      {errorMsg}
    </div>
  ) : null;

  if (!roomData) return null;

  const dealerScore = calculateBlackjackScore(dealer.hand || []);

  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-6xl animate-bounce-soft">🃏</div>
        <div className="text-center">
          <h2 className="font-display font-bold text-[22px] text-olive-800 mb-1">{t('blackjack.title') || 'Blackjack'}</h2>
          <p className="text-olive-400 text-[13px]">{t('blackjack.description') || 'สู้กับ Dealer! ใครแต้มใกล้ 21 ที่สุดชนะ (แต่ห้ามเกิน 21)'}</p>
        </div>
        {isHost ? (
          <button onClick={startGame} className="btn btn-primary px-10 py-4 rounded-3xl text-lg shadow-lg">
            {t('blackjack.startGame') || 'เริ่มแจกไพ่!'}
          </button>
        ) : (
          <p className="text-olive-400 font-bold animate-pulse">{t('blackjack.waitingHost') || 'รอ Host เริ่มเกม...'}</p>
        )}
      </div>
    );
  }


  return (
    <div className="flex-1 flex flex-col py-2 animate-fade-in relative">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}

      {/* Dealer Area */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-olive-400 uppercase tracking-widest">{t('blackjack.dealer') || 'DEALER'}</span>
            {phase === 'result' && (
                <span className={`text-[12px] font-black px-2 py-0.5 rounded-lg ${dealerScore > 21 ? 'bg-red-100 text-red-600' : 'bg-olive-100 text-olive-700'}`}>
                    {dealerScore}
                </span>
            )}
        </div>
        <div className="flex gap-[-20px]">
          {(dealer.hand || []).map((card: any, i: number) => (
            <div key={i} className={i > 0 ? '-ml-12' : ''}>
              <PlayingCard card={card} hidden={phase === 'playing' && i === 1} size="sm" />
            </div>
          ))}
        </div>
      </div>

      {/* Players Area */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-24 custom-scrollbar">
        {Object.entries(playersData).map(([name, data]: [string, any]) => {
          const score = calculateBlackjackScore(data.hand || []);
          const isMyArea = name === userNickname;
          const isHisTurn = currentTurn === name;
          const isBust = data.status === 'bust' || score > 21;

          return (
            <div key={name} className={`card p-4 mx-1 transition-all ${isHisTurn ? 'border-sage-400 shadow-md ring-2 ring-sage-100' : 'border-olive-50'}`}>
              <div className="flex-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-olive-100 flex-center text-xs border border-white shadow-sm">
                    {roomData.players[name]?.avatar || '👤'}
                  </div>
                  <span className={`font-bold text-[13px] ${isMyArea ? 'text-sage-600' : 'text-olive-700'}`}>
                    {name === userNickname ? t('common.you') || 'คุณ' : name}
                  </span>
                  {isHisTurn && <span className="text-[9px] font-black bg-sage-500 text-white px-1.5 py-0.5 rounded-full animate-pulse uppercase">Turn</span>}
                </div>
                <div className="flex items-center gap-2">
                    {isBust ? (
                        <span className="text-[10px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-lg uppercase">BUST</span>
                    ) : data.status === 'stand' ? (
                        <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-lg uppercase">STAND</span>
                    ) : null}
                    <span className={`text-[12px] font-black ${isBust ? 'text-red-500' : 'text-olive-700'}`}>{score}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-[-10px]">
                {(data.hand || []).map((card: any, i: number) => (
                  <div key={i} className={i > 0 ? '-ml-8' : ''}>
                    <PlayingCard card={card} size="sm" />
                  </div>
                ))}
              </div>
              
              {isMyArea && isHisTurn && phase === 'playing' && (
                <div className="flex gap-3 mt-4">
                  <button onClick={handleHit} className="btn btn-primary flex-1 py-3 text-[14px]">HIT</button>
                  <button onClick={handleStand} className="btn btn-outline flex-1 py-3 text-[14px]">STAND</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Result Layer */}
      {phase === 'result' && (
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute bottom-16 left-0 w-full p-4 z-10">
          <div className="card p-6 border-2 border-sage-300 shadow-2xl bg-white/95 backdrop-blur-md">
            <h3 className="text-center font-black text-lg text-olive-800 mb-4">{t('blackjack.roundOver') || 'จบตา! ผลการเล่น'}</h3>
            <div className="space-y-2 mb-6">
                {Object.entries(playersData).map(([name, data]: [string, any]) => {
                    let result = 'LOSE';
                    let color = 'text-red-400';
                    
                    if (score > 21) { result = 'BUST'; color = 'text-red-500'; }
                    else if (dealerScore > 21 || score > dealerScore) { result = 'WIN! 🏆'; color = 'text-green-600'; }
                    else if (score === dealerScore) { result = 'PUSH'; color = 'text-blue-500'; }

                    return (
                        <div key={name} className="flex-between text-[13px] font-bold">
                            <span className="text-olive-700">{name}</span>
                            <span className={color}>{result}</span>
                        </div>
                    );
                })}
            </div>
            {isHost && (
              <div className="flex gap-3">
                <button onClick={startGame} className="btn btn-primary flex-1 py-3 text-[14px]">{t('common.playAgain') || 'เล่นอีกรอบ'}</button>
                <button onClick={handleBackToLobby} className="btn btn-outline flex-1 py-3 text-[14px]">{t('common.backToLobby') || 'Lobby'}</button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Blackjack;

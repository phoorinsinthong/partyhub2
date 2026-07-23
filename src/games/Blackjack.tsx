// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGame } from '../contexts/GameContext';
import { useGameUpdate } from '../hooks/useGameUpdate';
import { useTranslation } from 'react-i18next';
import PlayingCard from '../components/PlayingCard';
import { createDeck, shuffleDeck, calculateBlackjackScore } from './logic/cards';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { recordWin } from '../components/Scoreboard';
import NeonCard from '../components/NeonCard';
import GiantButton from '../components/GiantButton';

const Blackjack: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);
  
  const gameData = roomData.gameData || {};
  const phase = gameData.phase || 'waiting'; // waiting, playing, dealerTurn, result
  const deck = gameData.deck || [];
  const dealer = gameData.dealer || { hand: [] };
  const playersData = gameData.players || {};
  const currentTurn = gameData.currentTurn || null;
    const advancingRef = useRef(false);

  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const playerNames = Object.keys(roomData.players || {});

  
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
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border border-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-fade-in">
      {errorMsg}
    </div>
  ) : null;

  if (!roomData) return null;

  const dealerScore = calculateBlackjackScore(dealer.hand || []);

  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in bg-slate-950 text-slate-200">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <motion.div
          className="text-8xl drop-shadow-[0_0_20px_rgba(56,189,248,0.5)]"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          🃏
        </motion.div>
        <div className="text-center px-4">
          <h2 className="font-black text-[32px] uppercase tracking-widest text-white mb-2 drop-shadow-md">{t('blackjack.title') || 'Blackjack'}</h2>
          <p className="text-slate-400 text-[12px] font-bold leading-relaxed max-w-xs mx-auto">{t('blackjack.description') || 'สู้กับ Dealer! ใครแต้มใกล้ 21 ที่สุดชนะ (แต่ห้ามเกิน 21)'}</p>
        </div>
        {isHost ? (
          <GiantButton color="sky" onClick={startGame} className="px-12 w-full max-w-xs mt-4">
            {t('blackjack.startGame') || 'เริ่มแจกไพ่!'}
          </GiantButton>
        ) : (
          <div className="flex flex-col items-center gap-4 mt-8">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-sky-500 rounded-full animate-spin shadow-[0_0_15px_rgba(56,189,248,0.5)]" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 animate-pulse">{t('blackjack.waitingHost') || 'รอ Host เริ่มเกม...'}</span>
          </div>
        )}
      </div>
    );
  }


  return (
    <div className="flex-1 flex flex-col py-2 animate-fade-in relative bg-slate-950 text-slate-200">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}

      {/* Dealer Area */}
      <div className="flex flex-col items-center gap-2 mb-8 mt-4">
        <div className="flex items-center gap-2">
            <span className="text-[12px] font-black text-sky-400 uppercase tracking-widest bg-sky-500/10 border border-sky-500/30 px-3 py-1 rounded-lg shadow-[0_0_10px_rgba(56,189,248,0.2)]">{t('blackjack.dealer') || 'DEALER'}</span>
            {phase === 'result' && (
                <span className={`text-[12px] font-black px-3 py-1 rounded-lg border uppercase tracking-widest ${dealerScore > 21 ? 'bg-red-950/50 text-red-500 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-slate-900 text-slate-300 border-slate-700'}`}>
                    {dealerScore}
                </span>
            )}
        </div>
        <div className="flex gap-[-20px] mt-2 scale-110">
          {(dealer.hand || []).map((card: any, i: number) => (
            <div key={i} className={i > 0 ? '-ml-12' : ''}>
              <PlayingCard card={card} hidden={phase === 'playing' && i === 1} size="sm" />
            </div>
          ))}
        </div>
      </div>

      {/* Players Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-28 custom-scrollbar px-2">
        {Object.entries(playersData).map(([name, data]: [string, any]) => {
          const score = calculateBlackjackScore(data.hand || []);
          const isMyArea = name === userNickname;
          const isHisTurn = currentTurn === name;
          const isBust = data.status === 'bust' || score > 21;

          return (
            <NeonCard key={name} color={isHisTurn ? 'sky' : 'slate'} className={`p-4 transition-all relative ${isHisTurn ? 'shadow-[0_0_15px_rgba(56,189,248,0.2)]' : 'opacity-80'}`}>
              <div className="flex-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 flex-center text-sm border border-slate-600 shadow-md">
                    {roomData.players[name]?.avatar || '👤'}
                  </div>
                  <span className={`font-black text-[13px] uppercase tracking-widest ${isMyArea ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {name === userNickname ? t('common.you') || 'คุณ' : name}
                  </span>
                  {isHisTurn && <span className="text-[9px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/50 px-2 py-1 rounded-md animate-pulse uppercase tracking-widest shadow-[0_0_10px_rgba(56,189,248,0.3)]">Turn</span>}
                </div>
                <div className="flex items-center gap-2">
                    {isBust ? (
                        <span className="text-[10px] font-black bg-red-950/50 border border-red-500/30 text-red-500 px-2 py-1 rounded-md uppercase tracking-widest shadow-[0_0_10px_rgba(239,68,68,0.2)]">BUST</span>
                    ) : data.status === 'stand' ? (
                        <span className="text-[10px] font-black bg-sky-950/50 border border-sky-500/30 text-sky-400 px-2 py-1 rounded-md uppercase tracking-widest">STAND</span>
                    ) : null}
                    <span className={`text-[16px] font-black ml-2 ${isBust ? 'text-red-500' : 'text-white drop-shadow-md'}`}>{score}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-[-10px] justify-center mt-2">
                {(data.hand || []).map((card: any, i: number) => (
                  <div key={i} className={i > 0 ? '-ml-8' : ''}>
                    <PlayingCard card={card} size="sm" />
                  </div>
                ))}
              </div>
              
              {isMyArea && isHisTurn && phase === 'playing' && (
                <div className="flex gap-3 mt-6">
                  <GiantButton color="sky" onClick={handleHit} className="flex-1">HIT</GiantButton>
                  <button onClick={handleStand} className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all hover:border-slate-500">STAND</button>
                </div>
              )}
            </NeonCard>
          );
        })}
      </div>

      {/* Result Layer */}
      {phase === 'result' && (
        <AnimatePresence>
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute bottom-4 left-0 w-full px-4 z-20">
            <NeonCard color="amber" className="p-6 shadow-[0_0_40px_rgba(0,0,0,0.8)] border-amber-500/50 bg-slate-900/95 backdrop-blur-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-sky-500/10 blur-3xl rounded-full" />
              
              <h3 className="text-center font-black text-[20px] text-amber-500 uppercase tracking-widest mb-6 drop-shadow-md">{t('blackjack.roundOver') || 'จบตา! ผลการเล่น'}</h3>
              
              <div className="space-y-3 mb-6 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                  {Object.entries(playersData).map(([name, data]: [string, any]) => {
                      let result = 'LOSE';
                      let color = 'text-red-400 bg-red-950/30 border-red-500/30';
                      const score = calculateBlackjackScore(data.hand || []);
                      
                      if (score > 21) { result = 'BUST'; color = 'text-red-500 bg-red-950/50 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]'; }
                      else if (dealerScore > 21 || score > dealerScore) { result = 'WIN! 🏆'; color = 'text-emerald-400 bg-emerald-950/50 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'; }
                      else if (score === dealerScore) { result = 'PUSH'; color = 'text-sky-400 bg-sky-950/50 border-sky-500/30'; }

                      return (
                          <div key={name} className="flex-between bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                              <span className="font-black text-[12px] uppercase tracking-widest text-slate-300">{name}</span>
                              <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest border ${color}`}>{result}</span>
                          </div>
                      );
                  })}
              </div>
              
              {isHost && (
                <div className="flex gap-3 relative z-10">
                  <GiantButton color="emerald" onClick={startGame} className="flex-[2]">
                    {t('common.playAgain') || 'เล่นอีกรอบ'}
                  </GiantButton>
                  <button onClick={handleBackToLobby} className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-400 rounded-2xl active:scale-95 transition-all hover:border-slate-500 hover:text-white">
                    {t('common.backToLobby') || 'Lobby'}
                  </button>
                </div>
              )}
            </NeonCard>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default Blackjack;

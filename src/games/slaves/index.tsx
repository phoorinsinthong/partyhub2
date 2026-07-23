// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../../firebase';
import { useGameLeave } from '../../hooks/useGameLeave';
import { useGame } from '../../contexts/GameContext';
import { useGameUpdate } from '../../hooks/useGameUpdate';
import { useTranslation } from 'react-i18next';
import PlayingCard from '../../components/PlayingCard';
import { createDeck, shuffleDeck, sortCardsSlaves, analyzePlay, validatePlay } from '../../utils/cards';
import LeaveConfirmModal from '../../components/LeaveConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { recordWin } from '../../components/Scoreboard';
import NeonCard from '../../components/NeonCard';
import GiantButton from '../../components/GiantButton';
import { LogOut, RotateCcw } from 'lucide-react';

const Slaves: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);
  
    const [selectedCards, setSelectedCards] = useState<any[]>([]);
  const [localSettings] = useState({ enableBomb: true, allowStraight: true });
  const advancingRef = useRef(false);

  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');

  const renderErrorToast = () => {
    if (!errorMsg) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border border-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-fade-in">
        {errorMsg}
      </div>
    );
  };

  if (!roomData || !userNickname) return null;

  const gameData = roomData?.gameData || {};
  const phase = gameData.phase || 'waiting'; // waiting, playing, result
  const playersData = gameData.players || {};
  const currentTurn = gameData.currentTurn || null;
  const table = gameData.table || { cards: [] };
  const roundCount = gameData.roundCount || 1;
  const ranks = gameData.ranks || []; // Ordered list of nicknames who finished
  const playerNames = Object.keys(roomData?.players || {});

  
  const startGame = async () => {
    if (!isHost) return;
    if (playerNames.length < 2) {
      setErrorMsg(t('slaves.minPlayers') || 'ต้องมีผู้เล่นอย่างน้อย 2 คน');
      return;
    }

    const deck = shuffleDeck(createDeck());
    const playersInit: Record<string, any> = {};
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
      ranks: [],
    });
  };

  const getNextTurn = (current: string | null, currentPlayers: Record<string, any>) => {
    const names = Object.keys(currentPlayers);
    let idx = current ? names.indexOf(current) : -1;
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

  const toggleCardSelection = (card: any) => {
    if (selectedCards.some(c => c.id === card.id)) {
      setSelectedCards(selectedCards.filter(c => c.id !== card.id));
    } else {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const handlePlayCards = async () => {
    if (currentTurn !== userNickname) return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    
    // In round 1, first play MUST include 3♣️ if table is empty
    if (roundCount === 1 && (!table || table.cards.length === 0)) {
      const has3Clubs = selectedCards.some(c => c.id === '3_of_clubs');
      const myHandHas3Clubs = playersData[userNickname].hand.some((c: any) => c.id === '3_of_clubs');
      if (myHandHas3Clubs && !has3Clubs) {
        setErrorMsg(t('slaves.mustPlay3Clubs') || 'ตาแรกต้องลง 3 ดอกจิก');
        setTimeout(() => setErrorMsg(''), 2000);
        advancingRef.current = false;
        return;
      }
    }

    const play = analyzePlay(selectedCards);
    if (!play) {
      setErrorMsg(t('slaves.invalidPlay') || 'รูปแบบไพ่ไม่ถูกต้อง');
      setTimeout(() => setErrorMsg(''), 2000);
      advancingRef.current = false;
      return;
    }

    const currentSettings = gameData.settings || { enableBomb: true, allowStraight: true };

    if (!validatePlay(selectedCards, table, currentSettings)) {
      setErrorMsg(t('slaves.tooSmall') || 'ไพ่เล็กกว่าบนโต๊ะ หรือรูปแบบไม่ตรงกัน');
      setTimeout(() => setErrorMsg(''), 2000);
      advancingRef.current = false;
      return;
    }

    // Remove cards from hand
    const myHand = playersData[userNickname].hand || [];
    const newHand = myHand.filter((c: any) => !selectedCards.some(sc => sc.id === c.id));
    
    const updates: Record<string, any> = {
      table: {
        cards: selectedCards,
        playedBy: userNickname,
        type: play,
        highestCard: play.highestCard
      },
      [`players/${userNickname}/hand`]: newHand,
    };

    const nextTurn = getNextTurn(userNickname, playersData);
    if (nextTurn) {
        updates.currentTurn = nextTurn;
    } else {
        // Everyone passed, table clears, previous player starts new turn
        updates.table = { cards: [] };
        updates.currentTurn = userNickname;
        playerNames.forEach(name => {
            updates[`players/${name}/isPass`] = false;
        });
    }

    // Check if finished
    if (newHand.length === 0) {
      const newRanks = [...ranks, userNickname];
      updates.ranks = newRanks;
      
      const survivors = playerNames.filter(name => (playersData[name].hand?.length > 0 && name !== userNickname));
      if (survivors.length <= 1) {
        if (survivors.length === 1) newRanks.push(survivors[0]);
        updates.phase = 'result';
        updates.ranks = newRanks;
        if (newRanks.length > 0) recordWin(roomId, newRanks[0], 'slaves');
      }
    }

    await safeUpdate(updates);
    setSelectedCards([]);
    advancingRef.current = false;
  };

  const handlePass = async () => {
    if (currentTurn !== userNickname) return;
    
    const updates: Record<string, any> = {
      [`players/${userNickname}/isPass`]: true,
    };

    const nextTurn = getNextTurn(userNickname, playersData);
    if (nextTurn) {
      updates.currentTurn = nextTurn;
    } else {
      // Round ends
      updates.table = { cards: [] };
      // Previous player (who played highest) starts new round
      const lastPlayer = table.playedBy;
      updates.currentTurn = playersData[lastPlayer]?.hand?.length > 0 ? lastPlayer : getNextTurn(lastPlayer, playersData);
      playerNames.forEach(name => {
        updates[`players/${name}/isPass`] = false;
      });
    }

    await safeUpdate(updates);
    setSelectedCards([]);
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await update(ref(db, `rooms/${roomId}`), { status: 'waiting', currentGame: null, gameData: null });
  };

  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in relative z-10 px-4">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        
        <NeonCard color="amber" className="p-8 flex flex-col items-center text-center max-w-sm w-full mx-auto">
          <div className="text-6xl animate-pulse mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">👑</div>
          <h2 className="font-display font-black text-2xl text-white mb-2 uppercase tracking-widest">{t('slaves.title') || 'Slave'}</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">{t('slaves.description') || 'ใครไพ่หมดมือคนแรกคือ King! ใครคนสุดท้ายคือ Slave'}</p>
          
          {isHost ? (
            <GiantButton color="amber" onClick={startGame} className="w-full">
              {t('slaves.startGame') || 'เริ่มแจกไพ่!'}
            </GiantButton>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold animate-pulse w-full">
              {t('slaves.waitingHost') || 'รอ Host เริ่มเกม...'}
            </div>
          )}
        </NeonCard>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col py-2 animate-fade-in relative h-full z-10">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}

      {/* Table Area */}
      <div className="flex flex-col items-center justify-center gap-3 py-6 bg-slate-900/60 rounded-3xl mb-4 min-h-[160px] border border-slate-700 shadow-inner mx-2">
        {table.cards && table.cards.length > 0 ? (
          <>
            <div className="flex gap-[-20px]">
              {table.cards.map((c: any, i: number) => (
                <div key={i} className={i > 0 ? '-ml-8' : ''}>
                  <PlayingCard card={c} />
                </div>
              ))}
            </div>
            <p className="text-[11px] font-black text-amber-400 uppercase tracking-widest px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/30">
              {t('slaves.playedBy', { name: table.playedBy })}
            </p>
          </>
        ) : (
          <span className="text-slate-500 font-bold text-sm italic uppercase tracking-widest">{t('slaves.emptyTable') || 'โต๊ะว่าง'}</span>
        )}
      </div>

      {/* Players List (Status Only) */}
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar px-2">
        {playerNames.map(name => {
          const data = playersData[name];
          const isTurn = currentTurn === name;
          const isFinished = !data.hand || data.hand.length === 0;
          return (
            <div key={name} className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all shrink-0 min-w-[70px] ${isTurn ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'bg-slate-900 border-slate-700 opacity-80'}`}>
              <div className="relative">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-sm ${isFinished ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-slate-800 border border-slate-700'}`}>
                  {isFinished ? '🏆' : (roomData.players[name]?.avatar || '👤')}
                </div>
                {isTurn && <div className="absolute -top-1 -right-1 w-3 h-3 bg-neon-green rounded-full border border-slate-900 animate-pulse shadow-[0_0_8px_rgba(0,255,0,0.8)]" />}
              </div>
              <span className={`text-[10px] font-bold truncate max-w-[60px] ${isTurn ? 'text-amber-400' : 'text-slate-300'}`}>{name}</span>
              {data.isPass && <span className="text-[9px] font-black text-red-500 uppercase">PASS</span>}
              {!isFinished && <span className="text-[9px] font-black text-slate-400">🎴 {data.hand?.length}</span>}
            </div>
          );
        })}
      </div>

      {/* My Hand Area */}
      <div className="mt-auto bg-slate-900/80 backdrop-blur-md rounded-t-[40px] p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] border-t border-slate-700 pb-8 relative z-20">
        <div className="flex justify-between items-center mb-4">
            <span className="text-[12px] font-black text-amber-400 uppercase tracking-widest drop-shadow-md">{t('slaves.yourHand') || 'ไพ่ของคุณ'}</span>
            <span className="text-[11px] font-bold text-slate-400">{playersData[userNickname]?.hand?.length} {t('common.cards') || 'ใบ'}</span>
        </div>
        
        <div className="flex flex-wrap gap-2 justify-center mb-8 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
          {(playersData[userNickname]?.hand || []).map((card: any) => {
            const isSelected = selectedCards.some(sc => sc.id === card.id);
            return (
              <div key={card.id} onClick={() => toggleCardSelection(card)} className={`transition-transform active:scale-95 cursor-pointer ${isSelected ? '-translate-y-4 shadow-lg shadow-neon-green/30 rounded-lg' : ''}`}>
                <PlayingCard card={card} selected={isSelected} />
              </div>
            );
          })}
        </div>

        {currentTurn === userNickname && phase === 'playing' && (
          <div className="flex gap-3">
            <GiantButton color="slate" onClick={handlePass} className="flex-1 py-3 text-sm">
              {t('slaves.pass') || 'ผ่าน'}
            </GiantButton>
            <GiantButton 
              color="amber"
              onClick={handlePlayCards} 
              disabled={selectedCards.length === 0} 
              className="flex-1 py-3 text-sm shadow-[0_0_15px_rgba(245,158,11,0.3)]"
            >
              {t('slaves.play') || 'ลงไพ่'}
            </GiantButton>
          </div>
        )}
      </div>

      {/* Result Modal */}
      <AnimatePresence>
        {phase === 'result' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <NeonCard color="amber" className="w-full max-w-sm p-8 text-center flex flex-col items-center">
              <h3 className="text-3xl font-black text-amber-400 mb-6 uppercase tracking-widest drop-shadow-md">{t('common.finished') || 'จบเกม!'}</h3>
              <div className="space-y-3 mb-8 w-full">
                  {ranks.map((name: string, i: number) => (
                      <div key={name} className="flex justify-between items-center p-3 rounded-xl bg-slate-900/50 border border-slate-700 shadow-inner">
                          <div className="flex items-center gap-3">
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-sm ${i === 0 ? 'bg-amber-400 text-amber-900 shadow-amber-400/50' : 'bg-slate-800 text-slate-300 border border-slate-600'}`}>{i+1}</span>
                              <span className="font-bold text-white">{name}</span>
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${
                            i === 0 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 
                            i === ranks.length - 1 ? 'text-red-400 border-red-500/30 bg-red-500/10' : 
                            'text-slate-400 border-slate-600 bg-slate-800'
                          }`}>
                              {i === 0 ? 'KING 👑' : i === ranks.length - 1 ? 'SLAVE ⛓️' : 'CITIZEN'}
                          </span>
                      </div>
                  ))}
              </div>
              {isHost && (
                  <div className="flex gap-3 w-full">
                      <GiantButton color="amber" onClick={startGame} className="flex-1 py-3 text-sm">
                        <RotateCcw size={16} className="inline mr-1" /> {t('common.playAgain') || 'เล่นอีกรอบ'}
                      </GiantButton>
                      <GiantButton color="slate" onClick={handleBackToLobby} className="flex-1 py-3 text-sm">
                        <LogOut size={16} className="inline mr-1" /> {t('common.backToLobby') || 'Lobby'}
                      </GiantButton>
                  </div>
              )}
            </NeonCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Slaves;

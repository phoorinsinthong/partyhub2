import React, { useState, useEffect, useRef } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGame } from '../contexts/GameContext';
import { useTranslation } from 'react-i18next';
import PlayingCard from '../components/PlayingCard';
import { createDeck, shuffleDeck, sortCardsSlaves, analyzePlay, validatePlay } from './logic/cards';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { recordWin } from '../components/Scoreboard';

const Slaves: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedCards, setSelectedCards] = useState<any[]>([]);
  const [localSettings] = useState({ enableBomb: true, allowStraight: true });
  const advancingRef = useRef(false);

  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');

  const renderErrorToast = () => {
    if (!errorMsg) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl animate-fade-in">
        {errorMsg}
      </div>
    );
  };

  if (!roomData) return null;

  const gameData = roomData?.gameData || {};
  const phase = gameData.phase || 'waiting'; // waiting, playing, result
  const playersData = gameData.players || {};
  const currentTurn = gameData.currentTurn || null;
  const table = gameData.table || { cards: [] };
  const roundCount = gameData.roundCount || 1;
  const ranks = gameData.ranks || []; // Ordered list of nicknames who finished
  const playerNames = Object.keys(roomData?.players || {});

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
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-6xl animate-bounce-soft">👑</div>
        <div className="text-center">
          <h2 className="font-display font-bold text-[22px] text-olive-800 mb-1">{t('slaves.title') || 'Slave'}</h2>
          <p className="text-olive-400 text-[13px]">{t('slaves.description') || 'ใครไพ่หมดมือคนแรกคือ King! ใครคนสุดท้ายคือ Slave'}</p>
        </div>
        {isHost ? (
          <button onClick={startGame} className="btn btn-primary px-10 py-4 rounded-3xl text-lg shadow-lg">
            {t('slaves.startGame') || 'เริ่มแจกไพ่!'}
          </button>
        ) : (
          <p className="text-olive-400 font-bold animate-pulse">{t('slaves.waitingHost') || 'รอ Host เริ่มเกม...'}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col py-2 animate-fade-in relative h-full">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}

      {/* Table Area */}
      <div className="flex-center flex-col gap-3 py-6 bg-olive-50/30 rounded-3xl mb-4 min-h-[160px] border-2 border-dashed border-olive-100">
        {table.cards && table.cards.length > 0 ? (
          <>
            <div className="flex gap-[-20px]">
              {table.cards.map((c: any, i: number) => (
                <div key={i} className={i > 0 ? '-ml-8' : ''}>
                  <PlayingCard card={c} size="sm" />
                </div>
              ))}
            </div>
            <p className="text-[11px] font-bold text-olive-400 uppercase tracking-widest">{t('slaves.playedBy', { name: table.playedBy })}</p>
          </>
        ) : (
          <span className="text-olive-200 font-bold text-sm italic">{t('slaves.emptyTable') || 'โต๊ะว่าง'}</span>
        )}
      </div>

      {/* Players List (Status Only) */}
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
        {playerNames.map(name => {
          const data = playersData[name];
          const isTurn = currentTurn === name;
          const isFinished = !data.hand || data.hand.length === 0;
          return (
            <div key={name} className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all shrink-0 min-w-[70px] ${isTurn ? 'bg-white border-sage-400 shadow-sm' : 'bg-white/50 border-olive-50'}`}>
              <div className="relative">
                <div className={`w-8 h-8 rounded-xl flex-center text-sm shadow-sm ${isFinished ? 'bg-amber-100' : 'bg-olive-100'}`}>
                  {isFinished ? '🏆' : (roomData.players[name]?.avatar || '👤')}
                </div>
                {isTurn && <div className="absolute -top-1 -right-1 w-3 h-3 bg-sage-500 rounded-full border-2 border-white animate-pulse" />}
              </div>
              <span className={`text-[10px] font-bold truncate max-w-[60px] ${isTurn ? 'text-sage-700' : 'text-olive-400'}`}>{name}</span>
              {data.isPass && <span className="text-[9px] font-black text-red-400 uppercase">PASS</span>}
              {!isFinished && <span className="text-[9px] font-black text-olive-300">🎴 {data.hand?.length}</span>}
            </div>
          );
        })}
      </div>

      {/* My Hand Area */}
      <div className="mt-auto bg-white rounded-t-[40px] p-6 shadow-2xl border-t-2 border-olive-50 -mx-4 pb-8">
        <div className="flex-between mb-4">
            <span className="text-[12px] font-black text-olive-800 uppercase tracking-widest">{t('slaves.yourHand') || 'ไพ่ของคุณ'}</span>
            <span className="text-[11px] font-bold text-olive-300">{playersData[userNickname]?.hand?.length} {t('common.cards') || 'ใบ'}</span>
        </div>
        
        <div className="flex flex-wrap gap-2 justify-center mb-8 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
          {(playersData[userNickname]?.hand || []).map((card: any) => {
            const isSelected = selectedCards.some(sc => sc.id === card.id);
            return (
              <div key={card.id} onClick={() => toggleCardSelection(card)} className={`transition-transform active:scale-95 ${isSelected ? '-translate-y-4' : ''}`}>
                <PlayingCard card={card} size="sm" isSelected={isSelected} />
              </div>
            );
          })}
        </div>

        {currentTurn === userNickname && phase === 'playing' && (
          <div className="flex gap-3">
            <button 
              onClick={handlePass} 
              className="btn btn-outline flex-1 py-4 text-[15px] rounded-2xl"
            >
              {t('slaves.pass') || 'ผ่าน'}
            </button>
            <button 
              onClick={handlePlayCards} 
              disabled={selectedCards.length === 0} 
              className="btn btn-primary flex-1 py-4 text-[15px] rounded-2xl shadow-lg shadow-sage-200"
            >
              {t('slaves.play') || 'ลงไพ่'}
            </button>
          </div>
        )}
      </div>

      {/* Result Modal */}
      {phase === 'result' && (
        <div className="fixed inset-0 z-50 flex-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <div className="card w-full max-w-sm p-6 text-center shadow-2xl">
                <h3 className="text-2xl font-black text-olive-800 mb-6">{t('common.finished') || 'จบเกม!'}</h3>
                <div className="space-y-3 mb-8">
                    {ranks.map((name: string, i: number) => (
                        <div key={name} className="flex-between p-3 rounded-2xl bg-olive-50 border border-olive-100">
                            <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-white flex-center text-xs font-black text-olive-400">{i+1}</span>
                                <span className="font-bold text-olive-700">{name}</span>
                            </div>
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                                {i === 0 ? 'KING' : i === ranks.length - 1 ? 'SLAVE' : 'CITIZEN'}
                            </span>
                        </div>
                    ))}
                </div>
                {isHost && (
                    <div className="flex gap-3">
                        <button onClick={startGame} className="btn btn-primary flex-1 py-3 text-[14px]">{t('common.playAgain') || 'เล่นอีกรอบ'}</button>
                        <button onClick={handleBackToLobby} className="btn btn-outline flex-1 py-3 text-[14px]">{t('common.backToLobby') || 'Lobby'}</button>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default Slaves;

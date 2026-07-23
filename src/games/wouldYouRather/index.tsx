// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ref, update } from 'firebase/database';
import { db } from '../../firebase';
import { RotateCcw, ChevronRight, LogOut, Users, CheckCircle2 } from 'lucide-react';
import { recordPersonalGame } from '../../components/features/PersonalStats';
import { useGameLeave } from '../../hooks/useGameLeave';
import { useGame } from '../../contexts/GameContext';
import { useGameUpdate } from '../../hooks/useGameUpdate';
import { useTranslation } from 'react-i18next';
import LeaveConfirmModal from '../../components/ui/LeaveConfirmModal';
import { getShuffledWyrQuestions } from './wyrData';
import NeonCard from '../../components/ui/NeonCard';
import GiantButton from '../../components/ui/GiantButton';

const WouldYouRather: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');
  
  const gameData = roomData?.gameData || {};
  const players = Object.keys(roomData?.players || {});
    const advancingRef = useRef(false);

  
  useEffect(() => {
    recordPersonalGame('wouldyourather');
  }, []);

  if (!roomData) return null;
  const phase = gameData.phase || 'waiting';
  const currentQIndex = gameData.currentQuestionIndex ?? 0;
  const questions = gameData.questions || [];
  const currentQuestion = questions[currentQIndex];
  const votes = gameData.votes?.[currentQIndex] || {};

  const myVote = userNickname ? votes[userNickname] : null;
  const totalVotes = Object.keys(votes).length;

  const handleStart = async () => {
    if (!isHost) return;
    const qs = getShuffledWyrQuestions(15);
    await safeUpdate(`rooms/${roomId}/gameData`, {
      phase: 'playing',
      questions: qs,
      currentQuestionIndex: 0,
      votes: {},
    });
  };

  const handleVote = async (option: 'a' | 'b') => {
    if (!userNickname || myVote) return;
    await safeUpdate(`rooms/${roomId}/gameData/votes/${currentQIndex}`, {
      [userNickname]: option,
    });
  };

  const nextQuestion = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    try {
      if (currentQIndex + 1 >= questions.length) {
        await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'finished' });
      } else {
        await safeUpdate(`rooms/${roomId}/gameData`, {
          currentQuestionIndex: currentQIndex + 1,
        });
      }
    } finally {
      advancingRef.current = false;
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  const renderErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border border-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-fade-in">
      {errorMsg}
    </div>
  ) : null;

  if (!roomData) return null;

  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in relative z-10">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        
        <NeonCard color="blue" className="p-8 flex flex-col items-center text-center max-w-sm w-full mx-auto">
          <div className="text-6xl animate-pulse mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">⚖️</div>
          <h2 className="font-display font-black text-2xl text-white mb-2 uppercase tracking-widest">{t('wouldYouRather.title') || 'Would You Rather'}</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">{t('wouldYouRather.description') || 'เลือกสิ่งที่คุณชอบมากกว่า และดูว่าเพื่อนเลือกเหมือนกันไหม!'}</p>
          
          {isHost ? (
            <GiantButton color="blue" onClick={handleStart} className="w-full">
              {t('wouldYouRather.startGame') || 'เริ่มเกมเลย!'}
            </GiantButton>
          ) : (
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold animate-pulse w-full">
              {t('wouldYouRather.waitingHost') || 'รอ Host เริ่มเกม...'}
            </div>
          )}
        </NeonCard>
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fade-in relative z-10 p-4">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}

        <NeonCard color="pink" className="p-8 text-center max-w-sm w-full">
          <div className="text-6xl mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">🏁</div>
          <h2 className="font-display font-black text-3xl text-white mb-6 uppercase tracking-widest">{t('common.finished') || 'จบเกม!'}</h2>
          {isHost ? (
            <div className="flex flex-col gap-3">
              <GiantButton color="pink" onClick={handleStart}>
                <RotateCcw size={18} /> {t('common.playAgain') || 'เล่นอีกรอบ'}
              </GiantButton>
              <GiantButton color="slate" onClick={handleBackToLobby}>
                <LogOut size={18} /> {t('common.backToLobby') || 'กลับ Lobby'}
              </GiantButton>
            </div>
          ) : (
            <p className="text-slate-400 font-bold">{t('common.waitingHostPlayAgain') || 'รอ Host เริ่มเกมใหม่...'}</p>
          )}
        </NeonCard>
      </div>
    );
  }

  const voteA = Object.values(votes).filter(v => v === 'a').length;
  const voteB = Object.values(votes).filter(v => v === 'b').length;
  const percentA = totalVotes > 0 ? Math.round((voteA / totalVotes) * 100) : 50;
  const percentB = totalVotes > 0 ? 100 - percentA : 50;

  return (
    <div className="flex-1 flex flex-col py-4 animate-fade-in relative z-10 px-2 max-w-lg mx-auto w-full">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      
      <div className="flex justify-between items-center mb-6 bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
        <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/30">
          {t('wouldYouRather.question') || 'คำถามที่'} {currentQIndex + 1}/{questions.length}
        </span>
        <div className="flex items-center gap-1.5 text-slate-300 font-bold text-xs bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
          <Users size={14} className="text-neon-green" />
          {totalVotes}/{players.length} {t('wouldYouRather.voted') || 'โหวตแล้ว'}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {/* Option A (Indigo) */}
        <motion.button
          whileTap={!myVote ? { scale: 0.98 } : {}}
          onClick={() => handleVote('a')}
          className={`relative overflow-hidden p-6 rounded-[24px] border-2 transition-all flex flex-col items-center justify-center text-center gap-3 min-h-[160px] ${
            myVote === 'a' 
              ? 'bg-indigo-900/40 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]' 
              : myVote 
                ? 'bg-slate-900 border-slate-800 opacity-60' 
                : 'bg-slate-800/50 border-indigo-500/30 hover:border-indigo-400/50 shadow-sm'
          }`}
        >
          {myVote && (
            <motion.div 
              initial={{ width: 0 }} animate={{ width: `${percentA}%` }}
              className="absolute left-0 top-0 bottom-0 bg-indigo-500/20 pointer-events-none"
            />
          )}
          <span className={`relative font-bold text-lg leading-relaxed z-10 ${myVote === 'a' ? 'text-indigo-100' : 'text-slate-200'}`}>
            {currentQuestion?.a}
          </span>
          {myVote && (
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-3xl font-black text-indigo-400 drop-shadow-md">{percentA}%</span>
              {myVote === 'a' && (
                <div className="mt-2 flex items-center gap-1 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30">
                  <CheckCircle2 size={14} className="text-indigo-400" />
                  <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">คุณเลือกสิ่งนี้</span>
                </div>
              )}
            </div>
          )}
        </motion.button>

        <div className="flex justify-center relative h-6 my-2">
          <div className="absolute w-full top-1/2 -translate-y-1/2 h-px bg-slate-800" />
          <span className="relative bg-slate-950 px-4 font-black text-slate-500 text-xs italic uppercase tracking-widest">OR</span>
        </div>

        {/* Option B (Rose/Pink) */}
        <motion.button
          whileTap={!myVote ? { scale: 0.98 } : {}}
          onClick={() => handleVote('b')}
          className={`relative overflow-hidden p-6 rounded-[24px] border-2 transition-all flex flex-col items-center justify-center text-center gap-3 min-h-[160px] ${
            myVote === 'b' 
              ? 'bg-pink-900/40 border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.2)]' 
              : myVote 
                ? 'bg-slate-900 border-slate-800 opacity-60' 
                : 'bg-slate-800/50 border-pink-500/30 hover:border-pink-400/50 shadow-sm'
          }`}
        >
          {myVote && (
            <motion.div 
              initial={{ width: 0 }} animate={{ width: `${percentB}%` }}
              className="absolute left-0 top-0 bottom-0 bg-pink-500/20 pointer-events-none"
            />
          )}
          <span className={`relative font-bold text-lg leading-relaxed z-10 ${myVote === 'b' ? 'text-pink-100' : 'text-slate-200'}`}>
            {currentQuestion?.b}
          </span>
          {myVote && (
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-3xl font-black text-pink-400 drop-shadow-md">{percentB}%</span>
              {myVote === 'b' && (
                <div className="mt-2 flex items-center gap-1 bg-pink-500/20 px-3 py-1 rounded-full border border-pink-500/30">
                  <CheckCircle2 size={14} className="text-pink-400" />
                  <span className="text-[10px] font-black text-pink-300 uppercase tracking-widest">คุณเลือกสิ่งนี้</span>
                </div>
              )}
            </div>
          )}
        </motion.button>
      </div>

      <div className="mt-8 pb-20">
        {isHost && totalVotes >= 1 && (
          <GiantButton 
            color={currentQIndex + 1 >= questions.length ? "pink" : "blue"} 
            onClick={nextQuestion} 
            className="w-full"
          >
            {currentQIndex + 1 >= questions.length ? t('common.viewResults') || 'ดูผลลัพธ์' : t('common.next') || 'ข้อถัดไป'}
            <ChevronRight size={20} strokeWidth={3} className="inline ml-1" />
          </GiantButton>
        )}
        {!isHost && myVote && (
          <div className="text-center p-4 rounded-xl bg-slate-900 border border-slate-800">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
              {t('wouldYouRather.waitingHostNext') || 'รอ Host ไปข้อถัดไป...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WouldYouRather;

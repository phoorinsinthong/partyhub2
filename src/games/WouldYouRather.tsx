import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, increment } from 'firebase/database';
import { db } from '../firebase';
import { RotateCcw, ChevronRight, LogOut, Users, CheckCircle2 } from 'lucide-react';
import { recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGame } from '../contexts/GameContext';
import { useTranslation } from 'react-i18next';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { getShuffledWyrQuestions } from './logic/wyrData';

const WouldYouRather: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');
  
  const gameData = roomData?.gameData || {};
  const players = Object.keys(roomData?.players || {});
  const [errorMsg, setErrorMsg] = useState('');
  const advancingRef = useRef(false);

  const safeUpdate = async (refPath: string, data: any) => {
    try {
      await update(ref(db, refPath), data);
    } catch {
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

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
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl animate-fade-in">
      {errorMsg}
    </div>
  ) : null;

  if (!roomData) return null;
  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-6xl animate-bounce-soft">⚖️</div>
        <div className="text-center">
          <h2 className="font-display font-bold text-[22px] text-olive-800 mb-1">{t('wouldYouRather.title') || 'Would You Rather'}</h2>
          <p className="text-olive-400 text-[13px]">{t('wouldYouRather.description') || 'เลือกสิ่งที่คุณชอบมากกว่า และดูว่าเพื่อนเลือกเหมือนกันไหม!'}</p>
        </div>
        {isHost ? (
          <button onClick={handleStart} className="btn btn-primary px-10 py-4 rounded-3xl text-lg shadow-lg">
            {t('wouldYouRather.startGame') || 'เริ่มเกมเลย!'}
          </button>
        ) : (
          <p className="text-olive-400 font-bold animate-pulse">{t('wouldYouRather.waitingHost') || 'รอ Host เริ่มเกม...'}</p>
        )}
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="flex-1 flex flex-center flex-col gap-6 animate-fade-in">
        <div className="text-6xl">🏁</div>
        <h2 className="font-display font-bold text-2xl text-olive-800">{t('common.finished') || 'จบเกม!'}</h2>
        {isHost && (
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={handleStart} className="btn btn-primary py-4 rounded-2xl">
              <RotateCcw size={18} /> {t('common.playAgain') || 'เล่นอีกรอบ'}
            </button>
            <button onClick={handleBackToLobby} className="btn btn-outline py-4 rounded-2xl">
              <LogOut size={18} /> {t('common.backToLobby') || 'กลับ Lobby'}
            </button>
          </div>
        )}
      </div>
    );
  }

  const voteA = Object.values(votes).filter(v => v === 'a').length;
  const voteB = Object.values(votes).filter(v => v === 'b').length;
  const percentA = totalVotes > 0 ? Math.round((voteA / totalVotes) * 100) : 50;
  const percentB = totalVotes > 0 ? 100 - percentA : 50;

  return (
    <div className="flex-1 flex flex-col py-4 animate-fade-in">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      
      <div className="flex-between mb-4 px-1">
        <span className="text-[11px] font-bold text-olive-400 uppercase tracking-widest">
          {t('wouldYouRather.question') || 'คำถามที่'} {currentQIndex + 1}/{questions.length}
        </span>
        <div className="flex items-center gap-1.5 text-olive-500 font-bold text-[12px]">
          <Users size={14} />
          {totalVotes}/{players.length} {t('wouldYouRather.voted') || 'โหวตแล้ว'}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {/* Option A */}
        <motion.button
          whileTap={!myVote ? { scale: 0.98 } : {}}
          onClick={() => handleVote('a')}
          className={`relative overflow-hidden p-8 rounded-[32px] border-2 transition-all flex flex-col items-center justify-center text-center gap-2 min-h-[160px] ${
            myVote === 'a' ? 'bg-blue-50 border-blue-300 shadow-md' : 
            myVote ? 'bg-white border-olive-50 opacity-60' : 'bg-white border-blue-100 shadow-sm'
          }`}
        >
          {myVote && (
            <motion.div 
              initial={{ width: 0 }} animate={{ width: `${percentA}%` }}
              className="absolute inset-0 bg-blue-100/50 pointer-events-none"
            />
          )}
          <span className={`relative font-black text-lg ${myVote === 'a' ? 'text-blue-700' : 'text-olive-700'}`}>
            {currentQuestion?.a}
          </span>
          {myVote && (
            <span className="relative text-2xl font-black text-blue-600">{percentA}%</span>
          )}
          {myVote === 'a' && <CheckCircle2 size={20} className="relative text-blue-500 mt-1" />}
        </motion.button>

        <div className="flex-center relative h-8">
          <div className="absolute w-full h-px bg-olive-100" />
          <span className="relative bg-white px-4 font-black text-olive-300 text-xs italic">OR</span>
        </div>

        {/* Option B */}
        <motion.button
          whileTap={!myVote ? { scale: 0.98 } : {}}
          onClick={() => handleVote('b')}
          className={`relative overflow-hidden p-8 rounded-[32px] border-2 transition-all flex flex-col items-center justify-center text-center gap-2 min-h-[160px] ${
            myVote === 'b' ? 'bg-rose-50 border-rose-300 shadow-md' : 
            myVote ? 'bg-white border-olive-50 opacity-60' : 'bg-white border-rose-100 shadow-sm'
          }`}
        >
          {myVote && (
            <motion.div 
              initial={{ width: 0 }} animate={{ width: `${percentB}%` }}
              className="absolute inset-0 bg-rose-100/50 pointer-events-none"
            />
          )}
          <span className={`relative font-black text-lg ${myVote === 'b' ? 'text-rose-700' : 'text-olive-700'}`}>
            {currentQuestion?.b}
          </span>
          {myVote && (
            <span className="relative text-2xl font-black text-rose-600">{percentB}%</span>
          )}
          {myVote === 'b' && <CheckCircle2 size={20} className="relative text-rose-500 mt-1" />}
        </motion.button>
      </div>

      <div className="mt-6">
        {isHost && totalVotes >= 1 && (
          <button onClick={nextQuestion} className="btn btn-primary w-full py-4 rounded-3xl text-lg shadow-lg">
            {currentQIndex + 1 >= questions.length ? t('common.viewResults') || 'ดูผลลัพธ์' : t('common.next') || 'ข้อถัดไป'}
            <ChevronRight size={20} strokeWidth={3} />
          </button>
        )}
        {!isHost && myVote && (
          <p className="text-center text-[13px] font-bold text-olive-400 animate-pulse py-4">
            {t('wouldYouRather.waitingHostNext') || 'รอ Host ไปข้อถัดไป...'}
          </p>
        )}
      </div>
    </div>
  );
};

export default WouldYouRather;

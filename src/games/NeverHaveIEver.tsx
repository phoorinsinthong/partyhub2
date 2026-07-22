import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { RotateCcw, ChevronRight, LogOut, Users, Heart, Sparkles } from 'lucide-react';
import { recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGame } from '../contexts/GameContext';
import { useTranslation } from 'react-i18next';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { getRandomStatement } from './logic/neverData';

const NeverHaveIEver: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');
  
  const [errorMsg, setErrorMsg] = useState('');
  const advancingRef = useRef(false);

  useEffect(() => {
    recordPersonalGame('neverhaveiever');
  }, []);

  const gameData = roomData?.gameData || {};
  const players = Object.keys(roomData?.players || {});

  if (!roomData) return null;

  // Derived variables
  const phase = gameData.phase || 'waiting';
  const currentQIndex = gameData.currentQuestionIndex ?? 0;
  const currentStatement = gameData.currentStatement || '';
  const responses = gameData.responses?.[currentQIndex] || {};
  const myResponse = responses[userNickname || ''];
  const hasRespondedCount = Object.keys(responses).length;
  const everCount = Object.values(responses).filter(v => v === true).length;
  const neverCount = Object.values(responses).filter(v => v === false).length;

  const renderErrorToast = () => {
    if (!errorMsg) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in fade-in slide-in-from-top-4">
        <div className="bg-red-500 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3">
          <div className="p-1 bg-white/20 rounded-lg">
            <LogOut size={18} className="rotate-90" />
          </div>
          <p className="text-[14px] font-bold">{errorMsg}</p>
        </div>
      </div>
    );
  };

  const safeUpdate = async (refPath: string, data: any) => {
    try {
      await update(ref(db, refPath), data);
    } catch {
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  const handleStart = async () => {
    if (!isHost) return;
    const stmt = getRandomStatement();
    await safeUpdate(`rooms/${roomId}/gameData`, {
      phase: 'playing',
      currentQuestionIndex: 0,
      currentStatement: stmt,
      responses: {},
    });
  };

  const handleResponse = async (val: boolean) => {
    if (myResponse !== undefined) return;
    await safeUpdate(`rooms/${roomId}/gameData/responses/${currentQIndex}`, {
      [userNickname!]: val,
    });
  };

  const nextQuestion = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    try {
      const stmt = getRandomStatement();
      await safeUpdate(`rooms/${roomId}/gameData`, {
        currentQuestionIndex: currentQIndex + 1,
        currentStatement: stmt,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-6xl animate-bounce-soft">🙋</div>
        <div className="text-center">
          <h2 className="font-display font-bold text-[22px] text-olive-800 mb-1">{t('neverHaveIEver.title') || 'ไม่เคย... (Never Have I Ever)'}</h2>
          <p className="text-olive-400 text-[13px]">{t('neverHaveIEver.description') || 'ใครเคยทำสิ่งนี้... ต้องยอมรับมาซะดีๆ!'}</p>
        </div>
        {isHost ? (
          <button onClick={handleStart} className="btn btn-primary px-10 py-4 rounded-3xl text-lg shadow-lg">
            {t('neverHaveIEver.startGame') || 'เริ่มเกมเลย!'}
          </button>
        ) : (
          <p className="text-olive-400 font-bold animate-pulse">{t('neverHaveIEver.waitingHost') || 'รอ Host เริ่มเกม...'}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col py-4 animate-fade-in">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      
      <div className="flex-between mb-4 px-1">
        <span className="text-[11px] font-bold text-olive-400 uppercase tracking-widest">
          {t('neverHaveIEver.round') || 'รอบที่'} {currentQIndex + 1}
        </span>
        <div className="flex items-center gap-1.5 text-olive-500 font-bold text-[12px]">
          <Users size={14} />
          {hasRespondedCount}/{players.length} {t('neverHaveIEver.responded') || 'ตอบแล้ว'}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6">
        <motion.div
          key={currentQIndex}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="card p-8 flex flex-col items-center justify-center text-center gap-4 border-4 border-red-100 min-h-[220px] shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-red-100" />
          <Sparkles className="text-red-200 absolute top-4 right-4" size={24} />
          
          <p className="text-[14px] font-black text-red-400 uppercase tracking-widest">NEVER HAVE I EVER</p>
          <p className="text-[22px] font-black text-olive-800 leading-tight">
            {currentStatement}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-4">
          <motion.button
            whileTap={myResponse === undefined ? { scale: 0.95 } : {}}
            onClick={() => handleResponse(true)}
            className={`p-6 rounded-[32px] border-2 transition-all flex flex-col items-center gap-2 ${
              myResponse === true ? 'bg-red-50 border-red-300 shadow-md ring-2 ring-red-100' : 
              myResponse !== undefined ? 'bg-white border-olive-50 opacity-40' : 'bg-white border-red-100 shadow-sm'
            }`}
          >
            <span className="text-3xl">🙋‍♂️</span>
            <span className="font-black text-red-600">{t('neverHaveIEver.ever') || 'เคยทำ'}</span>
            {myResponse !== undefined && <span className="text-xl font-black text-red-400">{everCount}</span>}
          </motion.button>

          <motion.button
            whileTap={myResponse === undefined ? { scale: 0.95 } : {}}
            onClick={() => handleResponse(false)}
            className={`p-6 rounded-[32px] border-2 transition-all flex flex-col items-center gap-2 ${
              myResponse === false ? 'bg-sage-50 border-sage-300 shadow-md ring-2 ring-sage-100' : 
              myResponse !== undefined ? 'bg-white border-olive-50 opacity-40' : 'bg-white border-sage-100 shadow-sm'
            }`}
          >
            <span className="text-3xl">🙅‍♀️</span>
            <span className="font-black text-sage-600">{t('neverHaveIEver.never') || 'ไม่เคย'}</span>
            {myResponse !== undefined && <span className="text-xl font-black text-sage-400">{neverCount}</span>}
          </motion.button>
        </div>
        
        {myResponse !== undefined && (
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {players.map(p => {
              const res = responses[p];
              if (res === undefined) return null;
              return (
                <div key={p} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border ${
                  res ? 'bg-red-50 text-red-500 border-red-100' : 'bg-sage-50 text-sage-600 border-sage-100'
                }`}>
                  {p === userNickname ? t('common.you') || 'คุณ' : p}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6">
        {isHost && hasRespondedCount >= 1 && (
          <button onClick={nextQuestion} className="btn btn-primary w-full py-4 rounded-3xl text-lg shadow-lg">
            {t('common.next') || 'ข้อถัดไป'}
            <ChevronRight size={20} strokeWidth={3} />
          </button>
        )}
        {!isHost && myResponse !== undefined && (
          <p className="text-center text-[13px] font-bold text-olive-400 animate-pulse py-4">
            {t('neverHaveIEver.waitingHostNext') || 'รอ Host ไปข้อถัดไป...'}
          </p>
        )}
      </div>

      {isHost && (
        <div className="mt-auto pt-4 flex-center">
          <button onClick={handleBackToLobby} className="flex items-center gap-2 text-[12px] font-bold text-olive-300 hover:text-olive-500 transition-colors">
            <RotateCcw size={14} /> {t('common.backToLobby') || 'กลับ Lobby'}
          </button>
        </div>
      )}
    </div>
  );
};

export default NeverHaveIEver;

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update } from 'firebase/database';
import { db } from '@/firebase';
import { RotateCcw, ChevronRight, LogOut, Users, Heart, Sparkles } from 'lucide-react';
import { recordPersonalGame } from '../../components/features/PersonalStats';
import { useGameLeave } from '@/hooks';
import { useGame } from '@/contexts/GameContext';
import { useGameUpdate } from '@/hooks';
import { useTranslation } from 'react-i18next';
import { LeaveConfirmModal } from '@/components/ui';
import { getRandomStatement } from './neverData';
import { NeonCard } from '@/components/ui';
import { GiantButton } from '@/components/ui';

const NeverHaveIEver: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');
  
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
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border border-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-fade-in">
        {errorMsg}
      </div>
    );
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
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in relative z-10 px-4">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        
        <NeonCard color="pink" className="p-8 flex flex-col items-center text-center max-w-sm w-full mx-auto">
          <div className="text-6xl animate-pulse mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">🙋</div>
          <h2 className="font-display font-black text-2xl text-white mb-2 uppercase tracking-widest">{t('neverHaveIEver.title') || 'ไม่เคย... (Never Have I Ever)'}</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">{t('neverHaveIEver.description') || 'ใครเคยทำสิ่งนี้... ต้องยอมรับมาซะดีๆ!'}</p>
          
          {isHost ? (
            <GiantButton color="pink" onClick={handleStart} className="w-full">
              {t('neverHaveIEver.startGame') || 'เริ่มเกมเลย!'}
            </GiantButton>
          ) : (
            <div className="p-4 rounded-2xl bg-pink-500/10 border border-pink-500/30 text-pink-400 font-bold animate-pulse w-full">
              {t('neverHaveIEver.waitingHost') || 'รอ Host เริ่มเกม...'}
            </div>
          )}
        </NeonCard>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col py-4 animate-fade-in relative z-10 px-2 max-w-lg mx-auto w-full">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      
      <div className="flex justify-between items-center mb-6 bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
        <span className="text-[11px] font-black text-pink-400 uppercase tracking-widest px-3 py-1 bg-pink-500/10 rounded-full border border-pink-500/30">
          {t('neverHaveIEver.round') || 'รอบที่'} {currentQIndex + 1}
        </span>
        <div className="flex items-center gap-1.5 text-slate-300 font-bold text-xs bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
          <Users size={14} className="text-neon-green" />
          {hasRespondedCount}/{players.length} {t('neverHaveIEver.responded') || 'ตอบแล้ว'}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6">
        <motion.div
          key={currentQIndex}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="p-8 flex flex-col items-center justify-center text-center gap-4 bg-slate-900/80 rounded-[32px] border border-pink-500/30 shadow-[0_0_30px_rgba(236,72,153,0.15)] min-h-[220px] relative overflow-hidden backdrop-blur-md"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-purple-500" />
          <Sparkles className="text-pink-400 absolute top-4 right-4 opacity-50" size={24} />
          
          <p className="text-[14px] font-black text-pink-400 uppercase tracking-widest drop-shadow-md">NEVER HAVE I EVER</p>
          <p className="text-[22px] font-black text-white leading-tight drop-shadow-md">
            {currentStatement}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-4">
          <motion.button
            whileTap={myResponse === undefined ? { scale: 0.95 } : {}}
            onClick={() => handleResponse(true)}
            className={`p-6 rounded-[24px] border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden ${
              myResponse === true 
                ? 'bg-pink-900/40 border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)]' 
                : myResponse !== undefined 
                  ? 'bg-slate-900 border-slate-800 opacity-50' 
                  : 'bg-slate-800/50 border-pink-500/30 hover:border-pink-400/50 shadow-sm'
            }`}
          >
            {myResponse === true && <div className="absolute inset-0 bg-pink-500/10 pointer-events-none" />}
            <span className="text-4xl drop-shadow-md z-10">🙋‍♂️</span>
            <span className={`font-black text-lg z-10 ${myResponse === true ? 'text-pink-300' : 'text-slate-200'}`}>
              {t('neverHaveIEver.ever') || 'เคยทำ'}
            </span>
            {myResponse !== undefined && (
              <span className="text-3xl font-black text-pink-400 z-10 mt-1">{everCount}</span>
            )}
          </motion.button>

          <motion.button
            whileTap={myResponse === undefined ? { scale: 0.95 } : {}}
            onClick={() => handleResponse(false)}
            className={`p-6 rounded-[24px] border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden ${
              myResponse === false 
                ? 'bg-neon-green/10 border-neon-green shadow-[0_0_20px_rgba(0,255,0,0.2)]' 
                : myResponse !== undefined 
                  ? 'bg-slate-900 border-slate-800 opacity-50' 
                  : 'bg-slate-800/50 border-neon-green/30 hover:border-neon-green/50 shadow-sm'
            }`}
          >
            {myResponse === false && <div className="absolute inset-0 bg-neon-green/10 pointer-events-none" />}
            <span className="text-4xl drop-shadow-md z-10">🙅‍♀️</span>
            <span className={`font-black text-lg z-10 ${myResponse === false ? 'text-neon-green' : 'text-slate-200'}`}>
              {t('neverHaveIEver.never') || 'ไม่เคย'}
            </span>
            {myResponse !== undefined && (
              <span className="text-3xl font-black text-neon-green z-10 mt-1">{neverCount}</span>
            )}
          </motion.button>
        </div>
        
        {myResponse !== undefined && (
          <div className="flex flex-wrap justify-center gap-2 mt-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
            {players.map(p => {
              const res = responses[p];
              if (res === undefined) return null;
              return (
                <div key={p} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border shadow-sm ${
                  res ? 'bg-pink-500/10 text-pink-400 border-pink-500/30' : 'bg-neon-green/10 text-neon-green border-neon-green/30'
                }`}>
                  {p === userNickname ? t('common.you') || 'คุณ' : p}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8 pb-10">
        {isHost && hasRespondedCount >= 1 && (
          <GiantButton color="pink" onClick={nextQuestion} className="w-full">
            {t('common.next') || 'ข้อถัดไป'}
            <ChevronRight size={20} strokeWidth={3} className="inline ml-1" />
          </GiantButton>
        )}
        {!isHost && myResponse !== undefined && (
          <div className="text-center p-4 rounded-xl bg-slate-900 border border-slate-800">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
              {t('neverHaveIEver.waitingHostNext') || 'รอ Host ไปข้อถัดไป...'}
            </p>
          </div>
        )}
      </div>

      {isHost && (
        <div className="mt-auto pt-4 pb-8 flex justify-center border-t border-slate-800/50">
          <button onClick={handleBackToLobby} className="flex items-center gap-2 text-[12px] font-bold text-slate-400 hover:text-white transition-colors bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700">
            <RotateCcw size={14} /> {t('common.backToLobby') || 'กลับ Lobby'}
          </button>
        </div>
      )}
    </div>
  );
};

export default NeverHaveIEver;

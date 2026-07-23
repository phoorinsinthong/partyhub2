// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { RotateCcw, Zap, Heart, ChevronRight, LogOut } from 'lucide-react';
import { recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGame } from '../contexts/GameContext';
import { useTranslation } from 'react-i18next';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { TRUTHS, DARES } from './logic/truthData';
import NeonCard from '../components/NeonCard';
import GiantButton from '../components/GiantButton';

const TruthOrDare: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  
  const [errorMsg, setErrorMsg] = useState('');
  const advancingRef = useRef(false);
  const drawingRef = useRef(false);

  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');

  const renderErrorToast = () => {
    if (!errorMsg) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border border-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-fade-in">
        {errorMsg}
      </div>
    );
  };

  useEffect(() => {
    recordPersonalGame('truthordare');
  }, []);

  if (!roomData) return null;

  const gameData = roomData?.gameData || {};
  const players = Object.keys(roomData?.players || {});
  const phase = gameData.phase || 'waiting';
  const currentTurnIndex = gameData.currentTurnIndex ?? 0;
  const currentTarget = players[currentTurnIndex % players.length] || '';
  const currentCard = gameData.currentCard || null;
  const cardType = gameData.cardType || '';

  const isMyTurn = userNickname === currentTarget;

  const safeUpdate = async (refPath: string, data: any) => {
    try {
      await update(ref(db, refPath), data);
    } catch {
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  const nextTurn = async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        currentTurnIndex: currentTurnIndex + 1,
        phase: 'waiting',
        currentCard: null,
        cardType: null,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const drawCard = async (type: 'truth' | 'dare') => {
    if (drawingRef.current) return;
    drawingRef.current = true;
    const pool = type === 'truth' ? TRUTHS : DARES;
    const card = pool[Math.floor(Math.random() * pool.length)];
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        currentCard: card,
        cardType: type,
      });
    } finally {
      drawingRef.current = false;
    }
  };

  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in bg-slate-950 text-slate-200 px-4">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        
        <div className="text-center space-y-4">
          <motion.div
            className="text-7xl drop-shadow-[0_0_20px_rgba(244,63,94,0.5)]"
            animate={{ scale: isMyTurn ? [1, 1.1, 1] : 1 }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {isMyTurn ? '🤔' : '👀'}
          </motion.div>
          <h2 className="font-black text-[28px] uppercase tracking-widest text-white drop-shadow-md leading-tight">
            {isMyTurn ? t('truthOrDare.yourTurn') || 'ตาของคุณแล้ว!' : t('truthOrDare.waitTurn', { name: currentTarget }) || `ตาของ ${currentTarget}`}
          </h2>
          <p className="text-slate-400 font-black text-[14px] uppercase tracking-widest bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl inline-block">
            {isMyTurn ? t('truthOrDare.chooseOne') || 'เลือกมาหนึ่งอย่าง...' : t('truthOrDare.waitingChoice') || 'กำลังเลือก...'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 w-full max-w-[280px] mt-4">
          <motion.button
            whileTap={isMyTurn ? { scale: 0.95 } : {}}
            onClick={() => isMyTurn && drawCard('truth')}
            disabled={!isMyTurn}
            className={`group relative overflow-hidden p-6 rounded-[32px] border-2 transition-all flex flex-col items-center gap-3 ${
              isMyTurn ? 'bg-blue-950/30 border-blue-500/50 hover:bg-blue-900/40 hover:border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.15)]' : 'bg-slate-900 border-slate-800 opacity-60'
            }`}
          >
            <div className={`w-16 h-16 rounded-2xl flex-center transition-transform group-active:scale-90 ${isMyTurn ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-slate-800 text-slate-500'}`}>
              <Zap size={36} fill="currentColor" />
            </div>
            <div className="text-center">
              <span className={`block font-black text-[24px] uppercase tracking-widest mb-1 ${isMyTurn ? 'text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'text-slate-400'}`}>{t('truthOrDare.truth') || 'TRUTH'}</span>
              <span className={`text-[12px] font-bold ${isMyTurn ? 'text-blue-300/70' : 'text-slate-600'}`}>{t('truthOrDare.truthDesc') || 'ตอบความจริง'}</span>
            </div>
          </motion.button>

          <motion.button
            whileTap={isMyTurn ? { scale: 0.95 } : {}}
            onClick={() => isMyTurn && drawCard('dare')}
            disabled={!isMyTurn}
            className={`group relative overflow-hidden p-6 rounded-[32px] border-2 transition-all flex flex-col items-center gap-3 ${
              isMyTurn ? 'bg-rose-950/30 border-rose-500/50 hover:bg-rose-900/40 hover:border-rose-400 shadow-[0_0_20px_rgba(225,29,72,0.15)]' : 'bg-slate-900 border-slate-800 opacity-60'
            }`}
          >
            <div className={`w-16 h-16 rounded-2xl flex-center transition-transform group-active:scale-90 ${isMyTurn ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_15px_rgba(225,29,72,0.3)]' : 'bg-slate-800 text-slate-500'}`}>
              <Heart size={36} fill="currentColor" />
            </div>
            <div className="text-center">
              <span className={`block font-black text-[24px] uppercase tracking-widest mb-1 ${isMyTurn ? 'text-rose-400 drop-shadow-[0_0_10px_rgba(225,29,72,0.5)]' : 'text-slate-400'}`}>{t('truthOrDare.dare') || 'DARE'}</span>
              <span className={`text-[12px] font-bold ${isMyTurn ? 'text-rose-300/70' : 'text-slate-600'}`}>{t('truthOrDare.dareDesc') || 'รับคำท้า'}</span>
            </div>
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col py-4 animate-fade-in bg-slate-950 text-slate-200 px-4">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      
      <div className="flex-center flex-col gap-6 flex-1">
        <NeonCard
          color={cardType === 'truth' ? 'blue' : 'rose'}
          className={`w-full max-w-sm p-8 flex flex-col items-center text-center gap-6 shadow-[0_0_40px_rgba(0,0,0,0.5)] ${
            cardType === 'truth' ? 'border-blue-500/50 bg-blue-950/20' : 'border-rose-500/50 bg-rose-950/20'
          }`}
        >
          {/* Background decoration */}
          <div className={`absolute -top-10 -right-10 w-48 h-48 rounded-full blur-3xl opacity-20 ${
            cardType === 'truth' ? 'bg-blue-500' : 'bg-rose-500'
          }`} />
          <div className={`absolute -bottom-10 -left-10 w-48 h-48 rounded-full blur-3xl opacity-20 ${
            cardType === 'truth' ? 'bg-blue-500' : 'bg-rose-500'
          }`} />
          
          <div className={`relative px-4 py-2 rounded-xl text-[12px] font-black uppercase tracking-widest border ${
            cardType === 'truth' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(225,29,72,0.3)]'
          }`}>
            {cardType === 'truth' ? 'TRUTH' : 'DARE'}
          </div>

          <p className="relative text-[24px] font-black text-white leading-tight drop-shadow-md">
            {currentCard}
          </p>

          <div className={`relative w-16 h-1.5 rounded-full ${cardType === 'truth' ? 'bg-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.5)]'}`} />
          
          <p className="relative text-[14px] font-black text-slate-300 uppercase tracking-widest bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-700">
            <span className={cardType === 'truth' ? 'text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]' : 'text-rose-400 drop-shadow-[0_0_5px_rgba(225,29,72,0.5)]'}>{currentTarget}</span> <br/>
            <span className="text-[10px] text-slate-500">{t('truthOrDare.mustDoIt') || 'ต้องทำสิ่งนี้!'}</span>
          </p>
        </NeonCard>

        {isHost && (
          <GiantButton
            color={cardType === 'truth' ? 'blue' : 'rose'}
            onClick={nextTurn}
            className="w-full max-w-sm mt-4"
          >
            {t('truthOrDare.done') || 'เรียบร้อย! คนถัดไป'}
            <ChevronRight size={20} strokeWidth={3} className="ml-2 inline-block mb-1" />
          </GiantButton>
        )}
        
        {!isHost && (
          <div className="mt-8 flex flex-col items-center gap-4 p-6 bg-slate-900/50 border border-slate-800 rounded-3xl w-full max-w-sm">
            <div className="w-8 h-8 border-4 border-slate-800 rounded-full animate-spin shadow-[0_0_15px_rgba(0,0,0,0.5)]" style={{ borderTopColor: cardType === 'truth' ? '#3b82f6' : '#e11d48' }} />
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 animate-pulse">{t('truthOrDare.waitingHostNext') || 'รอ Host เปลี่ยนคน...'}</p>
          </div>
        )}
      </div>

      {isHost && (
        <div className="mt-auto pt-8 pb-4 flex-center">
          <button onClick={handleBackToLobby} className="flex items-center justify-center gap-2 text-[12px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors bg-slate-900 px-6 py-3 rounded-2xl border border-slate-800 hover:border-slate-600 active:scale-95">
            <RotateCcw size={16} /> {t('common.backToLobby') || 'กลับ Lobby'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TruthOrDare;

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
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl animate-fade-in">
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
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        
        <div className="text-center space-y-2">
          <h2 className="font-display font-black text-[28px] text-olive-800 tracking-tight">
            {isMyTurn ? t('truthOrDare.yourTurn') || 'ตาของคุณแล้ว!' : t('truthOrDare.waitTurn', { name: currentTarget }) || `ตาของ ${currentTarget}`}
          </h2>
          <p className="text-olive-500 font-bold text-[15px]">
            {isMyTurn ? t('truthOrDare.chooseOne') || 'เลือกมาหนึ่งอย่าง...' : t('truthOrDare.waitingChoice') || 'กำลังเลือก...'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 w-full max-w-[280px]">
          <motion.button
            whileTap={isMyTurn ? { scale: 0.95 } : {}}
            onClick={() => isMyTurn && drawCard('truth')}
            disabled={!isMyTurn}
            className={`group relative overflow-hidden p-6 rounded-[32px] border-2 transition-all flex flex-col items-center gap-2 ${
              isMyTurn ? 'bg-white border-blue-100 shadow-sm active:shadow-inner' : 'bg-olive-50/50 border-transparent opacity-60'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex-center text-blue-500 group-active:scale-90 transition-transform">
              <Zap size={32} fill="currentColor" />
            </div>
            <span className="font-black text-blue-600 text-lg">{t('truthOrDare.truth') || 'TRUTH'}</span>
            <span className="text-[11px] font-bold text-blue-400/70">{t('truthOrDare.truthDesc') || 'ตอบความจริง'}</span>
          </motion.button>

          <motion.button
            whileTap={isMyTurn ? { scale: 0.95 } : {}}
            onClick={() => isMyTurn && drawCard('dare')}
            disabled={!isMyTurn}
            className={`group relative overflow-hidden p-6 rounded-[32px] border-2 transition-all flex flex-col items-center gap-2 ${
              isMyTurn ? 'bg-white border-rose-100 shadow-sm active:shadow-inner' : 'bg-olive-50/50 border-transparent opacity-60'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-50 flex-center text-rose-500 group-active:scale-90 transition-transform">
              <Heart size={32} fill="currentColor" />
            </div>
            <span className="font-black text-rose-600 text-lg">{t('truthOrDare.dare') || 'DARE'}</span>
            <span className="text-[11px] font-bold text-rose-400/70">{t('truthOrDare.dareDesc') || 'รับคำท้า'}</span>
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col py-4 animate-fade-in">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      
      <div className="flex-center flex-col gap-4 flex-1">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`card w-full max-w-sm p-8 flex flex-col items-center text-center gap-6 border-4 shadow-2xl relative overflow-hidden ${
            cardType === 'truth' ? 'border-blue-200' : 'border-rose-200'
          }`}
        >
          {/* Background decoration */}
          <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 ${
            cardType === 'truth' ? 'bg-blue-500' : 'bg-rose-500'
          }`} />
          
          <div className={`px-4 py-1.5 rounded-full text-[12px] font-black tracking-widest ${
            cardType === 'truth' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'
          }`}>
            {cardType === 'truth' ? 'TRUTH' : 'DARE'}
          </div>

          <p className="text-[22px] font-black text-olive-800 leading-tight">
            {currentCard}
          </p>

          <div className="w-12 h-1 bg-olive-100 rounded-full" />
          
          <p className="text-[13px] font-bold text-olive-400">
            {currentTarget} {t('truthOrDare.mustDoIt') || 'ต้องทำสิ่งนี้!'}
          </p>
        </motion.div>

        {isHost && (
          <button
            onClick={nextTurn}
            className="btn btn-primary w-full max-w-sm py-4 rounded-3xl text-lg mt-4 shadow-lg active:translate-y-1 transition-all"
          >
            {t('truthOrDare.done') || 'เรียบร้อย! คนถัดไป'}
            <ChevronRight size={20} strokeWidth={3} />
          </button>
        )}
        
        {!isHost && (
          <div className="mt-8 flex flex-col items-center gap-2 opacity-40">
            <p className="text-[13px] font-bold text-olive-400">{t('truthOrDare.waitingHostNext') || 'รอ Host เปลี่ยนคน...'}</p>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-olive-300 animate-bounce" />
              <div className="w-1.5 h-1.5 rounded-full bg-olive-300 animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-olive-300 animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      {isHost && (
        <div className="mt-auto pt-6 flex-center">
          <button onClick={handleBackToLobby} className="flex items-center gap-2 text-[12px] font-bold text-olive-300 hover:text-olive-500 transition-colors">
            <RotateCcw size={14} /> {t('common.backToLobby') || 'กลับ Lobby'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TruthOrDare;

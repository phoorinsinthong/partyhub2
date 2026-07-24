import React from 'react';
import { Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { TimerDisplay } from '@/components/game-ui';
import { NeonCard } from '@/components/ui';

interface PlayingPhaseProps {
  errorMsg: string | null;
  gameData: any;
  userNickname: string;
  isTargetChooser: boolean;
  isMyTurn: boolean;
  timeLeft: number | null;
  currentPlayer: string | null;
  currentPlayerIndex: number | null;
  handleMove: (increment: number) => void;
}

export const PlayingPhase: React.FC<PlayingPhaseProps> = ({
  errorMsg,
  gameData,
  userNickname,
  isTargetChooser,
  isMyTurn,
  timeLeft,
  currentPlayer,
  currentPlayerIndex,
  handleMove
}) => {
  const { t } = useTranslation();

  const renderErrorToast = () => {
    if (!errorMsg) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border border-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-fade-in">
        {errorMsg}
      </div>
    );
  };

  const playerOrder = gameData.playerOrder || [];
  const currentCount = gameData.currentCount || 0;
  const range = gameData.range || {};
  const lastMove = gameData.lastMove;

  return (
    <div className="flex flex-col gap-3 w-full animate-fade-in bg-slate-950 text-slate-200 pb-20 px-2">
      {renderErrorToast()}
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30">
            <Target size={20} />
          </div>
          <div>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{t('target.description').split(' ')[0] === 'ทาย' ? 'ตัวเลขปัจจุบัน' : 'Current Number'}</p>
            <p className="font-black text-3xl text-white font-mono">{currentCount}</p>
          </div>
        </div>
        <div className="text-right bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
          <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{t('taboo.currentScores').split(' ')[0] === 'คะแนน' ? 'คะแนนของคุณ' : 'Your Score'}</p>
          <p className="font-black text-rose-500 text-xl">{gameData.scores?.[userNickname] || 0}</p>
        </div>
      </div>

      {/* Hint Range */}
      {!isTargetChooser && (
        <NeonCard color="amber" className="p-4 text-center border-amber-500/30 bg-amber-950/20">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3">💡 {t('target.description').split(' ')[0] === 'ทาย' ? 'ช่วงตัวเลขใบ้' : 'Hint Range'}</p>
          <div className="flex items-center justify-center gap-4">
            <span className="bg-amber-500/20 text-amber-400 font-black text-3xl font-mono px-4 py-2 rounded-xl border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              {range.min}
            </span>
            <span className="text-slate-400 font-black text-[12px] uppercase tracking-widest">{t('target.description').split(' ')[0] === 'ทาย' ? 'ถึง' : 'to'}</span>
            <span className="bg-amber-500/20 text-amber-400 font-black text-3xl font-mono px-4 py-2 rounded-xl border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              {range.max}
            </span>
          </div>
        </NeonCard>
      )}

      {isTargetChooser && (
        <NeonCard color="purple" className="p-4 text-center border-purple-500/30 bg-purple-950/20">
          <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2">🤫 {t('target.targetIs', { number: '' }).trim()}</p>
          <p className="text-5xl font-black text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)] font-mono">{gameData.targetNumber}</p>
        </NeonCard>
      )}

      {/* Last Move */}
      <AnimatePresence mode="wait">
        {lastMove && (
          <motion.div
            key={`${lastMove.player}-${lastMove.numbers.join(',')}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-slate-900 border border-slate-800 p-4 text-center rounded-3xl"
          >
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">{t('target.description').split(' ')[0] === 'ทาย' ? 'เมื่อกี้' : 'Just now'}</p>
            <p className="font-bold text-[14px]">
              <span className="text-rose-400 font-black">{lastMove.player}</span> <span className="text-slate-400">{t('target.description').split(' ')[0] === 'ทาย' ? 'นับ' : 'counted'}</span>{' '}
              <span className="text-white font-black bg-slate-800 px-2 py-1 rounded border border-slate-700">
                {lastMove.numbers.join(', ')}
              </span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Turn Indicator */}
      <NeonCard color={isMyTurn ? 'emerald' : 'slate'} className={`p-4 text-center ${isMyTurn ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] bg-emerald-950/20' : 'border-slate-800 bg-slate-900'}`}>
        <div className="flex justify-center mb-3">
          <TimerDisplay timeLeft={timeLeft} />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
          {isMyTurn ? t('target.yourTurn') : t('target.waitTurn', { name: '' }).trim()}
        </p>
        <p className={`text-[16px] font-black uppercase tracking-widest ${isMyTurn ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'text-slate-300'}`}>
          {isMyTurn ? (t('target.description').split(' ')[0] === 'ทาย' ? 'เร็วเข้า! เลือกจำนวนเลขที่จะนับ' : 'Hurry! Select how many to count') : t('target.waitTurn', { name: currentPlayer })}
        </p>
      </NeonCard>

      {/* Controls */}
      {isMyTurn ? (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col gap-3 mt-2"
        >
          <p className="text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">🎮 {t('target.description').split(' ')[0] === 'ทาย' ? 'เลือกจำนวนเลขที่จะนับ' : 'Choose how many to count'}</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              className="bg-blue-950/30 p-4 flex flex-col items-center gap-2 border-2 border-blue-500/40 rounded-3xl active:scale-95 transition-all hover:bg-blue-900/40 hover:border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
              onClick={() => handleMove(1)}
            >
              <span className="text-3xl font-black text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">+1</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('target.description').split(' ')[0] === 'ทาย' ? 'นับ 1 ตัว' : 'Count 1'}</span>
              <span className="text-[11px] text-blue-300 font-bold bg-blue-900/50 px-2 py-0.5 rounded-full border border-blue-500/30">{currentCount + 1}</span>
            </button>
            <button
              className="bg-emerald-950/30 p-4 flex flex-col items-center gap-2 border-2 border-emerald-500/40 rounded-3xl active:scale-95 transition-all hover:bg-emerald-900/40 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
              onClick={() => handleMove(2)}
            >
              <span className="text-3xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">+2</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('target.description').split(' ')[0] === 'ทาย' ? 'นับ 2 ตัว' : 'Count 2'}</span>
              <span className="text-[11px] text-emerald-300 font-bold bg-emerald-900/50 px-2 py-0.5 rounded-full border border-emerald-500/30">{currentCount + 1}-{currentCount + 2}</span>
            </button>
            <button
              className="bg-amber-950/30 p-4 flex flex-col items-center gap-2 border-2 border-amber-500/40 rounded-3xl active:scale-95 transition-all hover:bg-amber-900/40 hover:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
              onClick={() => handleMove(3)}
            >
              <span className="text-3xl font-black text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">+3</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('target.description').split(' ')[0] === 'ทาย' ? 'นับ 3 ตัว' : 'Count 3'}</span>
              <span className="text-[11px] text-amber-300 font-bold bg-amber-900/50 px-2 py-0.5 rounded-full border border-amber-500/30">{currentCount + 1}-{currentCount + 3}</span>
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 p-6 flex-center flex-col gap-4 rounded-3xl mt-2">
          <div className="text-5xl animate-spin-slow">⏳</div>
          <p className="text-slate-400 font-black text-[11px] uppercase tracking-widest">{t('target.waitTurn', { name: currentPlayer })}</p>
        </div>
      )}

      {/* Player Order */}
      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl mt-2">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">{t('taboo.players')}</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {playerOrder.map((name: string, idx: number) => (
            <div
              key={name}
              className={`px-3 py-1.5 rounded-xl text-[10px] uppercase tracking-widest font-black flex items-center gap-2 ${
                idx === currentPlayerIndex
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {idx === currentPlayerIndex && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>}
              {name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

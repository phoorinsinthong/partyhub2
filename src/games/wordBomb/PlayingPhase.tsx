import React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { TimerDisplay } from '../../components/game-ui/TimerDisplay';
import LeaveConfirmModal from '../../components/ui/LeaveConfirmModal';
import GiantButton from '../../components/ui/GiantButton';

const MAX_LIVES = 3;

function LivesRow({ count, max = MAX_LIVES }: { count: number, max?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`text-[11px] ${i < count ? 'opacity-100' : 'opacity-20'}`}>
          ❤️
        </span>
      ))}
    </span>
  );
}

function BombDisplay({ timeLeft, bombTime, exploding }: { timeLeft: number, bombTime: number, exploding: boolean }) {
  const urgency = bombTime > 0 ? Math.max(0, 1 - timeLeft / bombTime) : 0;
  const shakeDuration = exploding ? 0.05 : Math.max(0.08, 0.45 - urgency * 0.37);
  const shakeAmount = exploding ? 10 : urgency * 7;
  const scale = exploding ? [1, 1.35, 0.1] : 1 + urgency * 0.08;

  return (
    <motion.div
      animate={
        exploding
          ? { scale, rotate: [0, -15, 15, 0], opacity: [1, 1, 0] }
          : {
              x: shakeAmount > 1
                ? [0, -shakeAmount, shakeAmount, -shakeAmount * 0.5, shakeAmount * 0.5, 0]
                : 0,
              scale,
            }
      }
      transition={
        exploding
          ? { duration: 0.4, ease: 'easeOut' }
          : {
              x: { duration: shakeDuration, repeat: Infinity, repeatType: 'loop', ease: 'easeInOut' },
              scale: { duration: 0.3 },
            }
      }
      className="select-none leading-none"
      style={{ fontSize: '64px', display: 'block', textAlign: 'center' }}
    >
      💣
    </motion.div>
  );
}

function TimerArc({ timeLeft, bombTime }: { timeLeft: number, bombTime: number }) {
  const radius = 38;
  const circ = 2 * Math.PI * radius;
  const progress = bombTime > 0 ? Math.max(0, timeLeft / bombTime) : 1;
  const offset = circ * (1 - progress);

  const color =
    progress > 0.5 ? '#10b981' : // emerald-500
    progress > 0.25 ? '#f59e0b' : // amber-500
    '#ef4444'; // red-500

  return (
    <svg width="96" height="96" className="absolute inset-0 m-auto" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
      <motion.circle
        cx="48" cy="48" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.25, ease: 'linear' }}
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      />
    </svg>
  );
}

interface PlayingPhaseProps {
  isHost: boolean;
  showConfirm: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
  roundNumber: number;
  category: string;
  timeLeft: number;
  bombTime: number;
  exploding: boolean;
  isMyTurn: boolean;
  activePlayer: string;
  categoryExamples: string;
  handleCorrectAnswer: () => void;
  handleNextCategory: () => void;
  turnOrder: string[];
  eliminated: string[];
  userNickname: string;
  lives: Record<string, number>;
  handleBackToLobby: () => void;
  t: (key: string, options?: any) => string;
}

export const PlayingPhase: React.FC<PlayingPhaseProps> = ({
  isHost,
  showConfirm,
  confirmLeave,
  cancelLeave,
  roundNumber,
  category,
  timeLeft,
  bombTime,
  exploding,
  isMyTurn,
  activePlayer,
  categoryExamples,
  handleCorrectAnswer,
  handleNextCategory,
  turnOrder,
  eliminated,
  userNickname,
  lives,
  handleBackToLobby,
  t,
}) => {
  return (
    <div className="flex-1 flex flex-col py-2 animate-fade-in bg-slate-950">
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      
      <div className="flex-between mb-4 px-4 pt-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">
            ROUND {roundNumber}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-black uppercase tracking-widest text-slate-300 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">{category}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <TimerDisplay timeLeft={timeLeft} />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-10 py-6 relative">
        <div className="relative w-full flex-center perspective-1000">
          <TimerArc timeLeft={timeLeft} bombTime={bombTime} />
          <BombDisplay timeLeft={timeLeft} bombTime={bombTime} exploding={exploding} />
        </div>

        <div className="text-center px-6">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{t('wordBomb.activePlayer') || 'ตาของ'}</p>
          <h3 className={`text-[28px] font-black uppercase tracking-widest drop-shadow-md ${isMyTurn ? 'text-red-500 animate-pulse' : 'text-slate-200'}`}>
            {isMyTurn ? t('common.you') || 'คุณเอง!' : activePlayer}
          </h3>
          <p className="text-[11px] font-bold text-slate-400 mt-3 bg-slate-900 px-4 py-2 rounded-xl inline-block border border-slate-800">
            {t('wordBomb.examples') || 'เช่น'}: <span className="text-slate-300">{categoryExamples}</span>
          </p>
        </div>

        {isHost && (
          <div className="flex flex-col gap-3 w-full max-w-sm px-6">
            <GiantButton
              color="green"
              onClick={handleCorrectAnswer}
              className="w-full"
            >
              ✅ {t('wordBomb.correct') || 'ตอบถูก! (เปลี่ยนคน)'}
            </GiantButton>
            <button
              onClick={handleNextCategory}
              className="w-full py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 active:scale-95 transition-all hover:border-slate-500 flex items-center justify-center gap-2"
            >
              🔄 {t('wordBomb.changeCategory') || 'เปลี่ยนหมวดใหม่'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-auto p-4 bg-slate-900/80 backdrop-blur-md border-t border-slate-800">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
          {turnOrder.map((p: string) => (
            <div key={p} className={`flex items-center justify-between gap-2 p-2 rounded-xl border ${activePlayer === p ? 'bg-slate-800 border-slate-700' : 'border-transparent'} ${eliminated.includes(p) ? 'opacity-30 grayscale' : ''}`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 border border-slate-900 ${activePlayer === p ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-slate-600'}`} />
                <span className={`text-[11px] font-black uppercase tracking-widest truncate ${activePlayer === p ? 'text-slate-200' : 'text-slate-400'}`}>{p === userNickname ? t('common.you') || 'คุณ' : p}</span>
              </div>
              <LivesRow count={lives[p] ?? MAX_LIVES} />
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <div className="flex-center bg-slate-950 pb-6 pt-2">
          <button onClick={handleBackToLobby} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors">
            <RotateCcw size={14} /> {t('common.backToLobby') || 'กลับ Lobby'}
          </button>
        </div>
      )}
    </div>
  );
};

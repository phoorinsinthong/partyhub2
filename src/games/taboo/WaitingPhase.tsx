import React from 'react';
import { motion } from 'framer-motion';
import { NeonCard } from '@/components/ui';
import { GiantButton } from '@/components/ui';

interface WaitingPhaseProps {
  renderErrorToast: () => React.ReactNode;
  t: (key: string, options?: any) => string;
  players: string[];
  ROUND_TIME: number;
  MAX_SKIPS: number;
  isHost: boolean;
  cardMode: string;
  setCardMode: (mode: string) => void;
  handleStartGame: () => void;
}

export const WaitingPhase: React.FC<WaitingPhaseProps> = ({
  renderErrorToast,
  t,
  players,
  ROUND_TIME,
  MAX_SKIPS,
  isHost,
  cardMode,
  setCardMode,
  handleStartGame,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 bg-slate-950 text-slate-200">
      {renderErrorToast()}
      <motion.div
        className="text-8xl drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]"
        animate={{ rotate: [0, -10, 10, -10, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
      >
        🤫
      </motion.div>
      <div className="text-center px-4">
        <h2 className="font-black text-[32px] uppercase tracking-widest text-slate-200 mb-2 drop-shadow-md">{t('taboo.title')}</h2>
        <p className="text-slate-400 text-[12px] font-bold leading-relaxed max-w-xs mx-auto">
          {t('taboo.description')}
        </p>
      </div>

      <NeonCard color="amber" className="p-4 w-full max-w-xs space-y-2 border-amber-500/30 bg-amber-900/10">
        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
          <span className="text-slate-500">{t('taboo.players')}</span>
          <span className="text-amber-500">{players.length} {t('common.people') || 'คน'}</span>
        </div>
        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
          <span className="text-slate-500">{t('taboo.roundTime')}</span>
          <span className="text-amber-500">{ROUND_TIME} {t('common.seconds') || 'วินาที'}</span>
        </div>
        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
          <span className="text-slate-500">{t('taboo.maxSkips')}</span>
          <span className="text-amber-500">{MAX_SKIPS} {t('common.times') || 'ครั้ง'}/{t('common.round') || 'รอบ'}</span>
        </div>
        <hr className="border-slate-800" />
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 space-y-1 mt-2">
          <p className="flex items-center gap-2"><span className="text-emerald-500 text-[14px]">🎯</span> {t('taboo.pointsDescriber')}</p>
          <p className="flex items-center gap-2"><span className="text-amber-500 text-[14px]">✅</span> {t('taboo.pointsGuesser')}</p>
        </div>
      </NeonCard>

      {isHost ? (
        <>
          <div className="w-full max-w-xs px-2 mt-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 text-center">{t('taboo.cardPack')}</p>
            <div className="flex gap-2">
              {[
                { id: 'all', label: t('taboo.cardPackAll') },
                { id: 'normal', label: t('taboo.cardPackNormal') },
                { id: 'funny', label: t('taboo.cardPackFunny') },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setCardMode(opt.id)}
                  className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    cardMode === opt.id
                      ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)] text-amber-400'
                      : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <GiantButton
            color="emerald"
            onClick={handleStartGame}
            className="w-full max-w-xs mt-4"
            disabled={players.length < 2}
          >
            {t('taboo.startGame')}
          </GiantButton>
          {players.length < 2 && (
            <p className="text-center text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-950/50 border border-red-500/30 p-2.5 rounded-xl w-full max-w-xs mt-2">
              {t('taboo.minPlayers')}
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 mt-8">
          <div className="w-8 h-8 border-4 border-slate-800 border-t-amber-500 rounded-full animate-spin shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 animate-pulse">{t('taboo.waitingHost')}</span>
        </div>
      )}
    </div>
  );
};

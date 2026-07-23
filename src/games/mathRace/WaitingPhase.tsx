import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Play } from 'lucide-react';
import NeonCard from '../../components/ui/NeonCard';
import GiantButton from '../../components/ui/GiantButton';
import { useTranslation } from 'react-i18next';

interface WaitingPhaseProps {
  isHost: boolean;
  players: string[];
  host: string;
  selectedDifficulty: string;
  setSelectedDifficulty: (d: string) => void;
  handleStart: () => void;
}

export const WaitingPhase: React.FC<WaitingPhaseProps> = ({
  isHost,
  players,
  host,
  selectedDifficulty,
  setSelectedDifficulty,
  handleStart,
}) => {
  const { t } = useTranslation();

  return (
    <>
        <div className="text-center py-6">
          <motion.div
            className="text-8xl drop-shadow-[0_0_20px_rgba(168,85,247,0.5)] mb-4"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🧮
          </motion.div>
          <h2 className="font-black text-[32px] uppercase tracking-widest text-white mb-2 drop-shadow-md">{t('mathrace.title')}</h2>
          <p className="text-slate-400 text-[12px] font-bold leading-relaxed max-w-xs mx-auto">{t('mathrace.description')}</p>
        </div>

        {isHost && (
          <NeonCard color="purple" className="p-4 mx-4 border-purple-500/30 bg-purple-900/10">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">{t('mathrace.difficulty')}</h3>
            <div className="flex gap-2">
              {[
                { key: 'easy', label: t('mathrace.difficultyEasy') },
                { key: 'medium', label: t('mathrace.difficultyMedium') },
                { key: 'hard', label: t('mathrace.difficultyHard') },
              ].map(d => (
                <button
                  key={d.key}
                  onClick={() => setSelectedDifficulty(d.key)}
                  className={`flex-1 rounded-2xl py-3 flex flex-col items-center gap-1 border transition-all active:scale-95 ${
                    selectedDifficulty === d.key
                      ? 'bg-purple-500/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                      : 'bg-slate-900 border-slate-700 opacity-60'
                  }`}
                >
                  <span className={`font-black text-[12px] uppercase tracking-widest ${selectedDifficulty === d.key ? 'text-purple-400' : 'text-slate-500'}`}>{d.label}</span>
                </button>
              ))}
            </div>
          </NeonCard>
        )}

        <div className="p-4 mx-4 bg-slate-900/50 border border-slate-800 rounded-3xl mt-2">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3 text-center">
            {t('taboo.players')} ({players.length})
          </h3>
          <div className="flex flex-wrap justify-center gap-2">
            {players.map(p => (
              <span key={p} className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-[11px] font-black uppercase tracking-widest text-slate-300">
                {p === host && <Crown size={12} className="inline mr-1 text-amber-500 mb-0.5" />}
                {p}
              </span>
            ))}
          </div>
        </div>

        {isHost ? (
          <div className="mt-auto px-4 pb-6 pt-2">
            <GiantButton
              color="purple"
              className="w-full"
              onClick={handleStart}
              disabled={players.length < 2}
            >
              <Play size={18} fill="currentColor" className="mr-2 inline-block mb-1" />
              {t('mathrace.startGame')}
            </GiantButton>
            {players.length < 2 && (
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-950/50 border border-red-500/30 p-2.5 rounded-xl mt-3">
                {t('taboo.minPlayers')}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 mt-8">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-purple-500 rounded-full animate-spin shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 animate-pulse">{t('mathrace.waitingHost')}</span>
          </div>
        )}
    </>
  );
};

export default WaitingPhase;

import React from 'react';
import { motion } from 'framer-motion';
import NeonCard from '../../components/ui/NeonCard';
import GiantButton from '../../components/ui/GiantButton';

interface ResultPhaseProps {
  t: any;
  renderErrorToast: () => React.ReactNode;
  caughtInsider: boolean | null;
  wordGuessed: boolean;
  insiderName: string;
  topVoted: string;
  secretWord: string;
  category: string;
  sortedScores: [string, unknown][];
  isHost: boolean;
  handleNextRound: () => void;
  roundNumber: number;
  nonHostPlayers: string[];
}

const ResultPhase: React.FC<ResultPhaseProps> = ({
  t,
  renderErrorToast,
  caughtInsider,
  wordGuessed,
  insiderName,
  topVoted,
  secretWord,
  category,
  sortedScores,
  isHost,
  handleNextRound,
  roundNumber,
  nonHostPlayers
}) => {
  return (
    <div className="flex-1 flex flex-col gap-4 py-4 animate-fade-in bg-slate-950 text-slate-200 px-4 h-full pb-24">
      {renderErrorToast()}
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mt-4">
        <span className={`text-6xl drop-shadow-[0_0_20px_rgba(${caughtInsider ? '16,185,129' : wordGuessed ? '168,85,247' : '239,68,68'},0.5)]`}>
          {caughtInsider ? '🎉' : wordGuessed ? '🕵️' : '⏰'}
        </span>
        <h3 className="font-black text-[24px] uppercase tracking-widest text-white mt-4 drop-shadow-md">
          {!wordGuessed ? t('taboo.timeUp') : caughtInsider ? t('insider.commonsWin') : t('insider.insiderWin')}
        </h3>
      </motion.div>

      <NeonCard color="purple" className="p-6 text-center border-purple-500/30 bg-purple-950/20 mt-2">
        <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-3">{t('insider.insiderWas', { name: '' }).trim()}</p>
        <p className="font-black text-[32px] text-white drop-shadow-[0_0_15px_rgba(168,85,247,0.5)] leading-tight">{insiderName}</p>
        {wordGuessed && topVoted && (
          <div className="mt-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400">
              {t('spyfall.spyGuessed').split(' ')[0] === 'สายลับ' ? 'โดนโหวตมากสุด' : 'Top Voted'}: <span className="font-black text-slate-200">{topVoted}</span>
              {caughtInsider ? ' ✅' : ' ❌'}
            </p>
          </div>
        )}
      </NeonCard>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl text-center">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{t('insider.secretWord')}</p>
        <p className="font-black text-[24px] text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">{secretWord}</p>
        <p className="text-[11px] font-bold text-slate-500 mt-1">{category}</p>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl">
        <h3 className="font-black text-[10px] text-slate-500 uppercase tracking-widest mb-3 text-center">📊 {t('taboo.currentScores')}</h3>
        <div className="space-y-2">
          {sortedScores.map(([name, score], idx) => (
            <div key={name as string} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-black text-slate-500 w-4">{idx + 1}</span>
              <span className="flex-1 font-black text-[13px] text-slate-300 uppercase tracking-widest flex items-center gap-2">
                {name as string}
                {name === insiderName && <span className="text-[8px] text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded-md">Insider</span>}
              </span>
              <span className="font-black text-[16px] text-emerald-400">{score as number}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50">
        {isHost ? (
          <GiantButton color="emerald" onClick={handleNextRound} className="w-full">
            {roundNumber >= nonHostPlayers.length ? t('taboo.viewResults') : t('taboo.nextRound')}
          </GiantButton>
        ) : (
          <div className="flex-center gap-3 py-3">
            <div className="w-5 h-5 border-2 border-slate-800 border-t-emerald-500 rounded-full animate-spin" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t('insider.waitingHost')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultPhase;

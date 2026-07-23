import React from 'react';
import { motion } from 'framer-motion';
import { Crown, RotateCcw, LogOut } from 'lucide-react';
import NeonCard from '../../components/ui/NeonCard';
import GiantButton from '../../components/ui/GiantButton';
import LeaveConfirmModal from '../../components/ui/LeaveConfirmModal';

interface FinishedPhaseProps {
  t: any;
  renderErrorToast: () => React.ReactNode;
  showConfirm: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
  topPlayer: [string, unknown] | undefined;
  sortedScores: [string, unknown][];
  isHost: boolean;
  handlePlayAgain: () => void;
  handleBackToLobby: () => void;
  requestLeave: () => void;
}

const FinishedPhase: React.FC<FinishedPhaseProps> = ({
  t,
  renderErrorToast,
  showConfirm,
  confirmLeave,
  cancelLeave,
  topPlayer,
  sortedScores,
  isHost,
  handlePlayAgain,
  handleBackToLobby,
  requestLeave
}) => {
  return (
    <div className="flex-1 flex flex-col gap-4 py-4 animate-fade-in bg-slate-950 text-slate-200 px-4 pb-24 h-full">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      
      <div className="text-center mt-6">
        <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }} className="text-6xl mb-4 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
          🏆
        </motion.div>
        <h2 className="font-black text-[28px] uppercase tracking-widest text-white drop-shadow-md">{t('quiz.finished')}</h2>
      </div>

      {topPlayer && (
        <NeonCard color="amber" className="p-8 text-center border-amber-500/50 bg-amber-950/20 shadow-[0_0_30px_rgba(245,158,11,0.15)] mt-4">
          <Crown size={32} className="text-amber-400 mx-auto mb-4 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
          <p className="font-black text-[10px] text-amber-500 uppercase tracking-widest mb-2">{t('spyfall.citizenWin').split(' ')[0] === 'พลเมือง' ? 'ผู้ชนะ' : 'Winner'}</p>
          <p className="font-black text-[32px] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] leading-tight">{topPlayer[0]}</p>
          <p className="text-[16px] font-black text-amber-400 mt-2">{topPlayer[1] as number} <span className="text-[10px] text-amber-500/70">{t('taboo.pointsGuesser').split(' ')[1]}</span></p>
        </NeonCard>
      )}

      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl mt-4">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 text-center">{t('taboo.totalScores')}</h3>
        <div className="space-y-2">
          {sortedScores.map(([name, score], idx) => (
            <div key={name as string} className={`flex justify-between items-center p-4 rounded-2xl border ${
              idx === 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl drop-shadow-md">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : <span className="text-slate-600 text-sm font-black w-8 text-center inline-block">#{idx + 1}</span>}</span>
                <span className={`font-black text-[14px] uppercase tracking-widest ${idx === 0 ? 'text-amber-400' : 'text-slate-300'}`}>{name as string}</span>
              </div>
              <span className={`font-black text-[18px] ${idx === 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{score as number}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50 flex gap-3">
        {isHost ? (
          <>
            <GiantButton color="emerald" className="flex-1" onClick={handlePlayAgain}>
              <RotateCcw size={18} className="mr-2 inline-block mb-0.5" />
              {t('taboo.playAgain')}
            </GiantButton>
            <button className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all hover:border-slate-500" onClick={handleBackToLobby}>
              <LogOut size={16} className="mr-2 inline-block mb-0.5" />
              {t('quiz.backToLobby')}
            </button>
          </>
        ) : (
          <button className="w-full py-4 text-[12px] font-black uppercase tracking-widest border border-red-500/50 bg-red-500/10 text-red-500 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-500/20" onClick={requestLeave}>
            <LogOut size={16} /> {t('taboo.leaveRoom')}
          </button>
        )}
      </div>
    </div>
  );
};

export default FinishedPhase;

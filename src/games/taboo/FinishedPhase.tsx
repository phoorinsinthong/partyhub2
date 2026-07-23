import React from 'react';
import { motion } from 'framer-motion';
import { Crown, LogOut, RotateCcw } from 'lucide-react';
import GiantButton from '../../components/GiantButton';
import LeaveConfirmModal from '../../components/LeaveConfirmModal';

interface FinishedPhaseProps {
  renderErrorToast: () => React.ReactNode;
  t: (key: string, options?: any) => string;
  showConfirm: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
  sortedScores: [string, unknown][];
  userNickname: string;
  isHost: boolean;
  handlePlayAgain: () => void;
  handleBackToLobby: () => void;
  requestLeave: () => void;
}

export const FinishedPhase: React.FC<FinishedPhaseProps> = ({
  renderErrorToast,
  t,
  showConfirm,
  confirmLeave,
  cancelLeave,
  sortedScores,
  userNickname,
  isHost,
  handlePlayAgain,
  handleBackToLobby,
  requestLeave,
}) => {
  const winner = sortedScores[0];
  
  return (
    <div className="flex-1 flex flex-col gap-4 py-4 bg-slate-950 pb-24 text-slate-200">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      <div className="text-center">
        <div className="text-7xl mb-2 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">🏆</div>
        <h2 className="font-black text-[28px] uppercase tracking-widest text-slate-200 mt-2 drop-shadow-md">{t('common.finished') || 'จบเกม!'}</h2>
      </div>

      {winner && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-6 text-center border-amber-500/50 bg-amber-900/20 mx-4 shadow-[0_0_30px_rgba(245,158,11,0.15)] rounded-3xl border"
        >
          <Crown size={32} className="text-amber-400 mx-auto mb-3 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
          <p className="font-black text-[18px] uppercase tracking-widest text-amber-500">{winner[0]}</p>
          <p className="text-[32px] font-black text-white drop-shadow-md">{winner[1] as number} {t('common.points') || 'คะแนน'}</p>
        </motion.div>
      )}

      <div className="p-4 mx-4 bg-slate-900/50 border border-slate-800 rounded-3xl backdrop-blur-sm">
        <h3 className="font-black text-[12px] uppercase tracking-widest text-slate-400 mb-4 text-center">📊 {t('taboo.totalScores')}</h3>
        <div className="space-y-3">
          {sortedScores.map(([name, score], idx) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.07 }}
              className="flex items-center gap-4 p-3 rounded-2xl bg-slate-900 border border-slate-800"
            >
              <span className={`w-8 h-8 rounded-xl flex-center text-[12px] font-black shrink-0 ${idx === 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/50' : idx === 2 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/50' : 'bg-slate-800 text-slate-500'}`}>
                {idx + 1}
              </span>
              <span className={`flex-1 font-black text-[14px] uppercase tracking-widest ${idx === 0 ? 'text-amber-400' : 'text-slate-300'}`}>{name}</span>
              <span className={`font-black text-[16px] ${idx === 0 ? 'text-white' : 'text-slate-400'}`}>{score as number}</span>
              {name === userNickname && (
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-md">{t('taboo.you')}</span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {isHost ? (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50 flex gap-3">
          <GiantButton color="emerald" onClick={handlePlayAgain} className="flex-1">
            <RotateCcw size={16} className="mr-2 inline-block" /> {t('taboo.playAgain')}
          </GiantButton>
          <button onClick={handleBackToLobby} className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:border-slate-500">
            <LogOut size={14} /> {t('taboo.backToLobby')}
          </button>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50">
          <button
            className="w-full py-4 text-[12px] font-black uppercase tracking-widest border border-red-500/50 bg-red-500/10 text-red-500 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-500/20"
            onClick={requestLeave}
          >
            <LogOut size={15} /> {t('taboo.leaveRoom')}
          </button>
        </div>
      )}
    </div>
  );
};

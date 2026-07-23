import React from 'react';
import { motion } from 'framer-motion';
import { Crown, RotateCcw, LogOut } from 'lucide-react';
import GiantButton from '../../components/ui/GiantButton';
import LeaveConfirmModal from '../../components/ui/LeaveConfirmModal';
import { useTranslation } from 'react-i18next';

interface FinishedPhaseProps {
  sortedScores: [string, any][];
  showConfirm: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
  host: string;
  isHost: boolean;
  handleReplay: () => void;
  requestLeave: () => void;
}

export const FinishedPhase: React.FC<FinishedPhaseProps> = ({
  sortedScores,
  showConfirm,
  confirmLeave,
  cancelLeave,
  host,
  isHost,
  handleReplay,
  requestLeave,
}) => {
  const { t } = useTranslation();
  const winner = sortedScores[0];

  return (
    <>
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        
        <div className="text-center mt-6">
          <div className="text-7xl mb-2 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">🏆</div>
          <h2 className="font-black text-[28px] uppercase tracking-widest text-white mt-2 drop-shadow-md">{t('common.finished') || 'จบเกม!'}</h2>
        </div>

        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 text-center border-amber-500/50 bg-amber-900/20 mx-4 shadow-[0_0_30px_rgba(245,158,11,0.15)] rounded-3xl border"
          >
            <Crown size={32} className="text-amber-400 mx-auto mb-3 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
            <p className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest mb-1">{t('spyfall.citizenWin').split(' ')[0] === 'พลเมือง' ? 'ผู้ชนะ' : 'Winner'}</p>
            <p className="font-black text-[24px] uppercase tracking-widest text-amber-400 drop-shadow-md">{winner[0]}</p>
            <p className="text-[32px] font-black text-white drop-shadow-md mt-1">{winner[1] as number} <span className="text-[16px] text-slate-400">{t('taboo.pointsGuesser').split(' ')[1]}</span></p>
          </motion.div>
        )}

        <div className="p-4 mx-4 bg-slate-900/50 border border-slate-800 rounded-3xl backdrop-blur-sm mt-4">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 text-center">{t('taboo.totalScores')}</h3>
          <div className="space-y-3">
            {sortedScores.map(([name, score], i) => (
              <div
                key={name}
                className="flex items-center gap-4 p-3 rounded-2xl bg-slate-900 border border-slate-800"
              >
                <div className="flex items-center gap-4">
                  <span className={`w-8 h-8 rounded-xl flex-center text-[12px] font-black shrink-0 ${i === 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : i === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/50' : i === 2 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/50' : 'bg-slate-800 text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <span className={`font-black text-[14px] uppercase tracking-widest ${i === 0 ? 'text-amber-400' : 'text-slate-300'}`}>{name}</span>
                  {name === host && <Crown size={12} className="text-amber-500" />}
                </div>
                <span className={`font-black text-[16px] ml-auto ${i === 0 ? 'text-white' : 'text-slate-400'}`}>{score as number}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50 flex gap-3">
          {isHost ? (
            <>
              <GiantButton color="purple" className="flex-1" onClick={handleReplay}>
                <RotateCcw size={18} className="mr-2 inline-block mb-0.5" />
                {t('taboo.playAgain')}
              </GiantButton>
              <button className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all hover:border-slate-500" onClick={requestLeave}>
                <LogOut size={16} className="mr-2 inline-block mb-0.5" />
                {t('taboo.leaveRoom')}
              </button>
            </>
          ) : (
            <button className="w-full py-4 text-[12px] font-black uppercase tracking-widest border border-red-500/50 bg-red-500/10 text-red-500 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-500/20" onClick={requestLeave}>
              <LogOut size={16} />
              {t('taboo.leaveRoom')}
            </button>
          )}
        </div>
    </>
  );
};

export default FinishedPhase;

import React from 'react';
import { Trophy, RotateCcw, Crown, Skull, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { LeaveConfirmModal } from '@/components/ui';
import { NeonCard } from '@/components/ui';
import { GiantButton } from '@/components/ui';

interface ResultPhaseProps {
  errorMsg: string | null;
  gameData: any;
  userNickname: string;
  showConfirm: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
  requestLeave: () => void;
  isHost: boolean;
  nextRound: () => void;
}

export const ResultPhase: React.FC<ResultPhaseProps> = ({
  errorMsg,
  gameData,
  userNickname,
  showConfirm,
  confirmLeave,
  cancelLeave,
  requestLeave,
  isHost,
  nextRound
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

  const loser = gameData.loser;
  const isLoser = loser === userNickname;
  const playerOrder = gameData.playerOrder || [];
  const winners = playerOrder.filter((n: string) => n !== loser);

  return (
    <div className="flex flex-col gap-4 w-full animate-fade-in bg-slate-950 text-slate-200 pb-24 h-full px-2">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center mt-6"
      >
        <div className="text-6xl mb-4 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">🎯</div>
        <h2 className="text-[28px] font-black mb-4 uppercase tracking-widest text-white drop-shadow-md">{t('target.gameOver')}</h2>

        {/* Loser */}
        <NeonCard color={isLoser ? 'rose' : 'slate'} className={`p-6 text-center mx-4 mb-4 ${isLoser ? 'border-rose-500/50 bg-rose-950/20 shadow-[0_0_30px_rgba(225,29,72,0.15)]' : 'border-slate-800 bg-slate-900/50'}`}>
          <div className="text-6xl mb-4">{isLoser ? '💥' : '💀'}</div>
          <h3 className={`text-[20px] font-black uppercase tracking-widest mb-4 ${isLoser ? 'text-rose-400 drop-shadow-[0_0_10px_rgba(225,29,72,0.5)]' : 'text-slate-300'}`}>
            {isLoser ? (t('target.description').split(' ')[0] === 'ทาย' ? 'ตู้ม! คุณระเบิดแล้ว' : 'BOOM! You Lost!') : t('target.loserIs', { name: loser })}
          </h3>
          <div className="flex items-center justify-center gap-3 mt-4">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('taboo.secretWordWas')}</span>
            <span className="bg-rose-500/20 text-rose-400 font-black text-3xl font-mono px-4 py-2 rounded-xl border border-rose-500/50 shadow-[0_0_15px_rgba(225,29,72,0.3)]">
              {gameData.targetNumber}
            </span>
          </div>
        </NeonCard>

        {/* Winners */}
        <div className="p-4 mx-4 rounded-3xl bg-emerald-950/20 border border-emerald-500/30 mb-4 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Trophy size={16} className="text-emerald-400" />
            <h4 className="font-black text-emerald-400 text-[10px] uppercase tracking-widest">{t('spyfall.citizenWin').split(' ')[0] === 'พลเมือง' ? 'ผู้รอดชีวิต' : 'Survivors'}</h4>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {winners.map((name: string) => (
              <span key={name} className="bg-emerald-500/10 text-emerald-300 font-black text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-lg border border-emerald-500/30">
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* Scores */}
        <div className="p-4 mx-4 bg-slate-900/50 border border-slate-800 rounded-3xl">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t('taboo.totalScores')}</p>
          <div className="space-y-2">
            {Object.entries(gameData.scores || {}).sort((a: any, b: any) => b[1] - a[1]).map(([name, score]) => (
              <div key={name} className="flex justify-between items-center p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  {name === loser ? <Skull size={16} className="text-rose-500" /> : <Crown size={16} className="text-amber-500" />}
                  <span className="font-black text-[12px] uppercase tracking-widest text-slate-300">{name}</span>
                </div>
                <span className="font-black text-amber-400 text-[14px] drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">{score as number} <span className="text-[10px] text-slate-500">{t('taboo.pointsGuesser').split(' ')[1]}</span></span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50 flex gap-3">
        {isHost ? (
          <>
            <GiantButton color="rose" className="flex-1" onClick={nextRound}>
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
            <LogOut size={16} /> {t('taboo.leaveRoom')}
          </button>
        )}
      </div>
    </div>
  );
};

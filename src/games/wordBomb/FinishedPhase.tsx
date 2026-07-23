import React from 'react';
import GiantButton from '../../components/ui/GiantButton';

interface FinishedPhaseProps {
  isHost: boolean;
  winner: string;
  handleStartGame: () => void;
  handleBackToLobby: () => void;
  t: (key: string, options?: any) => string;
}

export const FinishedPhase: React.FC<FinishedPhaseProps> = ({
  isHost,
  winner,
  handleStartGame,
  handleBackToLobby,
  t,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fade-in bg-slate-950 p-6">
      <div className="text-8xl drop-shadow-[0_0_30px_rgba(245,158,11,0.6)]">🏆</div>
      <div className="text-center">
        <h2 className="font-black text-[32px] uppercase tracking-widest text-slate-200 drop-shadow-md mb-2">{t('common.finished') || 'จบเกม!'}</h2>
        <p className="text-amber-500 font-black text-[18px] uppercase tracking-widest bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/30 inline-block shadow-[0_0_15px_rgba(245,158,11,0.2)]">{t('wordBomb.winnerIs', { name: winner }) || `ผู้ชนะคือ ${winner}`}</p>
      </div>
      {isHost && (
        <div className="flex flex-col gap-3 w-full max-w-xs mt-8">
          <GiantButton color="amber" onClick={handleStartGame}>
             เล่นอีกรอบ
          </GiantButton>
          <button onClick={handleBackToLobby} className="py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:border-slate-500">
             กลับ Lobby
          </button>
        </div>
      )}
    </div>
  );
};

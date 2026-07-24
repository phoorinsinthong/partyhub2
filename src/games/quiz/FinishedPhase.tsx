import React from 'react';
import { Crown, RotateCcw, LogOut } from 'lucide-react';
import { NeonCard } from '@/components/ui';
import { GiantButton } from '@/components/ui';
import { LeaveConfirmModal } from '@/components/ui';

interface FinishedPhaseProps {
  scores: Record<string, number>;
  showConfirm: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
  userNickname: string;
  isHost: boolean;
  handlePlayAgain: () => void;
  handleBackToLobby: () => void;
  requestLeave: () => void;
  renderErrorToast: () => React.ReactNode;
}

const FinishedPhase: React.FC<FinishedPhaseProps> = ({
  scores,
  showConfirm,
  confirmLeave,
  cancelLeave,
  userNickname,
  isHost,
  handlePlayAgain,
  handleBackToLobby,
  requestLeave,
  renderErrorToast,
}) => {
  const sortedScores = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));
  const winner = sortedScores[0];

  return (
    <div className="flex-1 flex flex-col gap-4 py-4 bg-slate-950 pb-24">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      <div className="text-center">
        <div className="text-7xl mb-2 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">🏆</div>
        <h2 className="font-black text-[28px] uppercase tracking-widest text-slate-200 mt-2 drop-shadow-md">จบเกม!</h2>
      </div>

      {/* Winner */}
      {winner && (
        <NeonCard color="amber" className="p-6 text-center border-amber-500/50 bg-amber-900/20 mx-4 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
          <Crown size={32} className="text-amber-400 mx-auto mb-3 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
          <p className="font-black text-[18px] uppercase tracking-widest text-amber-500">{winner[0]}</p>
          <p className="text-[32px] font-black text-white drop-shadow-md">{winner[1]} คะแนน</p>
        </NeonCard>
      )}

      {/* Scoreboard */}
      <div className="p-4 mx-4 bg-slate-900/50 border border-slate-800 rounded-3xl backdrop-blur-sm">
        <h3 className="font-black text-[12px] uppercase tracking-widest text-slate-400 mb-4 text-center">คะแนนรวม</h3>
        <div className="space-y-3">
          {sortedScores.map(([name, score], idx) => (
            <div key={name} className="flex items-center gap-4 p-3 rounded-2xl bg-slate-900 border border-slate-800">
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-black shrink-0 ${idx === 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/50' : idx === 2 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/50' : 'bg-slate-800 text-slate-500'}`}>
                {idx + 1}
              </span>
              <span className={`flex-1 font-black text-[14px] uppercase tracking-widest ${idx === 0 ? 'text-amber-400' : 'text-slate-300'}`}>{name}</span>
              <span className={`font-black text-[16px] ${idx === 0 ? 'text-white' : 'text-slate-400'}`}>{score as number}</span>
              {name === userNickname && (
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-md">คุณ</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50 flex gap-3">
          <GiantButton color="emerald" onClick={handlePlayAgain} className="flex-1">
            <RotateCcw size={16} className="mr-2 inline-block" /> เล่นอีกรอบ
          </GiantButton>
          <button onClick={handleBackToLobby} className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:border-slate-500">
            <LogOut size={14} /> กลับ Lobby
          </button>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50">
          <button
            className="w-full py-4 text-[12px] font-black uppercase tracking-widest border border-red-500/50 bg-red-500/10 text-red-500 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-500/20"
            onClick={requestLeave}
          >
            <LogOut size={15} /> ออกจากห้อง
          </button>
        </div>
      )}
    </div>
  );
};

export default FinishedPhase;

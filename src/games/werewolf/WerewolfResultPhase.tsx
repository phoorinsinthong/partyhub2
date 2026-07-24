import React from 'react';
import { Skull, CheckCircle2, Eye, LogOut } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useGameLeave } from '@/hooks';
import { useWerewolf } from './WerewolfContext';
import { useWerewolfActions } from './useWerewolfActions';
import { ROLES } from './werewolfData';
import { NeonCard } from '@/components/ui';
import { GiantButton } from '@/components/ui';
import { EpicPopup } from '@/components/ui';
import { LeaveConfirmModal } from '@/components/ui';

export const WerewolfResultPhase: React.FC = () => {
  const { roomId, userNickname, isHost } = useGame();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId || '', userNickname || '');
  const { wwData, safeUpdate } = useWerewolf();
  const { resetToLobby } = useWerewolfActions();

  const handlePlayAgain = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}/gameData/wwData`, { phase: 'setup', winnerTeam: null });
  };

  const winner = wwData.winnerTeam;
  const wwPlayers = wwData.players || {};

  const winnerColor = winner === 'werewolf' ? 'pink' : winner === 'villager' ? 'green' : 'slate'; // mapping red to pink, purple to slate (no purple in NeonCard)
  const winnerTitle = winner === 'werewolf' ? 'หมาป่าชนะ!' : winner === 'villager' ? 'ชาวบ้านชนะ!' : 'ฝ่ายอิสระชนะ!';
  const winnerDesc = winner === 'werewolf' ? 'หมู่บ้านตกอยู่ในความมืด...' : winner === 'villager' ? 'หมาป่าทุกตัวถูกกำจัด!' : 'ผู้เล่นอิสระบรรลุเป้าหมาย!';

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in pb-20 relative z-10 px-2 mt-8">
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      
      <EpicPopup
        isOpen={true}
        title={winnerTitle}
        subtitle={winnerDesc}
        icon={winner === 'werewolf' ? '🐺' : winner === 'villager' ? '🧑‍🌾' : '🎭'}
        onClose={() => {}} 
      />

      <NeonCard color="slate" className="p-4 space-y-3 mt-[320px]">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">เปิดเผยบทบาท</p>
        <div className="flex flex-col gap-2">
          {Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.role !== 'gm').map(([name, p]: [string, any]) => {
            const cfg = ROLES[p.role] || ROLES.villager;
            return (
              <div key={name} className={`flex justify-between items-center p-3 rounded-xl border ${p.isAlive ? 'bg-slate-800 border-slate-700' : 'bg-slate-900/80 border-slate-800 opacity-60'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl drop-shadow-md">{cfg.icon}</span>
                  <span className="font-bold text-sm text-white">{name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>{cfg.name}</span>
                  {!p.isAlive && <span className="text-red-500 text-xs ml-2">💀</span>}
                </div>
              </div>
            );
          })}
        </div>
      </NeonCard>

      {isHost ? (
        <div className="flex flex-col gap-3 w-full">
          <GiantButton color="pink" onClick={handlePlayAgain}>
            🔄 เล่นอีกครั้ง
          </GiantButton>
          <GiantButton color="slate" onClick={resetToLobby}>
            กลับสู่ล็อบบี้
          </GiantButton>
        </div>
      ) : (
        <GiantButton color="slate" onClick={requestLeave}>
          <LogOut size={18} /> ออกจากห้อง
        </GiantButton>
      )}
    </div>
  );
};

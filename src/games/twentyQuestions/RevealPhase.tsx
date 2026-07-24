import React from 'react';
import { Clock, Shuffle } from 'lucide-react';
import { NeonCard } from '@/components/ui';
import { GiantButton } from '@/components/ui';

interface RevealPhaseProps {
  t: any;
  renderErrorToast: () => React.ReactNode;
  roundNumber: number;
  nonHostPlayers: string[];
  isModerator: boolean;
  showCategory: boolean;
  category: string;
  secretWord: string;
  handleRerollWord: () => void;
  handleStartDiscussion: () => void;
  discussionTime: number;
  isInsider: boolean;
}

const RevealPhase: React.FC<RevealPhaseProps> = ({
  t,
  renderErrorToast,
  roundNumber,
  nonHostPlayers,
  isModerator,
  showCategory,
  category,
  secretWord,
  handleRerollWord,
  handleStartDiscussion,
  discussionTime,
  isInsider
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-6 animate-fade-in bg-slate-950 text-slate-200 px-4">
      {renderErrorToast()}
      <div className="text-[10px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/30 px-4 py-2 rounded-xl">
        {t('taboo.round')} {roundNumber}/{nonHostPlayers.length}
      </div>

      {isModerator && (
        <NeonCard color="amber" className="p-8 w-full max-w-xs text-center border-amber-500/30 bg-amber-950/20">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3">{t('insider.roleMaster')} 👑</p>
          {showCategory && <p className="text-[11px] font-bold text-slate-400 mb-4">{t('insider.category', { name: category })}</p>}
          <p className="font-black text-[36px] text-white drop-shadow-[0_0_15px_rgba(245,158,11,0.5)] mb-4 leading-tight">{secretWord}</p>
          <p className="text-[11px] font-medium text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800">{t('insider.roleMasterDesc').split('!')[1].trim()}</p>
          <div className="flex flex-col gap-3 mt-6 w-full">
            <button onClick={handleRerollWord} className="w-full py-4 text-[12px] font-black uppercase tracking-widest border border-amber-500/50 bg-amber-500/10 text-amber-400 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
              <Shuffle size={16} /> {t('spyfall.actualLocation').split(' ')[0] === 'สถานที่' ? 'สุ่มใหม่' : 'Reroll'}
            </button>
            <GiantButton color="emerald" onClick={handleStartDiscussion} className="w-full">
              <Clock size={20} className="mr-2 inline-block mb-1" /> {t('taboo.startNow')} ({Math.floor(discussionTime / 60)} {t('taboo.roundTime').includes('Time') ? 'min' : 'นาที'})
            </GiantButton>
          </div>
        </NeonCard>
      )}

      {isInsider && !isModerator && (
        <NeonCard color="purple" className="p-8 w-full max-w-xs text-center border-purple-500/30 bg-purple-950/20">
          <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-3">{t('insider.roleInsider')} 🕵️</p>
          {showCategory && <p className="text-[11px] font-bold text-slate-400 mb-4">{t('insider.category', { name: category })}</p>}
          <p className="font-black text-[36px] text-white drop-shadow-[0_0_15px_rgba(168,85,247,0.5)] mb-4 leading-tight">{secretWord}</p>
          <p className="text-[11px] font-medium text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800">{t('insider.roleInsiderDesc')}</p>
          <div className="flex flex-col items-center gap-3 mt-8">
            <div className="w-6 h-6 border-4 border-slate-800 border-t-purple-500 rounded-full animate-spin shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse">{t('insider.waitingHost')}</span>
          </div>
        </NeonCard>
      )}

      {!isModerator && !isInsider && (
        <NeonCard color="emerald" className="p-8 w-full max-w-xs text-center border-emerald-500/30 bg-emerald-950/20">
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3">{t('insider.roleCommon')} 🏘️</p>
          {showCategory && <p className="text-[11px] font-bold text-slate-400 mb-4">{t('insider.category', { name: category })}</p>}
          <p className="font-black text-[42px] text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] mb-4">???</p>
          <p className="text-[11px] font-medium text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800">{t('insider.roleCommonDesc')}</p>
          <div className="flex flex-col items-center gap-3 mt-8">
            <div className="w-6 h-6 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse">{t('insider.waitingHost')}</span>
          </div>
        </NeonCard>
      )}
    </div>
  );
};

export default RevealPhase;

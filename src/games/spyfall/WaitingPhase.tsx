import React from 'react';
import { Search, LogOut, MapPin, Clock, Shield } from 'lucide-react';
import NeonCard from '../../components/ui/NeonCard';
import GiantButton from '../../components/ui/GiantButton';
import { CAT_META } from './spyfallCats';
import { TIMER_PRESETS } from '../../hooks/useGameTimer';

export interface WaitingPhaseProps {
  renderErrorToast: () => React.ReactNode;
  requestLeave: () => void;
  selectedCats: string[];
  isHostActually: boolean;
  toggleCategory: (id: string) => void;
  timerMinutes: number;
  setTimerMinutes: (m: number) => void;
  enableAccomplice: boolean;
  setEnableAccomplice: (v: boolean) => void;
  startGame: () => void;
  playerCount: number;
  vibrateLight: () => void;
}

export const WaitingPhase: React.FC<WaitingPhaseProps> = ({
  renderErrorToast,
  requestLeave,
  selectedCats,
  isHostActually,
  toggleCategory,
  timerMinutes,
  setTimerMinutes,
  enableAccomplice,
  setEnableAccomplice,
  startGame,
  playerCount,
  vibrateLight
}) => {
  return (
    <div className="flex flex-col gap-4 w-full animate-fade-in relative z-10 px-2 py-4">
      {renderErrorToast()}
      
      <div className="flex-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-800 flex-center shadow-[0_0_15px_rgba(0,240,255,0.3)] border border-neon-blue">
            <Search size={20} className="text-neon-blue" />
          </div>
          <div>
            <h1 className="font-display text-[18px] font-black text-white tracking-wider uppercase">Spyfall</h1>
            <p className="text-neon-blue text-[11px] font-bold tracking-widest uppercase">Find the imposter</p>
          </div>
        </div>
        <button onClick={requestLeave} className="w-10 h-10 rounded-xl bg-slate-800 flex-center text-slate-400 hover:text-white border border-slate-700 active:scale-95">
          <LogOut size={18} />
        </button>
      </div>

      <NeonCard color="slate" className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3 mb-2">
          <MapPin size={18} className="text-neon-pink" />
          <h4 className="text-[12px] font-black uppercase tracking-widest text-white">Select Places ({selectedCats.length})</h4>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {CAT_META.map(cat => (
            <button
              key={cat.id}
              onClick={() => isHostActually && toggleCategory(cat.id)}
              className={`p-3 rounded-2xl border-2 transition-all text-left flex items-center gap-2 ${
                selectedCats.includes(cat.id)
                  ? 'border-neon-pink bg-neon-pink/10 shadow-[0_0_10px_rgba(255,20,147,0.3)]'
                  : 'border-slate-700 bg-slate-800/50 opacity-60'
              } ${!isHostActually && 'cursor-default pointer-events-none'}`}
            >
              <span className="text-xl">{cat.emoji}</span>
              <span className={`text-[12px] font-bold ${selectedCats.includes(cat.id) ? 'text-white' : 'text-slate-400'}`}>{cat.name}</span>
            </button>
          ))}
        </div>

        <div className="h-[1px] bg-slate-700 my-2" />

        <div className="flex items-center gap-3 mb-2">
          <Clock size={18} className="text-neon-blue" />
          <h4 className="text-[12px] font-black uppercase tracking-widest text-white">Timer</h4>
        </div>

        <div className="flex gap-2 flex-wrap mb-2">
          {TIMER_PRESETS.spyfall.map(opt => (
            <button
              key={opt.value}
              onClick={() => isHostActually && setTimerMinutes(opt.value)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black border-2 transition-all uppercase tracking-widest ${
                timerMinutes === opt.value
                  ? 'border-neon-blue bg-neon-blue/10 text-neon-blue shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400'
              } ${!isHostActually && 'cursor-default pointer-events-none'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="h-[1px] bg-slate-700 my-2" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-purple-500" />
            <div>
              <span className="text-[12px] font-black text-white uppercase tracking-widest">Accomplice Role</span>
              <p className="text-[10px] text-slate-400">ผู้สมรู้ร่วมคิด (4+ คน)</p>
            </div>
          </div>
          {isHostActually && (
            <button
              onClick={() => { vibrateLight(); setEnableAccomplice(!enableAccomplice); }}
              className={`w-12 h-6 rounded-full transition-all relative border-2 ${
                enableAccomplice ? 'bg-purple-600/30 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-slate-800 border-slate-600'
              }`}
            >
              <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${
                enableAccomplice ? 'left-[24px]' : 'left-[2px]'
              }`} />
            </button>
          )}
        </div>
      </NeonCard>

      {isHostActually ? (
        <GiantButton color="pink" className="mt-4" onClick={startGame} disabled={playerCount < 3}>
          {playerCount < 3 ? 'รอผู้เล่น (ขั้นต่ำ 3)' : `เริ่มเกม! (${playerCount} คน)`}
        </GiantButton>
      ) : (
        <div className="mt-4 p-4 rounded-2xl border border-neon-blue/30 bg-neon-blue/10 text-center shadow-[0_0_15px_rgba(0,240,255,0.2)]">
          <p className="animate-pulse text-neon-blue font-bold uppercase tracking-widest text-[12px]">Waiting for Host to start...</p>
        </div>
      )}
    </div>
  );
};

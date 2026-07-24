import React from 'react';
import { NeonCard } from '@/components/ui';
import { GiantButton } from '@/components/ui';

interface Props {
  renderErrorToast: () => React.ReactNode;
  players: string[];
  ROUND_TIME: Record<string, number>;
  difficulty: string;
  isHost: boolean;
  setDifficulty: (d: string) => void;
  handleStartGame: () => void;
}

const DrawingWaitingPhase: React.FC<Props> = ({
  renderErrorToast,
  players,
  ROUND_TIME,
  difficulty,
  isHost,
  setDifficulty,
  handleStartGame
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 bg-slate-950 text-slate-200">
      {renderErrorToast()}
      <div className="text-6xl animate-bounce-soft drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">🎨</div>
      <div className="text-center">
        <h2 className="font-black text-[28px] uppercase tracking-widest text-slate-200 mb-1 drop-shadow-md">วาดรูป<span className="text-emerald-500">ทายคำ</span></h2>
        <p className="text-slate-400 text-xs font-bold">คนวาด วาดรูป — คนเดา ทายให้ถูก!</p>
      </div>
      <NeonCard color="emerald" className="p-4 w-full max-w-xs text-center border-emerald-500/30 bg-emerald-900/10">
        <p className="text-[12px] font-black text-emerald-400 uppercase tracking-widest">{players.length} ผู้เล่น • {players.length} รอบ</p>
        <p className="text-[11px] font-bold text-slate-400 mt-1">{ROUND_TIME[difficulty as keyof typeof ROUND_TIME] || 60} วินาที/รอบ</p>
      </NeonCard>
      {isHost ? (
        <>
          <div className="text-center w-full max-w-xs mt-4">
            <p className="text-[11px] font-black text-slate-500 mb-3 uppercase tracking-widest">เลือกระดับความยาก</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'easy', label: 'ง่าย', icon: '🟢', color: 'emerald' },
                { id: 'medium', label: 'กลาง', icon: '🟡', color: 'amber' },
                { id: 'hard', label: 'ยาก', icon: '🔴', color: 'red' },
                { id: 'funny', label: 'ฮาๆ', icon: '🤪', color: 'fuchsia' },
                { id: 'random', label: 'สุ่ม', icon: '🎲', color: 'blue' },
                { id: 'custom', label: 'กำหนดเอง', icon: '✏️', color: 'purple' },
              ].map(d => {
                const colorMap: Record<string, { active: string; text: string }> = {
                  emerald: { active: 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]', text: 'text-emerald-400' },
                  amber: { active: 'bg-amber-500/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]', text: 'text-amber-400' },
                  red: { active: 'bg-red-500/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]', text: 'text-red-400' },
                  fuchsia: { active: 'bg-fuchsia-500/20 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.3)]', text: 'text-fuchsia-400' },
                  blue: { active: 'bg-blue-500/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]', text: 'text-blue-400' },
                  purple: { active: 'bg-purple-500/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]', text: 'text-purple-400' },
                };
                const colors = colorMap[d.color] || colorMap.blue;
                return (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  className={`p-3 rounded-2xl border transition-all active:scale-95 ${
                    difficulty === d.id ? colors.active : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <span className="text-2xl block mb-1 drop-shadow-sm">{d.icon}</span>
                  <span className={`font-black text-[10px] tracking-wide uppercase ${difficulty === d.id ? colors.text : 'text-slate-400'}`}>{d.label}</span>
                </button>
                );
              })}
            </div>
          </div>

          {difficulty === 'custom' && (
            <div className="p-3 w-full max-w-xs text-center border border-purple-500/30 rounded-2xl bg-purple-900/10 mt-2">
              <p className="text-[11px] font-black text-purple-400 uppercase tracking-widest">
                ✏️ คนวาดแต่ละรอบจะพิมพ์คำเอง
              </p>
            </div>
          )}

          <GiantButton color="emerald" onClick={handleStartGame} disabled={players.length < 2} className="mt-6 px-10">
            🎨 เริ่มเกม!
          </GiantButton>
        </>
      ) : (
        <p className="text-slate-500 font-black uppercase tracking-widest text-xs mt-8 animate-pulse">รอ Host เริ่มเกม...</p>
      )}
      {players.length < 2 && isHost && (
        <p className="text-center text-[10px] font-black text-red-500 uppercase tracking-widest mt-2 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">ต้องมีอย่างน้อย 2 คน</p>
      )}
    </div>
  );
};

export default DrawingWaitingPhase;

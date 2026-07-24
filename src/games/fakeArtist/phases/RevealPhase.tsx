import React from 'react';
import { NeonCard } from '@/components/ui';
import { GiantButton } from '@/components/ui';

export const RevealPhase = ({
  iAmFakeArtist, secretSyllables, secretWord, colorMap, userNickname,
  isHost, handleStartDrawing
}) => (
  <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-200 animate-fade-in">
    <h2 className="font-black text-[22px] uppercase tracking-widest text-slate-300 mb-6 drop-shadow-md">บทบาทของคุณ</h2>
    {iAmFakeArtist ? (
      <NeonCard color="red" className="w-full max-w-sm p-8 text-center bg-red-900/20 border-red-500/50">
        <div className="text-6xl mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]">🎭</div>
        <p className="font-black text-red-500 text-[24px] uppercase tracking-widest drop-shadow-md">คุณคือศิลปินปลอม!</p>
        <p className="text-red-400 text-sm font-bold mt-3 leading-relaxed">คุณไม่รู้คำ — วาดตามคนอื่นไป อย่าให้ใครจับได้!</p>
        <p className="text-[12px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 inline-block px-4 py-2 rounded-xl mt-6 uppercase tracking-widest shadow-[0_0_10px_rgba(245,158,11,0.3)]">
          💡 ใบ้: {secretSyllables} พยางค์
        </p>
      </NeonCard>
    ) : (
      <NeonCard color="emerald" className="w-full max-w-sm p-8 text-center bg-emerald-900/20 border-emerald-500/50">
        <div className="text-6xl mb-4 drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]">🎨</div>
        <p className="font-black text-emerald-400 text-[20px] uppercase tracking-widest drop-shadow-md">คุณคือศิลปินตัวจริง</p>
        <p className="text-emerald-500/70 text-[12px] font-black uppercase tracking-widest mt-6">คำที่ต้องวาด:</p>
        <p className="font-black text-[36px] text-white mt-1 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">{secretWord}</p>
      </NeonCard>
    )}
    <div className="flex items-center gap-3 justify-center mt-8 p-3 bg-slate-900 rounded-2xl border border-slate-800">
      <div className="w-6 h-6 rounded-full border-2 border-slate-300 shadow-[0_0_10px_rgba(255,255,255,0.2)]" style={{ backgroundColor: colorMap[userNickname || ''] }} />
      <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">สีของคุณ</span>
    </div>
    {isHost ? (
      <GiantButton color="amber" onClick={handleStartDrawing} className="w-full max-w-xs mt-8">
        เริ่มวาด!
      </GiantButton>
    ) : (
      <p className="text-slate-500 font-black uppercase tracking-widest text-xs mt-8 animate-pulse">รอ Host กดเริ่มวาด...</p>
    )}
  </div>
);

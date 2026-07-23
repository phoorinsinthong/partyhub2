import React from 'react';
import { Moon, Sun, CheckCircle2, Skull, Users, LogOut } from 'lucide-react';
import { useGame } from '../../contexts/GameContext';
import { useGameLeave } from '../../hooks/useGameLeave';
import { useWerewolf } from './WerewolfContext';
import { useWerewolfActions } from './useWerewolfActions';
import { WerewolfNightPhase } from './WerewolfNightPhase';
import NeonCard from '../../components/ui/NeonCard';
import GiantButton from '../../components/ui/GiantButton';

export const WerewolfPhysicalMode: React.FC = () => {
  const { roomId, userNickname } = useGame();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId || '', userNickname || '');
  const { wwData, phase, isGM, myIsAlive, dayCount } = useWerewolf();
  const { togglePlayerAlive, startNextNight, announceWinner, resetToLobby } = useWerewolfActions();
  
  const wwPlayers = wwData.players || {};

  const phaseLabel = phase === 'night' ? `🌙 คืนที่ ${dayCount}` : phase === 'day' ? `☀️ กลางวันที่ ${dayCount}` : phase === 'voting' ? '🗳️ ถึงเวลาโหวต!' : '🎭 รอเริ่มรอบ';

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in pb-32 z-10 relative px-2">
      
      <NeonCard color={phase === 'night' ? 'blue' : phase === 'day' ? 'amber' : phase === 'voting' ? 'pink' : 'slate'} className="p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {phase === 'night' ? <Moon className="text-indigo-400" size={24} /> : <Sun className="text-amber-400" size={24} />}
          <p className="font-display font-black text-xl text-white uppercase tracking-widest">{phaseLabel}</p>
        </div>
        <div className="text-right">
          {isGM ? <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">GM Dashboard</span> : (
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${myIsAlive ? 'bg-neon-green/10 text-neon-green border-neon-green/30' : 'bg-red-500/10 text-red-500 border-red-500/30'}`}>
              {myIsAlive ? 'ยังมีชีวิต' : 'ตายแล้ว'}
            </span>
          )}
        </div>
      </NeonCard>

      {isGM ? (
        <NeonCard color="amber" className="p-5 space-y-4">
          <h3 className="font-black flex items-center gap-2 text-amber-500 uppercase tracking-widest text-[11px] mb-4">🕹️ ควบคุมเกม (ไพ่จริง)</h3>

          {/* Manual Life/Death Grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.role !== 'gm').map(([name, p]: [string, any]) => (
              <button
                key={name}
                onClick={() => togglePlayerAlive(name, !p.isAlive)}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  p.isAlive ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-500' : 'bg-red-500/10 border-red-500/30 text-red-500 opacity-70'
                }`}
              >
                <span className="text-sm font-bold truncate flex-1 text-left">{name}</span>
                {p.isAlive ? <CheckCircle2 size={16} className="text-neon-green" /> : <Skull size={16} />}
              </button>
            ))}
          </div>

          {/* Phase Rendering */}
          {phase === 'night' && <WerewolfNightPhase />}

          {phase === 'day' && (
            <div className="space-y-4 border-t border-slate-700 pt-4">
              <NeonCard color="amber" className="text-center p-6 bg-amber-400/10">
                <p className="text-lg font-black text-amber-400 mb-2 flex justify-center gap-2"><Sun size={20} /> โหวตแขวนคอ</p>
                <p className="text-[11px] text-slate-300 mb-6 leading-relaxed">ให้ทุกคนอภิปรายและโหวตแขวนคอ 1 คน <br/> <strong className="text-white">แตะที่ชื่อด้านล่างเพื่อประหารผู้เล่นที่ถูกโหวต</strong></p>
                
                <div className="grid grid-cols-2 gap-2 text-left">
                  {Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.role !== 'gm' && p.isAlive).map(([name]) => (
                    <button
                      key={name}
                      onClick={() => {
                        if(confirm(`ยืนยันการแขวนคอ ${name} ใช่หรือไม่?`)) {
                           togglePlayerAlive(name, false);
                        }
                      }}
                      className="flex justify-between items-center p-3 bg-slate-900/50 border border-amber-500/30 rounded-xl hover:border-red-500 hover:bg-red-500/20 active:scale-95 transition-all text-white group"
                    >
                       <span className="font-bold text-sm truncate">{name}</span>
                       <span className="text-xl opacity-40 group-hover:opacity-100 group-hover:text-red-500 drop-shadow-md">🪢</span>
                    </button>
                  ))}
                </div>
              </NeonCard>
              
              <GiantButton color="slate" onClick={startNextNight}>
                🌙 ข้ามโหวต / เริ่มคืนถัดไป
              </GiantButton>
            </div>
          )}

          {/* Manual Winner Buttons */}
          <div className="border-t border-slate-700 pt-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">ประกาศผลผู้ชนะ / สรุปเกม</p>
            <div className="flex gap-2">
              <button className="flex-1 py-2 px-1 bg-slate-900 border border-neon-green/30 text-[10px] font-bold text-neon-green rounded-xl" onClick={() => announceWinner('villager')}>🏘️ ชาวบ้านชนะ</button>
              <button className="flex-1 py-2 px-1 bg-slate-900 border border-red-500/30 text-[10px] font-bold text-red-500 rounded-xl" onClick={() => announceWinner('werewolf')}>🐺 หมาป่าชนะ</button>
              <button className="flex-1 py-2 px-1 bg-slate-900 border border-purple-400/30 text-[10px] font-bold text-purple-400 rounded-xl" onClick={() => announceWinner('independent')}>🎭 อิสระชนะ</button>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4 mt-4">
            <button 
              className="w-full py-3 bg-slate-900 font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 rounded-xl flex items-center justify-center transition-all active:scale-95 text-sm" 
              onClick={async () => {
                if(confirm('ต้องการจบเกมและกลับสู่ล็อบบี้ใช่หรือไม่?')) {
                  await resetToLobby();
                }
              }}
            >
              <LogOut size={16} className="inline mr-2" /> จบเกม (กลับสู่ล็อบบี้)
            </button>
          </div>
        </NeonCard>
      ) : (
        <NeonCard color={myIsAlive ? 'slate' : 'pink'} className="p-8 text-center flex flex-col items-center">
          <div className="text-6xl animate-pulse mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
            {phase === 'night' ? '🌙' : '☀️'}
          </div>
          <h3 className="text-2xl font-black text-white mb-2">
            {phase === 'night' ? 'ถึงเวลากลางคืน' : 'ถึงเวลากลางวัน'}
          </h3>
          <p className="text-slate-400 text-sm mb-6">
            {phase === 'night' ? 'หลับตาลงและทำตามที่ GM บอก...' : 'ลืมตาขึ้นและพูดคุยหาตัวหมาป่า!'}
          </p>
          <div className={`p-4 rounded-2xl border-2 w-full mb-6 ${myIsAlive ? 'bg-neon-green/5 border-neon-green/30 text-neon-green shadow-[0_0_15px_rgba(0,255,0,0.1)]' : 'bg-red-500/5 border-red-500/30 text-red-500 shadow-[0_0_15px_rgba(255,0,0,0.1)]'}`}>
            <p className="font-black tracking-widest uppercase text-sm">{myIsAlive ? '🟢 คุณยังมีชีวิตอยู่' : '💀 คุณเสียชีวิตแล้ว'}</p>
          </div>
          
          <div className="pt-6 w-full border-t border-slate-700">
            <GiantButton color="slate" onClick={requestLeave}>
              <LogOut size={16} /> ออกจากห้อง
            </GiantButton>
          </div>
        </NeonCard>
      )}

      {/* Player List Sidebar */}
      <NeonCard color="slate" className="p-4 mt-6">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Users size={14}/> ผู้เล่นทั้งหมด ({Object.values(wwPlayers).filter((p: any) => p.role !== 'gm').length} คน)</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.role !== 'gm').map(([name, p]: [string, any]) => (
            <span key={name} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border ${!p.isAlive ? 'opacity-40 line-through bg-slate-900 border-slate-800 text-slate-500' : 'bg-slate-800 border-slate-700 text-white shadow-sm'}`}>
              {!p.isAlive && '💀 '}{name}
            </span>
          ))}
        </div>
      </NeonCard>
    </div>
  );
};

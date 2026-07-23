import React from 'react';
import { Moon, Eye, Skull } from 'lucide-react';
import { useWerewolf } from './WerewolfContext';
import { useWerewolfActions } from './useWerewolfActions';
import GiantButton from '../../components/GiantButton';
import { VOICE_SCRIPTS, ROLES } from './werewolfData';
import { resolveNightActions, WOLF_ROLES } from './werewolfLogic';

export const WerewolfNightPhase: React.FC = () => {
  const { wwData, isGM, myRole, myIsAlive, dayCount, activeScriptIndex, setActiveScriptIndex, safeUpdate } = useWerewolf();
  const { clearSeerResults, resolveNightToDay, gmSubmitForRole, togglePlayerAlive, updatePlayerRole, submitNightAction } = useWerewolfActions();
  
  const wwPlayers = wwData.players || {};
  const nightActions = wwData.nightActions || {};

  // GM View
  if (isGM) {
    return (
      <div className="space-y-4 border-t border-slate-700 pt-4 animate-fade-in">
        <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-center mb-4">
           <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-1">Night Step Manager</p>
           <p className="text-[10px] text-slate-400">เรียกบทบาทตามลำดับด้านล่าง และบันทึกผลการกระทำ</p>
        </div>

        {/* Seer Quick View for GM */}
        {wwData.lastSeerResult && (
          <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/30 flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
               <Eye size={16} className="text-purple-400" />
               <span className="text-[11px] text-white">ผลการส่องล่าสุด: <strong>{wwData.lastSeerResult.targetName}</strong> คือ <strong>{wwData.lastSeerResult.isWolf ? '🐺 หมาป่า!' : '🏘️ ชาวบ้าน'}</strong></span>
            </div>
            <button onClick={clearSeerResults} className="text-[10px] text-slate-400 hover:text-white underline">ล้าง</button>
          </div>
        )}

        <div className="space-y-4 border-t border-slate-700 pt-4">
          <p className="text-sm font-bold text-indigo-300 flex items-center gap-2"><Moon size={16} /> ขั้นตอนการเรียกบทบาท (Physical):</p>
          <div className="bg-slate-900/40 rounded-xl p-4 border border-indigo-500/20 space-y-4">
            {(() => {
              const deckRoles = Object.entries(wwData.deckCounts || {}).filter(([, c]) => (c as number) > 0).map(([r]) => r);
              const actionRoles = Object.keys(ROLES).filter(r => 
                deckRoles.includes(r) && 
                (ROLES[r].actionPhase === 'nightly' || (ROLES[r].actionPhase === 'firstNight' && dayCount === 1))
              );
              
              const activeRoles = actionRoles.sort((a, b) => {
                if (ROLES[a].team !== ROLES[b].team) return ROLES[a].team === 'werewolf' ? -1 : 1;
                return a.localeCompare(b);
              });

              return (
                <div className="space-y-6">
                  <div className="p-3 bg-indigo-500/10 rounded-xl text-center border border-indigo-500/20 shadow-inner">
                    <p className="text-[11px] font-black text-indigo-300 uppercase tracking-widest">1. ทุกคนหลับตาลง</p>
                  </div>

                  {activeRoles.map((roleKey, idx) => {
                    const role = ROLES[roleKey];
                    const rolePlayers = Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.role === roleKey && p.role !== 'gm');
                    const deckCount = (wwData.deckCounts || {})[roleKey] || 0;
                    const isCurrentStep = activeScriptIndex === idx;
                    
                    return (
                      <div 
                        key={roleKey} 
                        onClick={() => setActiveScriptIndex(idx)}
                        className={`space-y-2 border-l-4 pl-3 py-2 transition-all cursor-pointer ${
                          isCurrentStep ? 'border-indigo-500 bg-indigo-500/10 shadow-lg' : 'border-indigo-500/20 opacity-60'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-bold flex items-center gap-1" style={{ color: role.color }}>
                            {idx + 2}. {role.icon} {role.name} ลืมตาขึ้นมา... <span className="text-xs opacity-70">({rolePlayers.length}/{deckCount} คน)</span>
                          </p>
                          {isCurrentStep && <span className="px-1 py-0.5 bg-indigo-500 text-[8px] font-black text-white rounded uppercase">Active</span>}
                        </div>
                        
                        {VOICE_SCRIPTS[roleKey] && isCurrentStep && (
                          <div className="p-1 bg-white/5 rounded border border-white/10 text-[11px] text-yellow-400 italic px-2 animate-pulse">
                            🎤 "{VOICE_SCRIPTS[roleKey]}"
                          </div>
                        )}
                        
                        {isCurrentStep && (
                          <>
                            <p className="text-[10px] text-indigo-300/80 mb-1">ระบุเป้าหมาย (หากต้องการให้ระบบช่วยจำ):</p>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.role !== 'gm' && p.isAlive).map(([name]) => {
                                const isSelected = roleKey === 'cupid' 
                                  ? nightActions['cupidTarget']?.split(',').includes(name)
                                  : nightActions[`${roleKey}Target`] === name;
                                  
                                return (
                                  <button
                                    key={name}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (roleKey === 'cupid') {
                                        const current = nightActions['cupidTarget'] ? nightActions['cupidTarget'].split(',') : [];
                                        let next;
                                        if (current.includes(name)) {
                                          next = current.filter((t: string) => t !== name);
                                        } else {
                                          next = [...current, name].slice(-2);
                                        }
                                        gmSubmitForRole('cupid', next.join(','));
                                      } else {
                                        gmSubmitForRole(roleKey, nightActions[`${roleKey}Target`] === name ? 'skip' : name);
                                      }
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                      isSelected ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
                                    }`}
                                  >
                                    {name}
                                  </button>
                                );
                              })}
                            </div>

                            <p className="text-[10px] text-indigo-300/80 mb-1">ระบุผู้ถือบทบาทนี้ (ถ้ายังไม่ได้ระบุ):</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.role !== 'gm').map(([name, p]: [string, any]) => {
                                const isThisRole = p.role === roleKey;
                                return (
                                  <button
                                    key={name}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updatePlayerRole(name, isThisRole ? 'villager' : roleKey);
                                    }}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all shadow-sm active:scale-95 ${
                                      isThisRole ? 'bg-indigo-500 border-indigo-400 text-white shadow-indigo-500/20' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                                    }`}
                                  >
                                    {name}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  <div className="p-3 bg-amber-400/10 rounded-xl text-center mt-4 border border-amber-400/20 shadow-inner">
                    <p className="text-[11px] font-black text-amber-300 uppercase tracking-widest">{activeRoles.length + 2}. ทุกคนลืมตาขึ้น... เข้าสู่ตอนเช้า</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Night Kill Section */}
        <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20 space-y-4 mt-4">
          <p className="text-[12px] font-black text-red-400 flex items-center gap-2 uppercase tracking-widest"><Skull size={16} /> บันทึกผู้เสียชีวิตในคืนนี้</p>
          
          {(() => {
            const result = resolveNightActions(nightActions, { 
              players: wwPlayers, 
              lovers: wwData.lovers, 
              hunterPending: wwData.hunterPending 
            });
            if (!result.finalEliminated || result.finalEliminated.length === 0) return null;
            return (
              <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/40 mb-2">
                <p className="text-[10px] font-black text-red-400 uppercase mb-2">💡 ระบบวิเคราะห์ผู้ตาย:</p>
                {(result.finalEliminated as string[]).map(name => (
                  <div key={name} className="flex justify-between items-center mb-2 last:mb-0">
                     <span className="text-[12px] font-bold text-white">{name}</span>
                     <button 
                       onClick={() => togglePlayerAlive(name, false)}
                       className="px-3 py-1 bg-red-500 text-white font-black text-[10px] rounded-lg shadow-sm"
                     >
                       ยืนยันการตาย
                     </button>
                  </div>
                ))}
              </div>
            );
          })()}

          <p className="text-[10px] text-red-300/80 leading-tight mb-2">แตะที่ชื่อผู้เล่นเพื่อทำการยืนยันการตาย (สามารถกดซ้ำที่กริดด้านบนเพื่อยกเลิกได้)</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.role !== 'gm' && p.isAlive).map(([name]) => (
              <button
                key={name}
                onClick={() => {
                  if(confirm(`ยืนยันการสังหาร ${name} ในคืนนี้ใช่หรือไม่?`)) {
                     togglePlayerAlive(name, false);
                  }
                }}
                className="flex justify-between items-center p-3 bg-slate-800 border border-red-500/30 rounded-xl hover:bg-red-500/20 active:scale-95 transition-all text-white group"
              >
                 <span className="font-bold text-sm truncate">{name}</span>
                 <span className="text-lg opacity-50 group-hover:opacity-100 group-hover:text-red-500 drop-shadow-md">🔪</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <GiantButton color="amber" onClick={resolveNightToDay}>
            ☀️ ประกาศผลตอนเช้า
          </GiantButton>
        </div>
      </div>
    );
  }

  // Player View - Only show if alive
  if (myIsAlive) {
    const cfg = ROLES[myRole];
    if (!cfg || cfg.actionPhase === 'none' || (cfg.actionPhase === 'firstNight' && dayCount > 1)) {
       return (
         <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center">
           <p className="text-indigo-400 font-bold mb-2">หลับตาลง...</p>
           <p className="text-xs text-indigo-300/70">คุณไม่มี Action ใดๆ ในคืนนี้ โปรดรอจนกว่าจะเช้า</p>
         </div>
       );
    }

    const actionKey = myRole === 'minion' ? 'werewolf' : myRole; // Simplified minion check
    const isDone = !!nightActions[`${actionKey}TargetDone`];
    const targets = Object.entries(wwPlayers).filter(([n, p]: [string, any]) => p.isAlive && p.role !== 'gm');

    return (
      <div className="space-y-4 border-t border-slate-700 pt-4 animate-fade-in">
        <div className={`p-4 rounded-xl border ${isDone ? 'bg-slate-800/50 border-slate-700' : 'bg-indigo-500/10 border-indigo-500/30'}`}>
          <h4 className="text-[12px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2 mb-3">
            <Moon size={16}/> เลือกเป้าหมายของคุณ
          </h4>
          
          {!isDone ? (
            <div className="flex flex-wrap gap-2">
              {targets.map(([name]) => (
                <button
                  key={name}
                  onClick={() => submitNightAction(myRole, name)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 text-white font-bold rounded-lg hover:border-indigo-400 active:scale-95"
                >
                  {name}
                </button>
              ))}
              <button
                onClick={() => submitNightAction(myRole, 'skip')}
                className="px-3 py-2 bg-slate-900 border border-slate-700 text-slate-400 font-bold rounded-lg hover:text-white"
              >
                ข้าม
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-neon-green font-bold text-sm mb-2">✅ บันทึกการกระทำแล้ว</p>
              <p className="text-[10px] text-slate-400">โปรดรอคนอื่นๆ และ GM...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Dead Player View
  return (
    <div className="mt-4 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-center">
      <p className="text-red-400 font-bold uppercase tracking-widest text-[12px] flex items-center justify-center gap-2">
        <Skull size={16}/> คุณตายแล้ว
      </p>
      <p className="text-[10px] text-slate-400 mt-2">โปรดรอเช้าวันใหม่เพื่อติดตามสถานการณ์</p>
    </div>
  );
};

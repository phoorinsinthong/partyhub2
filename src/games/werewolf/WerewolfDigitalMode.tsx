import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Users, Eye, Skull, CheckCircle2, Shield, Heart, LogOut, Info } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useGameLeave } from '@/hooks';
import { useWerewolf } from './WerewolfContext';
import { useWerewolfActions } from './useWerewolfActions';
import { WerewolfRoleReveal } from './WerewolfRoleReveal';
import { StarsBackground, AmbientMist } from './WerewolfVFX';
import { ROLES, VOICE_SCRIPTS } from './werewolfData';
import { WOLF_ROLES, resolveNightActions } from './werewolfLogic';
import { NeonCard } from '@/components/ui';
import { GiantButton } from '@/components/ui';
import { TimerDisplay } from '@/components/game-ui';

// Dummy components for VFX until we pass them in or extract them


export const WerewolfDigitalMode: React.FC = () => {
  const { roomId, userNickname } = useGame();
  const { requestLeave } = useGameLeave(roomId || '', userNickname || '');
  const { wwData, phase, isGM, myIsAlive, myRole, myPlayerData, dayCount, activeScriptIndex, setActiveScriptIndex, safeUpdate, setShowRoleReveal } = useWerewolf();
  const { 
    togglePlayerAlive, updatePlayerRole, clearSeerResults, resolveNightToDay, gmSubmitForRole, submitNightAction, 
    announceWinner, resetToLobby, startNextNight, startVotingPhase, castVote, resolveVotes, gmSkipVote 
  } = useWerewolfActions();
  
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  
  const wwPlayers = wwData.players || {};
  const nightActions = wwData.nightActions || {};
  const roleInfo = ROLES[myRole];
  
  const phaseLabel = phase === 'night' ? `🌙 คืนที่ ${dayCount}` : phase === 'day' ? `☀️ กลางวันที่ ${dayCount}` : phase === 'voting' ? '🗳️ ถึงเวลาโหวต!' : '🎭 รอเริ่มรอบ';
  const timeLeft = 0; // timer logic should be in a hook

  const renderErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl animate-fade-in">
      {errorMsg}
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in pb-32 relative z-10 px-2">
      {renderErrorToast()}
      <StarsBackground />
      <AmbientMist />
      <WerewolfRoleReveal />
      {/* VFX Overlay not extracted yet */}

      {/* Phase Banner */}
      <NeonCard color={phase === 'night' ? 'blue' : phase === 'day' ? 'amber' : phase === 'voting' ? 'pink' : 'slate'} className="p-4 flex justify-between items-center mt-4">
        <div className="flex items-center gap-3">
          {phase === 'night' ? <Moon className="text-indigo-400" size={24} /> : phase === 'day' ? <Sun className="text-amber-400" size={24} /> : <Users className="text-red-400" size={24} />}
          <div>
            <p className="font-display font-black text-xl text-white uppercase tracking-widest leading-none">{phaseLabel}</p>
          </div>
          {wwData.timerEnd && (
            <div className="ml-2">
              <TimerDisplay timeLeft={timeLeft} />
            </div>
          )}
        </div>
        <div className="text-right flex items-center justify-end gap-2">
          {!isGM && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${myIsAlive ? 'bg-neon-green/10 border-neon-green/30 text-neon-green' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
              <span className="text-xl drop-shadow-md">{roleInfo?.icon || '🎭'}</span>
              <span className="text-[10px] font-black uppercase tracking-widest">
                {myIsAlive ? 'ยังมีชีวิต' : 'ตายแล้ว'}
              </span>
            </div>
          )}
          {isGM && <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">GM</span>}
        </div>
      </NeonCard>

      {/* Last Elimination Banner */}
      {wwData.lastElimination && wwData.lastElimination.playerName && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <NeonCard color="pink" className="p-4 text-center bg-red-500/10">
            <p className="text-red-400 font-black text-sm uppercase tracking-widest">
              {wwData.lastElimination.reason === 'vote' && `🗳️ ${wwData.lastElimination.playerName} ถูกโหวตไล่ออก!`}
              {wwData.lastElimination.reason === 'prince_saved' && `👑 ${wwData.lastElimination.playerName} ถูกโหวต แต่เจ้าชายรอดชีวิต!`}
              {wwData.lastElimination.reason === 'tie' && '🗳️ โหวตเสมอ! ไม่มีผู้ถูกกำจัด'}
              {wwData.lastElimination.reason === 'skipped' && '⏭️ GM ข้ามรอบโหวต'}
            </p>
          </NeonCard>
        </motion.div>
      )}

      {/* GM Panel */}
      {isGM && (
        <NeonCard color="amber" className="p-5 space-y-4">
          <h3 className="font-black flex items-center gap-2 text-amber-500 text-[11px] uppercase tracking-widest">🎭 แผงควบคุม GM</h3>

          {/* Player Status Table */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">สถานะผู้เล่น</p>
            {Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.role !== 'gm').map(([name, p]: [string, any]) => {
              const cfg = ROLES[p.role] || ROLES.villager;
              const isDead = !p.isAlive;
              return (
                <div key={name} className={`flex items-center gap-2 p-3 rounded-xl border ${isDead ? 'bg-slate-900/50 border-slate-800 opacity-60' : 'bg-slate-800 border-slate-700'}`}>
                  <span className="text-xl drop-shadow-md">{cfg.icon}</span>
                  <span className="flex-1 text-sm font-bold truncate text-white">{name}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>{cfg.name}</span>
                  {p.status?.silenced && <span className="text-sm">🤐</span>}
                  {p.status?.banned && <span className="text-sm">🚫</span>}
                  {p.status?.lover && <span className="text-sm">💘</span>}
                  <button
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ml-2 transition-all active:scale-95 shadow-sm ${isDead ? 'bg-neon-green/20 text-neon-green hover:bg-neon-green/30' : 'bg-red-500 text-white hover:bg-red-400'}`}
                    onClick={() => togglePlayerAlive(name, isDead)}
                  >
                    {isDead ? 'ชุบ' : 'ฆ่า'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Night Controls */}
          {phase === 'night' && (
            <div className="space-y-4 border-t border-slate-700 pt-4">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Moon size={14}/> บทบาทคืนนี้ (GM เลือกให้)</p>
              {(() => {
                // Only include roles where at least one alive player has that role
                const activeRoles = Array.from(new Set(
                  Object.values(wwPlayers)
                    .filter((p: any) => p.isAlive && p.role !== 'gm')
                    .map((p: any) => p.role)
                    .filter(role => {
                      const cfg = ROLES[role];
                      return cfg && (cfg.actionPhase === 'nightly' || (cfg.actionPhase === 'firstNight' && dayCount === 1));
                    })
                ));

                // Collapse alive wolf roles into one "werewolf" action key
                const wolfPresent = activeRoles.some(r => WOLF_ROLES.includes(r));
                const nonWolfRoles = activeRoles.filter(r => !WOLF_ROLES.includes(r));
                const actionKeys = wolfPresent ? ['werewolf', ...nonWolfRoles] : nonWolfRoles;

                // Alive non-GM players as target options
                const targets = Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.isAlive && p.role !== 'gm');

                return actionKeys.map(actionKey => {
                  const cfg = ROLES[actionKey] || ROLES.villager;
                  const isDone = !!nightActions[`${actionKey}TargetDone`];
                  const chosenTarget = nightActions[`${actionKey}Target`];

                  // Label & color per action type
                  let actionLabel = 'เลือกเป้าหมาย';
                  const doneLabel = `→ ${chosenTarget === 'skip' ? 'ข้าม' : chosenTarget}`;
                  let cardBorder = 'border-indigo-500/30';
                  let cardBg = 'bg-indigo-500/5';
                  if (WOLF_ROLES.includes(actionKey)) { actionLabel = '🔪 ฆ่า'; cardBorder = 'border-red-500/30'; cardBg = 'bg-red-500/5'; }
                  else if (actionKey === 'bodyguard') { actionLabel = '🛡️ ปกป้อง'; cardBorder = 'border-neon-green/30'; cardBg = 'bg-neon-green/5'; }
                  else if (['seer', 'apprentice_seer', 'mystic_wolf', 'aura_seer'].includes(actionKey)) { actionLabel = '🔮 ส่อง'; cardBorder = 'border-purple-500/30'; cardBg = 'bg-purple-500/5'; }

                  return (
                    <div key={actionKey} className={`rounded-xl p-3 border ${cardBorder} ${cardBg}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>
                          {cfg.icon} {WOLF_ROLES.includes(actionKey) ? 'หมาป่า' : cfg.name} — {actionLabel}
                        </span>
                        {isDone && (
                          <span className="text-[10px] font-black text-neon-green bg-neon-green/10 px-2 py-0.5 rounded-full border border-neon-green/20">✅ {doneLabel}</span>
                        )}
                      </div>
                      {!isDone ? (
                        <div className="flex flex-wrap gap-2">
                          {targets.map(([name]) => (
                            <button
                              key={name}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold border border-slate-600 bg-slate-800 text-white active:scale-95 transition-all shadow-sm hover:border-slate-400"
                              onClick={() => gmSubmitForRole(actionKey, name)}
                            >
                              {name}
                            </button>
                          ))}
                          <button
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold border border-slate-700 bg-slate-900 text-slate-400 active:scale-95 transition-all hover:text-white"
                            onClick={() => gmSubmitForRole(actionKey, 'skip')}
                          >
                            ข้าม
                          </button>
                        </div>
                      ) : (
                        <button
                          className="text-[10px] text-slate-400 underline hover:text-white"
                          onClick={async () => {
                            await safeUpdate(`rooms/${roomId}/gameData/wwData`, {
                              [`nightActions/${actionKey}Target`]: null,
                              [`nightActions/${actionKey}TargetDone`]: null,
                            });
                          }}
                        >
                          เปลี่ยนใจ
                        </button>
                      )}
                    </div>
                  );
                });
              })()}

              {/* Night summary: killed / protected / seen */}
              {(() => {
                const killed = nightActions['werewolfTarget'];
                const protected_ = nightActions['bodyguardTarget'];
                const seen = nightActions['seerTarget'] || nightActions['apprentice_seerTarget'] || nightActions['mystic_wolfTarget'] || nightActions['aura_seerTarget'];
                const seenRole = seen && seen !== 'skip' ? wwData.players?.[seen]?.role : null;
                const isWolf = seenRole ? (WOLF_ROLES.includes(seenRole) && seenRole !== 'wolf_man') || seenRole === 'lycan' : false;

                if (!killed && !protected_ && !seen) return null;
                return (
                  <div className="bg-slate-900/50 rounded-xl p-4 space-y-2 border border-slate-700">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">สรุปคืนนี้ (มองเห็นแค่ GM)</p>
                    {killed && killed !== 'skip' && (
                      <p className="text-xs font-bold text-red-500">🔪 หมาป่าฆ่า: <span className="text-white">{killed}</span>
                        {protected_ === killed && <span className="text-neon-green ml-2">→ ถูกปกป้อง! รอด</span>}
                      </p>
                    )}
                    {protected_ && protected_ !== 'skip' && (
                      <p className="text-xs font-bold text-neon-green">🛡️ บอดี้การ์ดปกป้อง: <span className="text-white">{protected_}</span></p>
                    )}
                    {seen && seen !== 'skip' && seenRole && (
                      <p className={`text-xs font-bold ${isWolf ? 'text-red-500' : 'text-neon-green'}`}>
                        🔮 ส่อง: <span className="text-white">{seen}</span> = {isWolf ? '🐺 หมาป่า' : '✅ ไม่ใช่หมาป่า'} ({ROLES[seenRole]?.name || seenRole})
                      </p>
                    )}
                  </div>
                );
              })()}

              <GiantButton color="amber" onClick={resolveNightToDay}>
                ☀️ เข้าสู่กลางวัน
              </GiantButton>
            </div>
          )}

          {/* Day Controls */}
          {phase === 'day' && (
            <div className="border-t border-slate-700 pt-4">
              <GiantButton color="pink" onClick={startVotingPhase}>
                🗳️ เริ่มโหวต
              </GiantButton>
            </div>
          )}

          {/* Voting Controls */}
          {phase === 'voting' && (
            <div className="space-y-4 border-t border-slate-700 pt-4">
              <p className="text-[11px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2"><Users size={14}/> ผลโหวตปัจจุบัน</p>
              <div className="flex flex-col gap-2">
                {Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.isAlive && p.role !== 'gm').map(([name]) => {
                  const voteCount = Object.values(wwPlayers).filter((pp: any) => pp.vote === name).reduce((acc: number, pp: any) => acc + (pp.role === 'mayor' ? 2 : 1), 0);
                  return voteCount > 0 ? (
                    <div key={name} className="flex justify-between items-center p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <span className="text-sm font-bold text-white">{name}</span>
                      <span className="text-red-500 font-black text-xs px-2 py-1 bg-red-500/20 rounded-lg">{voteCount} โหวต</span>
                    </div>
                  ) : null;
                })}
              </div>
              <div className="flex flex-col gap-3 mt-4">
                <GiantButton color="pink" onClick={resolveVotes}>✅ อนุมัติผลโหวต</GiantButton>
                <GiantButton color="slate" onClick={gmSkipVote}>⏭️ ข้าม</GiantButton>
              </div>
            </div>
          )}

          {/* Standby Controls */}
          {phase === 'standby' && (
            <div className="space-y-4 border-t border-slate-700 pt-4">
              <GiantButton color="blue" onClick={startNextNight}>
                🌙 เริ่มคืนถัดไป
              </GiantButton>
              <div className="border-t border-slate-700 pt-4 mt-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">จบเกมล่วงหน้า</p>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 px-1 bg-slate-900 border border-neon-green/30 text-[10px] font-bold text-neon-green rounded-xl active:scale-95 transition-all" onClick={() => announceWinner('villager')}>🏘️ ชาวบ้าน</button>
                  <button className="flex-1 py-2 px-1 bg-slate-900 border border-red-500/30 text-[10px] font-bold text-red-500 rounded-xl active:scale-95 transition-all" onClick={() => announceWinner('werewolf')}>🐺 หมาป่า</button>
                  <button className="flex-1 py-2 px-1 bg-slate-900 border border-purple-400/30 text-[10px] font-bold text-purple-400 rounded-xl active:scale-95 transition-all" onClick={() => announceWinner('independent')}>🎭 อิสระ</button>
                </div>
              </div>
            </div>
          )}
        </NeonCard>
      )}

      {/* Player View */}
      {!isGM && (
        <div className="space-y-4 w-full">
          {/* Role Card */}
          <NeonCard 
            color="slate" 
            className="p-4 flex items-center gap-4 cursor-pointer active:scale-95 transition-all" 
            onClick={() => setShowRoleReveal(true)}
            style={{ borderLeft: `6px solid ${roleInfo?.color || '#666'}` }}
          >
            <div className="text-4xl drop-shadow-md">{roleInfo?.icon || '❓'}</div>
            <div className="flex-1">
              <p className="font-display font-black text-xl uppercase tracking-widest" style={{ color: roleInfo?.color, textShadow: `0 0 10px ${roleInfo?.color}40` }}>{roleInfo?.name || 'ไม่ทราบ'}</p>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">{roleInfo?.description || ''}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-800 flex-center">
              <Info size={16} className="text-slate-400" />
            </div>
          </NeonCard>

          {/* Wolf allies */}
          {WOLF_ROLES.includes(myRole) && (
            <NeonCard color="pink" className="p-3 bg-red-500/10 border-red-500/30">
              <p className="text-[11px] text-red-400 font-black uppercase tracking-widest flex items-center gap-2">
                <Users size={14} /> เพื่อนหมาป่า: <span className="text-white normal-case font-bold">{Object.entries(wwPlayers).filter(([n, p]: [string, any]) => WOLF_ROLES.includes(p.role) && n !== userNickname && p.role !== 'gm').map(([n]) => n).join(', ') || 'ไม่มี'}</span>
              </p>
            </NeonCard>
          )}

          {/* Seer Result */}
          {userNickname && ['seer', 'apprentice_seer', 'mystic_wolf', 'aura_seer'].includes(myRole) && wwData.privateData?.[userNickname]?.seerResult && (
            <NeonCard color={wwData.privateData[userNickname].seerResult.isWolf ? 'pink' : 'blue'} className={`p-4 text-center ${wwData.privateData[userNickname].seerResult.isWolf ? 'bg-red-500/10' : 'bg-indigo-500/10'}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex-center gap-2"><Eye size={14} /> ผลการส่อง</p>
              <p className="font-bold text-sm">
                <span className="text-white">{wwData.privateData[userNickname].seerResult.targetName}</span> คือ{' '}
                <span className={`font-black uppercase tracking-widest px-2 py-0.5 rounded-lg text-[11px] ${wwData.privateData[userNickname].seerResult.isWolf ? 'text-red-500 bg-red-500/20' : 'text-neon-green bg-neon-green/20'}`}>
                  {wwData.privateData[userNickname].seerResult.isWolf ? '🐺 หมาป่า!' : '✅ ไม่ใช่หมาป่า'}
                </span>
              </p>
            </NeonCard>
          )}

          {/* Night: Action Panel */}
          {phase === 'night' && myIsAlive && (
            <NeonCard color="blue" className="p-5 border-indigo-500/30 bg-indigo-500/5">
              {(() => {
                const cfg = ROLES[myRole];
                if (!cfg || cfg.actionPhase === 'none' || (cfg.actionPhase === 'firstNight' && dayCount > 1)) {
                  return (
                    <div className="text-center p-4">
                      <div className="text-5xl mb-4 animate-pulse drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">🌙</div>
                      <p className="text-indigo-300 font-bold">กำลังหลับอยู่... ไม่ต้องทำอะไรในคืนนี้</p>
                    </div>
                  );
                }

                const isDone = !!nightActions[`${myRole}TargetDone`];
                if (isDone) {
                  return (
                    <div className="text-center p-4">
                      <div className="w-16 h-16 mx-auto bg-neon-green/20 rounded-full flex-center mb-4 border border-neon-green/50">
                        <CheckCircle2 size={32} className="text-neon-green" />
                      </div>
                      <p className="text-neon-green font-black uppercase tracking-widest text-sm drop-shadow-[0_0_10px_rgba(0,255,0,0.5)]">ส่งการกระทำแล้ว</p>
                      <p className="text-[10px] text-slate-400 mt-2">รอ GM ประกาศผล</p>
                    </div>
                  );
                }

                // Show targets
                const targets = Object.entries(wwPlayers).filter(([name, p]: [string, any]) => {
                  if (!p.isAlive || p.role === 'gm') return false;
                  if (name === userNickname && myRole !== 'bodyguard') return false;
                  if (cfg.team === 'werewolf' && WOLF_ROLES.includes(p.role) && name !== userNickname) return false;
                  return true;
                });

                return (
                  <div className="space-y-4">
                    <p className="text-[11px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">{cfg.icon} ถึงตาคุณแล้ว — เลือกเป้าหมาย:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {targets.map(([name]) => (
                        <button
                          key={name}
                          className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${selectedTarget === name ? 'border-neon-green bg-neon-green/20 scale-[0.98] shadow-[0_0_10px_rgba(0,255,0,0.2)]' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}
                          onClick={() => {
                            if (cfg.actionType === 'target2') {
                              const newTargets = selectedTargets.includes(name)
                                ? selectedTargets.filter(t => t !== name)
                                : [...selectedTargets, name].slice(-2);
                              setSelectedTargets(newTargets);
                              if (newTargets.length === 2) {
                                submitNightAction(myRole, newTargets.join(','));
                                setSelectedTargets([]);
                              }
                            } else {
                              setSelectedTarget(name);
                              submitNightAction(myRole, name);
                            }
                          }}
                        >
                          <span className="font-bold text-sm text-white">{name}</span>
                          {selectedTarget === name && <span className="text-[9px] text-neon-green font-black uppercase">เลือกแล้ว</span>}
                        </button>
                      ))}
                    </div>
                    <GiantButton color="slate" onClick={() => submitNightAction(myRole, 'skip')}>
                      ข้าม (ไม่ใช้พลัง)
                    </GiantButton>
                  </div>
                );
              })()}
            </NeonCard>
          )}

          {/* Night: Dead */}
          {!myIsAlive && (
            <NeonCard color="pink" className="p-8 text-center flex flex-col items-center bg-slate-800/50">
              <p className="text-red-500 font-black uppercase tracking-widest text-[11px]"><Skull size={14} className="inline mr-1 mb-1"/> คุณเสียชีวิตแล้ว — รอชมเกมต่อ</p>
            </NeonCard>
          )}

          {/* Day Panel */}
          {phase === 'day' && (
            <NeonCard color="amber" className="p-8 text-center bg-amber-400/10">
              {myIsAlive ? (
                myPlayerData?.status?.silenced ? (
                  <div>
                    <div className="text-4xl mb-4">🤐</div>
                    <p className="text-purple-400 font-black uppercase tracking-widest drop-shadow-md">คุณถูกปิดปาก!</p>
                    <p className="text-xs text-slate-300 mt-2">ห้ามพูดหรือโหวตวันนี้</p>
                  </div>
                ) : myPlayerData?.status?.banned ? (
                  <div>
                    <div className="text-4xl mb-4">🚫</div>
                    <p className="text-red-500 font-black uppercase tracking-widest drop-shadow-md">คุณถูกแบน!</p>
                    <p className="text-xs text-slate-300 mt-2">ไม่มีสิทธิ์โหวตวันนี้</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-5xl mb-4 animate-pulse drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">☀️</div>
                    <p className="text-amber-400 font-black uppercase tracking-widest drop-shadow-md">คุยกันและค้นหาหมาป่า!</p>
                    <p className="text-[10px] text-slate-400 mt-3 border-t border-amber-500/30 pt-3">รอ GM เริ่มโหวต</p>
                  </div>
                )
              ) : (
                <p className="text-red-500 font-black uppercase tracking-widest drop-shadow-md"><Skull size={18} className="inline mr-2 mb-1"/>คุณเสียชีวิตแล้ว</p>
              )}
            </NeonCard>
          )}

          {/* Voting Panel */}
          {phase === 'voting' && (
            <NeonCard color="pink" className="p-5 border-red-500/30 bg-red-500/10">
              <p className="text-[11px] font-black text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2 drop-shadow-md"><Users size={14} /> 🗳️ เลือกคนที่จะแขวนคอ</p>
              {myIsAlive && !myPlayerData?.status?.silenced && !myPlayerData?.status?.banned ? (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(wwPlayers).filter(([name, p]: [string, any]) => p.isAlive && p.role !== 'gm' && name !== userNickname).map(([name]) => {
                    const isSelected = myPlayerData?.vote === name;
                    const voteCount = Object.values(wwPlayers).filter((p: any) => p.vote === name).length;
                    return (
                      <button
                        key={name}
                        onClick={() => castVote(name)}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-1 relative transition-all active:scale-95 ${isSelected ? 'border-red-500 bg-red-500/20 scale-[0.98] shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}
                        disabled={!!myPlayerData?.vote}
                      >
                        <span className="font-bold text-sm text-white">{name}</span>
                        {isSelected && <span className="text-[9px] text-red-500 font-black uppercase">โหวตแล้ว</span>}
                        {voteCount > 0 && (
                          <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex-center text-[11px] font-black text-white shadow-[0_0_10px_rgba(239,68,68,0.5)] border-2 border-slate-900">{voteCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-6 bg-slate-900/50 rounded-xl border border-slate-700">
                  <p className="text-red-500 font-black uppercase tracking-widest text-sm drop-shadow-md">
                    {!myIsAlive ? '💀 วิญญาณไม่มีสิทธิ์โหวต' : myPlayerData?.status?.silenced ? '🤐 คุณถูกปิดปาก' : '🚫 คุณถูกแบน'}
                  </p>
                </div>
              )}
            </NeonCard>
          )}

          {/* Standby */}
          {phase === 'standby' && (
            <NeonCard color="slate" className="p-8 text-center bg-slate-800/50">
              <div className="text-5xl mb-4 opacity-50 drop-shadow-md">🎭</div>
              <p className="text-slate-300 font-black uppercase tracking-widest drop-shadow-md">รอ GM เริ่มรอบต่อไป...</p>
            </NeonCard>
          )}
        </div>
      )}

      {/* Player List Sidebar */}
      <NeonCard color="slate" className="p-4 mt-6">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Users size={14}/> ผู้เล่น</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.role !== 'gm').map(([name, p]: [string, any]) => (
            <span key={name} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center shadow-sm ${!p.isAlive ? 'opacity-40 line-through bg-slate-900 border-slate-800 text-slate-500' : name === userNickname ? 'border-neon-green/50 text-neon-green bg-neon-green/10' : 'bg-slate-800 border-slate-700 text-white'}`}>
              {!p.isAlive && <Skull size={10} className="mr-1" />}
              {name}
              {isGM && WOLF_ROLES.includes(p.role) && <span className="text-red-500 ml-1">🐺</span>}
            </span>
          ))}
        </div>
      </NeonCard>

      {/* Show Role button (non-GM) */}
      {!isGM && (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <GiantButton color="slate" onClick={() => setShowRoleReveal(true)}>
             <Eye size={16} /> ดูบทบาทอีกครั้ง
          </GiantButton>
        </div>
      )}
    </div>
  );
};

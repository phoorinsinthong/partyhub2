import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skull, Users, XCircle } from 'lucide-react';
import { useGame } from '../../contexts/GameContext';
import { useWerewolf } from './WerewolfContext';
import NeonCard from '../../components/NeonCard';
import GiantButton from '../../components/GiantButton';
import { ROLE_CATEGORIES, ROLES } from '../logic/werewolfData';

export const WerewolfSetupPhase: React.FC = () => {
  const { t } = useTranslation();
  const { roomData, userNickname } = useGame();
  const { wwData, gameMode, isGM, guestName, setGuestName, showDeckSetup, setShowDeckSetup, safeUpdate, updateRoom } = useWerewolf();
  const roomId = useGame().roomId;

  const playerNames = Object.keys(roomData?.players || {});
  const connectedPlayers = playerNames.filter(n => n !== roomData?.host);
  const guestNames = wwData.guests ? Object.keys(wwData.guests) : [];
  const allGamePlayers = [...connectedPlayers, ...guestNames];
  
  const deckCounts = wwData.deckCounts || {};
  const totalDeck = Object.values(deckCounts).reduce((a: any, b: any) => a + b, 0) as number;

  const addGuest = async () => {
    if (!guestName.trim()) return;
    const guests = { ...(wwData.guests || {}) };
    guests[guestName.trim()] = { role: 'villager', isAlive: true, isGuest: true };
    await safeUpdate(`rooms/${roomId}/gameData/wwData/guests`, guests);
    setGuestName('');
  };

  const removeGuest = async (name: string) => {
    const guests = { ...(wwData.guests || {}) };
    delete guests[name];
    await safeUpdate(`rooms/${roomId}/gameData/wwData/guests`, guests);
  };

  const updateDeckCount = async (role: string, delta: number) => {
    if (!isGM) return;
    const counts = { ...(wwData.deckCounts || {}) };
    const current = counts[role] || 0;
    if (current + delta < 0) return;
    if (delta > 0 && totalDeck >= allGamePlayers.length && gameMode === 'digital') return;
    
    counts[role] = current + delta;
    await safeUpdate(`rooms/${roomId}/gameData/wwData/deckCounts`, counts);
  };

  const startGame = async () => {
    if (!isGM) return;
    
    // Digital mode is limited to 4-10, physical mode has no limit
    if (gameMode === 'digital' && (allGamePlayers.length < 4 || allGamePlayers.length > 10)) return;
    if (gameMode === 'physical' && allGamePlayers.length < 1) return;

    const deck: string[] = [];
    for (const [role, count] of Object.entries(deckCounts)) {
      for (let i = 0; i < (count as number); i++) deck.push(role);
    }

    if (deck.length === 0) {
      const count = allGamePlayers.length;
      const wolfCount = count >= 7 ? 2 : 1;
      for (let i = 0; i < wolfCount; i++) deck.push('werewolf');
      if (count >= 4) deck.push('seer');
      if (count >= 5) deck.push('bodyguard');
      while (deck.length < count) deck.push('villager');
    }

    if (deck.length !== allGamePlayers.length) {
      return;
    }

    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const shuffledPlayers = [...allGamePlayers];
    for (let i = shuffledPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
    }
    
    const wwPlayers: any = {};
    shuffledPlayers.forEach((name, idx) => {
      wwPlayers[name] = { 
        role: deck[idx], 
        isAlive: true, 
        vote: '', 
        status: {},
        isGuest: guestNames.includes(name)
      };
    });
    
    if (roomData?.host) {
      wwPlayers[roomData.host] = { role: 'gm', isAlive: true, vote: '', status: {} };
    }

    await safeUpdate(`rooms/${roomId}/gameData`, {
      wwData: {
        ...wwData,
        players: wwPlayers,
        phase: 'night',
        dayCount: 1,
        nightActions: {},
        nightTurn: null,
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full animate-fade-in pb-20 relative z-10 px-2">
      <NeonCard color="amber" className="p-6 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500 border border-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
            <Skull size={40} />
          </div>
        </div>
        <h2 className="font-display font-black text-3xl uppercase tracking-widest text-amber-500 mb-2">WEREWOLF</h2>
        <p className="text-[12px] font-bold text-slate-300 leading-relaxed">
          {gameMode === 'digital' 
            ? 'หมาป่ากำลังแฝงตัวอยู่ในหมู่ชาวบ้าน! ทุกอย่างรันบนแอป 100%' 
            : 'โหมด GM Dashboard: แอปจะช่วย Host คุมเกมแบบใช้ไพ่จริง'}
        </p>
        {isGM && (
          <div className="mt-4 inline-block px-4 py-1.5 bg-amber-500/20 border border-amber-500/50 rounded-full">
            <p className="text-amber-400 font-bold text-[10px] uppercase tracking-widest">🎭 คุณเป็นผู้ดำเนินเกม (GM)</p>
          </div>
        )}
      </NeonCard>

      {isGM && gameMode === 'physical' && (
        <NeonCard color="slate" className="p-4 space-y-3">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={14}/> เพิ่มผู้เล่น (Guest)</h4>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ชื่อผู้เล่น..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:border-neon-blue outline-none text-sm"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addGuest()}
            />
            <button className="px-4 py-2 bg-neon-blue text-slate-900 font-black rounded-xl" onClick={addGuest}>เพิ่ม</button>
          </div>
          {guestNames.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {guestNames.map(name => (
                <span key={name} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-800 border border-slate-700 flex items-center gap-1 text-slate-300">
                  {name}
                  <button onClick={() => removeGuest(name)} className="text-red-400 hover:text-red-300"><XCircle size={12}/></button>
                </span>
              ))}
            </div>
          )}
        </NeonCard>
      )}

      <NeonCard color="slate" className="p-4">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Users size={14}/> รายชื่อผู้เล่น ({allGamePlayers.length} คน)</h4>
        <div className="flex flex-wrap gap-2">
          {allGamePlayers.map(name => {
            const isGuest = guestNames.includes(name);
            return (
              <span key={name} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border ${isGuest ? 'border-dashed border-slate-600 text-slate-400 bg-slate-800/50' : 'border-slate-700 text-white bg-slate-800'}`}>
                {name} {isGuest && '(Guest)'}
              </span>
            );
          })}
        </div>
      </NeonCard>

      {isGM && (
        <NeonCard color="slate" className="p-4">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
            <h4 className="font-black flex items-center gap-2 text-sm text-white uppercase tracking-widest">
              🎴 จัดเตรียมการ์ด
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${totalDeck === allGamePlayers.length ? 'bg-neon-green/20 text-neon-green border border-neon-green' : 'bg-red-500/20 text-red-400 border border-red-500'}`}>
                {totalDeck}/{allGamePlayers.length}
              </span>
            </h4>
            <button className="text-[10px] font-bold text-slate-400 border border-slate-700 px-2 py-1 rounded hover:text-white" onClick={() => setShowDeckSetup(!showDeckSetup)}>
              {showDeckSetup ? 'ซ่อน' : 'แสดง'}
            </button>
          </div>

          {showDeckSetup && Object.entries(ROLE_CATEGORIES).map(([teamKey, teamInfo]) => (
            <div key={teamKey} className="mb-4">
              <p className="text-[11px] font-black uppercase tracking-widest mb-2" style={{ color: teamInfo.color }}>{teamInfo.name}</p>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(ROLES).filter(([, r]) => r.team === teamKey).map(([roleKey, role]) => {
                  const count = deckCounts[roleKey] || 0;
                  return (
                    <div key={roleKey} className="flex justify-between items-center p-3 bg-slate-800/50 border border-slate-700 rounded-xl" style={{ borderLeftWidth: '4px', borderLeftColor: role.color }}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-xl bg-slate-900 w-8 h-8 rounded-full flex items-center justify-center shadow-inner">{role.icon}</span>
                        <span className="text-[12px] font-bold truncate" style={{ color: role.color }}>{role.name}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-700">
                        <button className="w-6 h-6 rounded bg-slate-800 text-white font-bold text-sm flex items-center justify-center active:scale-95" onClick={() => updateDeckCount(roleKey, -1)}>-</button>
                        <span className="w-4 text-center font-bold text-[12px] text-white">{count}</span>
                        <button className="w-6 h-6 rounded bg-slate-800 text-white font-bold text-sm flex items-center justify-center active:scale-95" onClick={() => updateDeckCount(roleKey, 1)}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </NeonCard>
      )}

      {totalDeck > 0 && (
        <NeonCard color="slate" className="p-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">การ์ดที่จะใช้ในเกม</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(deckCounts).filter(([, c]) => (c as number) > 0).map(([roleKey, count]) => {
              const role = ROLES[roleKey];
              return (
                <span key={roleKey} className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-slate-900" style={{ borderColor: `${role.color}60`, color: role.color }}>
                  {role.icon} {role.name} <span className="text-white ml-1">x{count as number}</span>
                </span>
              );
            })}
          </div>
        </NeonCard>
      )}

      {isGM ? (
        <GiantButton
          color="pink"
          onClick={startGame}
          disabled={
            (gameMode === 'digital' && (allGamePlayers.length < 4 || allGamePlayers.length > 10)) ||
            (gameMode === 'physical' && allGamePlayers.length < 1) ||
            (totalDeck > 0 && totalDeck !== allGamePlayers.length)
          }
        >
          {gameMode === 'digital' && allGamePlayers.length < 4
            ? `รอผู้เล่น (ขาด ${4 - allGamePlayers.length} คน)`
            : (gameMode === 'digital' && allGamePlayers.length > 10)
              ? `ผู้เล่นเกิน (สูงสุด 10)`
              : totalDeck > 0 && totalDeck !== allGamePlayers.length
                ? `จัดไพ่ไม่พอดี (${totalDeck}/${allGamePlayers.length})`
                : 'เริ่มเกม!'}
        </GiantButton>
      ) : (
        <div className="mt-4 p-4 rounded-2xl border border-neon-blue/30 bg-neon-blue/10 text-center shadow-[0_0_15px_rgba(0,240,255,0.2)]">
          <p className="animate-pulse text-neon-blue font-bold uppercase tracking-widest text-[12px]">Waiting for GM to start...</p>
        </div>
      )}
    </div>
  );
};

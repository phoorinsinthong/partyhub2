import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../contexts/GameContext';
import { useGameUpdate } from '../../hooks/useGameUpdate';
import { useGameState } from '../../hooks/useGameState';
import { WOLF_ROLES } from './werewolfLogic';
import { ROLES } from './werewolfData';

interface WerewolfContextType {
  wwData: any;
  phase: string;
  gameMode: 'physical' | 'digital';
  dayCount: number;
  myPlayerData: any;
  myRole: string;
  myIsAlive: boolean;
  isGM: boolean;
  roleInfo: any;
  vfx: { show: boolean; type: string; text: string };
  setVfx: (vfx: { show: boolean; type: string; text: string }) => void;
  selectedTarget: string | null;
  setSelectedTarget: (t: string | null) => void;
  selectedTargets: string[];
  setSelectedTargets: (t: string[]) => void;
  showRoleReveal: boolean;
  setShowRoleReveal: (s: boolean) => void;
  showDeckSetup: boolean;
  setShowDeckSetup: (s: boolean) => void;
  errorMsg: string;
  setErrorMsg: (s: string) => void;
  activeScriptIndex: number;
  setActiveScriptIndex: (s: number) => void;
  guestName: string;
  setGuestName: (s: string) => void;
  safeUpdate: (refPath: string, data: any) => Promise<void>;
  updateRoom: (updates: any) => Promise<boolean>;
}

const WerewolfContext = createContext<WerewolfContextType | undefined>(undefined);

export const WerewolfProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { errorMsg, setErrorMsg } = useGameUpdate(roomId);
  const { updateRoom } = useGameState(roomId || '');
  
  const gameData = roomData?.gameData || {};
  const wwData = gameData.wwData || {};
  const phase = wwData.phase || 'waiting';
  const gameMode: 'physical' | 'digital' = roomData?.currentGame === 'werewolf_physical' ? 'physical' : 'digital';
  const dayCount = wwData.dayCount || 0;

  const [vfx, setVfx] = useState({ show: false, type: '', text: '' });
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [showRoleReveal, setShowRoleReveal] = useState(false);
  const [showDeckSetup, setShowDeckSetup] = useState(true);
    const [activeScriptIndex, setActiveScriptIndex] = useState(0);
  const [guestName, setGuestName] = useState('');

  const myPlayerData = wwData.players?.[userNickname || ''];
  const myRole = myPlayerData?.role || '';
  const myIsAlive = myPlayerData?.isAlive !== false;
  const isGM = !!isHost;
  const roleInfo = ROLES[myRole];

  const safeUpdate = React.useCallback(async (refPath: string, data: any) => {
    try {
      const updates: any = {};
      // Simplified adapter to fit old safeUpdate pattern for now
      // This will use updateRoom implicitly if targeting rooms
      if (refPath.startsWith(`rooms/${roomId}`)) {
         const relPath = refPath.replace(`rooms/${roomId}/`, '');
         if (data && typeof data === 'object' && !Array.isArray(data)) {
           for (const key of Object.keys(data)) {
             const newKey = relPath ? `${relPath}/${key}` : key;
             updates[newKey] = data[key];
           }
         } else {
           if (relPath) updates[relPath] = data;
         }
         await updateRoom(updates);
      }
    } catch {
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  }, [t, roomId, updateRoom]);

  const value = {
    wwData, phase, gameMode, dayCount, myPlayerData, myRole, myIsAlive, isGM, roleInfo,
    vfx, setVfx, selectedTarget, setSelectedTarget, selectedTargets, setSelectedTargets,
    showRoleReveal, setShowRoleReveal, showDeckSetup, setShowDeckSetup,
    errorMsg, setErrorMsg, activeScriptIndex, setActiveScriptIndex,
    guestName, setGuestName, safeUpdate, updateRoom
  };

  return <WerewolfContext.Provider value={value}>{children}</WerewolfContext.Provider>;
};

export const useWerewolf = () => {
  const ctx = useContext(WerewolfContext);
  if (!ctx) throw new Error('useWerewolf must be used within WerewolfProvider');
  return ctx;
};

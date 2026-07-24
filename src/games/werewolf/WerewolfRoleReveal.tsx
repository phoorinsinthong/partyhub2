import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '@/contexts/GameContext';
import { useWerewolf } from './WerewolfContext';
import { WOLF_ROLES } from './werewolfLogic';
import { GiantButton } from '@/components/ui';

export const WerewolfRoleReveal: React.FC = () => {
  const { userNickname } = useGame();
  const { showRoleReveal, setShowRoleReveal, roleInfo, isGM, myRole, wwData } = useWerewolf();

  return (
    <AnimatePresence>
      {showRoleReveal && roleInfo && !isGM && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl"
        >
          <div className="flex flex-col items-center gap-6 text-center perspective-1000">
            <p className="text-slate-400 font-bold tracking-[4px] uppercase mb-4 text-sm">แตะการ์ดเพื่อเปิดดูบทบาท</p>
            
            <motion.div 
              onClick={() => setShowRoleReveal(false)}
              className="relative w-64 h-96 preserve-3d transition-transform duration-700 cursor-pointer"
            >
              <div className="absolute inset-0 glass-panel-werewolf border-4 border-indigo-500/50 flex flex-col items-center justify-between p-6 rounded-3xl bg-slate-900 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center text-6xl shadow-inner mt-4">
                  {roleInfo.icon}
                </div>
                <div className="text-center">
                  <h3 className="text-3xl font-black mb-2" style={{ color: roleInfo.color }}>{roleInfo.name}</h3>
                  <p className="text-[12px] text-slate-300 leading-relaxed font-semibold">{roleInfo.description}</p>
                </div>
                {WOLF_ROLES.includes(myRole) && (
                  <div className="w-full p-3 bg-red-500/10 border border-red-500/30 rounded-xl mb-2">
                    <p className="text-[10px] text-red-400 font-black uppercase mb-1">Wolf Allies</p>
                    <p className="text-[11px] text-white font-bold truncate">
                      {Object.entries(wwData.players || {}).filter(([n, p]: [string, any]) => WOLF_ROLES.includes(p.role) && n !== userNickname).map(([n]) => n).join(', ') || 'Lone Wolf'}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>

            <GiantButton 
              color="slate"
              onClick={() => setShowRoleReveal(false)}
              className="mt-6"
            >
              เข้าสู่หมู่บ้าน
            </GiantButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

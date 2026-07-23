import React from 'react';
import { Users, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAvatarUrl, getRandomGradient } from '../../utils/avatars';

interface Player {
  key: string;
  name: string;
  online?: boolean;
  isHost?: boolean;
  avatar?: string;
  avatarColor?: string;
}

interface PlayerListProps {
  playersList: Player[];
  userNickname: string | null;
  isHost: boolean;
  handleKickPlayer: (name: string) => void;
}

const PlayerList: React.FC<PlayerListProps> = ({ playersList, userNickname, isHost, handleKickPlayer }) => {
  return (
    <section className="glass-panel p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-neon-pink" />
          <span className="font-bold text-[14px] text-white uppercase tracking-wider">Lobby</span>
        </div>
        <span className="text-[10px] font-bold text-slate-500 uppercase">Live Sync</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        <AnimatePresence>
          {playersList.map((p, index) => (
            <motion.div
              key={p.key}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300, delay: index * 0.05 }}
              className={`relative flex flex-col items-center gap-2 p-2 rounded-2xl transition-all duration-200 ${
                p.online === false ? 'opacity-40 grayscale' : ''
              } ${
                p.isHost ? 'bg-slate-800/80 border border-neon-pink shadow-neon-pink' : 'bg-slate-900/50 border border-slate-700/50'
              }`}
            >
              <div 
                className="w-14 h-14 rounded-2xl flex-center shadow-md border-2 border-white/20 overflow-hidden"
                style={{ background: p.avatarColor || getRandomGradient() }}
              >
                <img src={getAvatarUrl(p.avatar)} alt={p.name} className="w-[120%] h-[120%] object-cover mt-[20%]" style={{ imageRendering: 'pixelated' }} />
              </div>
              
              <div className="text-center w-full px-1">
                <p className="font-bold text-[12px] text-white truncate w-full">{p.name}</p>
              </div>

              {p.isHost && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-900 border border-neon-pink rounded-full flex-center text-[10px] shadow-neon-pink z-10">
                  👑
                </div>
              )}
              {p.key === userNickname && (
                <div className="absolute -bottom-2 bg-neon-blue text-slate-900 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider z-10">
                  YOU
                </div>
              )}

              {isHost && !p.isHost && (
                <button 
                  onClick={() => handleKickPlayer(p.key)} 
                  className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-slate-900 border border-red-500 flex-center text-red-500 active:bg-red-900 z-10"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default PlayerList;

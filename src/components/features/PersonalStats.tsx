import React, { useState } from 'react';
import { Trophy, X, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GAME_NAMES, GAME_ICONS } from '../../utils/gameData';

const STATS_KEY = 'partyhub_personal_stats';

export function recordPersonalWin(gameName) {
  const stats = getPersonalStats();
  stats.totalWins = (stats.totalWins || 0) + 1;
  stats.games = stats.games || {};
  stats.games[gameName] = (stats.games[gameName] || 0) + 1;
  stats.lastPlayed = Date.now();
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function recordPersonalGame(gameName) {
  const stats = getPersonalStats();
  stats.totalGames = (stats.totalGames || 0) + 1;
  stats.gamesPlayed = stats.gamesPlayed || {};
  stats.gamesPlayed[gameName] = (stats.gamesPlayed[gameName] || 0) + 1;
  stats.lastPlayed = Date.now();
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function getPersonalStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || { totalWins: 0, totalGames: 0, games: {}, gamesPlayed: {} };
  } catch {
    return { totalWins: 0, totalGames: 0, games: {}, gamesPlayed: {} };
  }
}


const PersonalStats = () => {
  const [isOpen, setIsOpen] = useState(false);
  const stats = getPersonalStats();

  if (stats.totalGames === 0 && stats.totalWins === 0) return null;

  const winRate = stats.totalGames > 0 ? Math.round((stats.totalWins / stats.totalGames) * 100) : 0;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 bg-slate-800 border-2 border-slate-700 px-3 py-1.5 rounded-full active:scale-95 transition-transform"
      >
        <BarChart3 size={13} className="text-neon-green" />
        <span className="text-[11px] font-bold text-slate-200">{stats.totalWins} ชนะ</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 flex-center p-6 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              transition={{ duration: 0.15 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-[340px] max-h-[70vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy size={18} className="text-amber-500" />
                  <span className="font-display font-bold text-[16px] text-white">สถิติของคุณ</span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-800 flex-center text-slate-400 active:bg-slate-700"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-800/50 border-2 border-slate-700 rounded-2xl p-3 text-center">
                  <span className="font-black text-[20px] text-neon-green block">{stats.totalGames || 0}</span>
                  <span className="text-[10px] font-bold text-slate-400">เล่นทั้งหมด</span>
                </div>
                <div className="bg-slate-800/50 border-2 border-amber-500/30 rounded-2xl p-3 text-center">
                  <span className="font-black text-[20px] text-amber-400 block">{stats.totalWins || 0}</span>
                  <span className="text-[10px] font-bold text-slate-400">ชนะ</span>
                </div>
                <div className="bg-slate-800/50 border-2 border-neon-blue/30 rounded-2xl p-3 text-center">
                  <span className="font-black text-[20px] text-neon-blue block">{winRate}%</span>
                  <span className="text-[10px] font-bold text-slate-400">อัตราชนะ</span>
                </div>
              </div>

              {/* Per-game breakdown */}
              {Object.keys(stats.gamesPlayed || {}).length > 0 && (
                <div className="flex-1 overflow-y-auto space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">แยกตามเกม</span>
                  {Object.entries(stats.gamesPlayed || {}).map(([game, played]) => (
                    <div key={game} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-800 border-2 border-slate-700">
                      <span className="text-xl">{GAME_ICONS[game] || '🎮'}</span>
                      <div className="flex-1">
                        <span className="font-bold text-[13px] text-slate-200">{GAME_NAMES[game] || game}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[12px] font-bold text-neon-green">{stats.games?.[game] || 0}/{played}</span>
                        <span className="text-[9px] text-slate-400 block">ชนะ/เล่น</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PersonalStats;

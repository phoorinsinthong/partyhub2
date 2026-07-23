// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { ref, onValue, update, get, remove } from 'firebase/database';
import { db } from '../firebase';
import { Trophy, Medal, Star, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GAME_NAMES } from '../utils/gameData';

export async function recordWin(roomId, winnerName, gameName) {
  const scoreRef = ref(db, `rooms/${roomId}/scoreboard/${winnerName}`);
  const snap = await get(scoreRef);
  const current = snap.val() || { wins: 0, games: {} };
  current.wins = (current.wins || 0) + 1;
  current.games = current.games || {};
  current.games[gameName] = (current.games[gameName] || 0) + 1;
  await update(ref(db, `rooms/${roomId}/scoreboard`), { [winnerName]: current });
}

const MEDALS = ['1st', '2nd', '3rd'];

const Scoreboard = ({ roomId, isHost = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scores, setScores] = useState([]);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleReset = async () => {
    await remove(ref(db, `rooms/${roomId}/scoreboard`));
    setConfirmReset(false);
    setIsOpen(false);
  };

  useEffect(() => {
    if (!roomId) return;
    const unsub = onValue(ref(db, `rooms/${roomId}/scoreboard`), (snap) => {
      if (!snap.exists()) { setScores([]); return; }
      const data = snap.val();
      const list = Object.entries(data)
        .map(([name, info]) => ({ name, wins: info.wins || 0, games: info.games || {} }))
        .sort((a, b) => b.wins - a.wins);
      setScores(list);
    });
    return () => unsub();
  }, [roomId]);

  if (scores.length === 0) return null;

  return (
    <>
      {/* Mini scoreboard button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 bg-slate-800 border-2 border-slate-700 px-3 py-1.5 rounded-full active:scale-95 transition-transform"
      >
        <Trophy size={13} className="text-amber-500" />
        <span className="text-[11px] font-bold text-slate-200">{scores[0]?.name} ({scores[0]?.wins})</span>
      </button>

      {/* Full scoreboard modal */}
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
              {/* Header */}
              <div className="flex-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy size={18} className="text-amber-500" />
                  <span className="font-display font-bold text-[16px] text-white">สกอร์บอร์ด</span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-800 flex-center text-slate-400 active:bg-slate-700"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Scores list */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {scores.map((player, idx) => (
                  <div
                    key={player.name}
                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 ${
                      idx === 0 ? 'bg-amber-500/10 border-amber-500/30' :
                      idx === 1 ? 'bg-slate-400/10 border-slate-400/30' :
                      idx === 2 ? 'bg-orange-500/10 border-orange-500/30' :
                      'bg-slate-800 border-slate-700'
                    }`}
                  >
                    <span className="text-xl w-8 text-center">
                      {idx < 3 ? MEDALS[idx] : <span className="text-[13px] font-black text-slate-400">{idx + 1}</span>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-[14px] text-white block truncate">{player.name}</span>
                      {Object.keys(player.games).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(player.games).map(([game, count]) => (
                            <span key={game} className="text-[9px] font-bold bg-slate-900/80 text-slate-300 px-1.5 py-0.5 rounded">
                              {GAME_NAMES[game] || game} ×{count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-center shrink-0">
                      <span className="font-black text-[18px] text-neon-green block">{player.wins}</span>
                      <span className="text-[9px] font-bold text-slate-400">ชนะ</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reset button for host */}
              {isHost && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  {!confirmReset ? (
                    <button
                      onClick={() => setConfirmReset(true)}
                      className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-[12px] font-bold text-red-400 bg-red-900/20 border-2 border-red-900/50 active:bg-red-900/40 transition-colors"
                    >
                      <Trash2 size={13} /> รีเซ็ตคะแนนทั้งหมด
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmReset(false)} className="bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl flex-1 py-2.5 text-[12px]">ยกเลิก</button>
                      <button onClick={handleReset} className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white bg-red-500 active:bg-red-600 transition-colors">ยืนยันรีเซ็ต</button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Scoreboard;

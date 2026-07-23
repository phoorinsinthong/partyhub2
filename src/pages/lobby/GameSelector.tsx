import React from 'react';
import { Play, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export const gameCategories = [
  {
    label: 'บอร์ดเกม & บลัฟ',
    games: [
      { id: 'spyfall', name: 'สปายฟอล', icon: '🕵️‍♂️', minPlayers: 3 },
      { id: 'werewolf', name: 'หมาป่า (ดิจิทัล)', icon: '🐺', minPlayers: 4 },
      { id: 'werewolf_physical', name: 'หมาป่า GM (ไพ่จริง)', icon: '🎴', minPlayers: 1 },
      { id: 'twentyquestions', name: 'Insider', icon: '🕵️', minPlayers: 4 },
      { id: 'drawing', name: 'วาดรูปทายคำ', icon: '🎨', minPlayers: 2 },
      { id: 'fakeartist', name: 'ศิลปินปลอม', icon: '🎭', minPlayers: 4 },
      { id: 'taboo', name: 'ใบ้คำ (Taboo)', icon: '🤫', minPlayers: 2 },
    ],
  },
  {
    label: 'ปาร์ตี้ & วงเหล้า',
    games: [
      { id: 'drinking', name: 'วงเหล้า', icon: '🍺', minPlayers: 1 },
      { id: 'truthordare', name: 'จริงหรือกล้า', icon: '🎭', minPlayers: 2 },
      { id: 'wordbomb', name: 'บอมบ์คำ', icon: '💣', minPlayers: 2 },
      { id: 'neverhaveiever', name: 'ไม่เคย...', icon: '🙋', minPlayers: 2 },
      { id: 'wouldyourather', name: 'เลือกข้าง', icon: '⚖️', minPlayers: 2 },
    ],
  },
  {
    label: 'คาสิโน & การ์ด',
    games: [
      { id: 'pokdeng', name: 'ป๊อกเด้ง', icon: '💰', minPlayers: 2 },
      { id: 'poker', name: 'โป๊กเกอร์', icon: '💵', minPlayers: 2 },
      { id: 'slaves', name: 'สลาฟ', icon: '👑', minPlayers: 3 },
      { id: 'blackjack', name: 'แบล็คแจ็ค', icon: '🃏', minPlayers: 2 },
    ],
  },
  {
    label: 'ลับสมอง & ประลองปัญญา',
    games: [
      { id: 'quiz', name: 'ควิซ', icon: '🧠', minPlayers: 2 },
      { id: 'mathrace', name: 'คำนวณเร็ว', icon: '🔢', minPlayers: 2 },
      { id: 'target', name: 'เลขเป้า', icon: '🎯', minPlayers: 2 },
    ],
  }
];

export const allGames = gameCategories.flatMap(cat => cat.games);

interface GameSelectorProps {
  selectedGame: string;
  setSelectedGame: (game: string) => void;
  setShowTutorial: (show: boolean) => void;
  handleStartGame: () => void;
  playersCount: number;
  vibrateLight: () => void;
}

const GameSelector: React.FC<GameSelectorProps> = ({
  selectedGame,
  setSelectedGame,
  setShowTutorial,
  handleStartGame,
  playersCount,
  vibrateLight
}) => {
  const navigate = useNavigate();

  return (
    <section className="flex flex-col gap-4 flex-1">
      <div className="glass-panel p-5 space-y-5 flex-1 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-neon-blue/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex-between">
          <h3 className="font-display font-black text-[15px] text-white uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-blue animate-pulse"></span> Select Game
          </h3>
          <button 
            onClick={() => { vibrateLight(); setShowTutorial(true); }}
            className="text-[11px] font-bold text-neon-pink border border-neon-pink/50 rounded-full px-3 py-1 hover:bg-neon-pink/10 transition-colors uppercase tracking-wider"
          >
            วิธีเล่น
          </button>
        </div>

        {gameCategories.map((category) => (
          <div key={category.label}>
            <h4 className="mb-2.5 font-bold text-[11px] text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1">
              {category.label}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {category.games.map((game) => (
                <button
                  key={game.id}
                  className={`rounded-2xl p-3 flex flex-col items-center gap-2 border-2 transition-all active:scale-95 relative overflow-hidden ${
                    selectedGame === game.id 
                      ? 'bg-slate-800 border-neon-blue shadow-neon-blue' 
                      : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'
                  }`}
                  onClick={() => { vibrateLight(); setSelectedGame(game.id); }}
                >
                  {selectedGame === game.id && (
                    <div className="absolute inset-0 bg-gradient-to-b from-neon-blue/10 to-transparent pointer-events-none"></div>
                  )}
                  <span className="text-3xl relative z-10 drop-shadow-md">{game.icon}</span>
                  <span className="font-bold text-[13px] text-white relative z-10">{game.name}</span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md relative z-10">MIN {game.minPlayers}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 pt-2 pb-6">
        <button
          className="py-3 px-4 rounded-2xl bg-purple-900/20 border border-purple-500/30 hover:bg-purple-900/40 text-purple-300 font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg"
          onClick={() => { vibrateLight(); navigate('/werewolf-moderator'); }}
        >
          <ShieldAlert size={16} />
          สวมบทบาท GM ออฟไลน์ (Werewolf Moderator)
        </button>

        {(() => {
          const selectedGameObj = allGames.find(g => g.id === selectedGame);
          const minP = selectedGameObj?.minPlayers ?? 2;
          const notEnough = playersCount < minP;
          return (
            <>
              <button
                className="btn btn-primary w-full py-4 text-[17px] shadow-neon-blue relative overflow-hidden group"
                onClick={handleStartGame}
                disabled={notEnough}
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Play size={20} fill="currentColor" />
                  START MISSION
                </span>
              </button>
              {notEnough && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  className="text-center text-[12px] font-bold text-red-400 bg-red-900/30 border border-red-500/30 p-2.5 rounded-xl"
                >
                  ต้องการผู้เล่นอย่างน้อย {minP} คน
                </motion.p>
              )}
            </>
          );
        })()}
      </div>
    </section>
  );
};

export default GameSelector;

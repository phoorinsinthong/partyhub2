import React from 'react';
import NeonCard from '../../../components/NeonCard';
import GiantButton from '../../../components/GiantButton';
import { Pencil } from 'lucide-react';
import { WORD_CATEGORIES, TURN_TIME_OPTIONS, ROUNDS_OPTIONS } from './fakeArtistData';

export const WaitingPhase = ({
  players, selectedRounds, selectedTurnTime, isHost,
  wordMode, setWordMode, selectedCategory, setSelectedCategory,
  customWord, setCustomWord, setSelectedTurnTime, setSelectedRounds,
  handleStartGame
}) => (
  <div className="flex flex-col gap-4 flex-1 items-center justify-center py-6 bg-slate-950">
    <div className="text-center">
      <div className="text-6xl mb-4 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-bounce-soft">🎨</div>
      <h2 className="font-black text-[28px] uppercase tracking-widest text-slate-200 mb-2 drop-shadow-md">ศิลปิน<span className="text-amber-500">ปลอม</span></h2>
      <p className="text-slate-400 text-xs font-bold leading-relaxed px-4">
        ทุกคนวาดรูปตามคำ แต่มี 1 คนที่ไม่รู้คำ!<br />
        หาให้เจอว่าใครคือศิลปินปลอม
      </p>
    </div>
    
    <NeonCard color="amber" className="p-4 w-full max-w-xs text-center border-amber-500/30 bg-amber-900/10 mt-4">
      <div className="text-[12px] font-black text-amber-500 uppercase tracking-widest">
        ผู้เล่น {players.length} คน • วาด {selectedRounds} รอบ • {selectedTurnTime} วิ/ตา
      </div>
    </NeonCard>

    <div className="w-full max-w-xs px-2">
      {isHost ? (
        <div className="space-y-6 mt-4">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {['random', 'category', 'custom'].map((mode) => (
              <button
                key={mode}
                onClick={() => setWordMode(mode)}
                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${
                  wordMode === mode ? 'border-amber-500 bg-amber-500/20 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500'
                }`}
              >
                {{ random: 'สุ่มคำ', category: 'เลือกหมวด', custom: 'ตั้งคำเอง' }[mode as 'random'|'category'|'custom']}
              </button>
            ))}
          </div>
          {wordMode === 'category' && (
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(WORD_CATEGORIES).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    selectedCategory === key ? 'border-amber-500 bg-amber-500/20 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}
          {wordMode === 'custom' && (
            <input
              type="text"
              value={customWord}
              onChange={(e) => setCustomWord(e.target.value)}
              placeholder="พิมพ์คำที่ต้องการ..."
              className="w-full px-4 py-3 rounded-2xl border border-slate-700 bg-slate-900 text-center font-black text-[14px] text-white focus:border-amber-500 outline-none transition-colors placeholder:text-slate-600"
            />
          )}
          <div className="flex gap-4">
             <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 text-center">เวลาวาดต่อตา</p>
              <div className="flex flex-col gap-2">
                {TURN_TIME_OPTIONS.map(opt => (
                  <button
                    key={opt.seconds}
                    onClick={() => setSelectedTurnTime(opt.seconds)}
                    className={`w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-colors ${
                      selectedTurnTime === opt.seconds
                        ? 'bg-amber-500 border-amber-500 text-slate-900 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 text-center">จำนวนรอบวาด</p>
              <div className="flex flex-col gap-2">
                {ROUNDS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedRounds(opt.value)}
                    className={`w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-colors ${
                      selectedRounds === opt.value
                        ? 'bg-amber-500 border-amber-500 text-slate-900 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <GiantButton
            color="amber"
            onClick={handleStartGame}
            disabled={wordMode === 'custom' && !customWord.trim()}
            className="w-full mt-4"
          >
            <Pencil size={18} className="mr-2 inline-block" /> เริ่มเกม
          </GiantButton>
        </div>
      ) : (
        <p className="text-slate-500 font-black uppercase tracking-widest text-xs mt-8 text-center animate-pulse">รอ Host เริ่มเกม...</p>
      )}
    </div>
  </div>
);

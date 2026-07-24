import React from 'react';
import { motion } from 'framer-motion';
import { Eraser, Send, Pencil } from 'lucide-react';
import { TimerDisplay } from '@/components/game-ui';

const COLORS = ['#2f2a22', '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#ecf0f1'];
const BRUSH_SIZES = [3, 6, 12];

interface Props {
  renderErrorToast: () => React.ReactNode;
  round: number;
  totalRounds: number;
  gameData: any;
  timeLeft: number;
  roundTime: number;
  isDrawer: boolean;
  currentDrawer: string;
  currentWord: string;
  containerRef: React.RefObject<HTMLDivElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  handleDrawStart: (e: any) => void;
  handleDrawMove: (e: any) => void;
  handleDrawEnd: (e: any) => void;
  guesses: any;
  color: string;
  setColor: (c: string) => void;
  brushSize: number;
  setBrushSize: (s: number) => void;
  handleClear: () => void;
  hasGuessedCorrectly: boolean;
  guess: string;
  setGuess: (g: string) => void;
  handleGuess: () => void;
}

const DrawingPlayingPhase: React.FC<Props> = ({
  renderErrorToast,
  round,
  totalRounds,
  gameData,
  timeLeft,
  roundTime,
  isDrawer,
  currentDrawer,
  currentWord,
  containerRef,
  canvasRef,
  handleDrawStart,
  handleDrawMove,
  handleDrawEnd,
  guesses,
  color,
  setColor,
  brushSize,
  setBrushSize,
  handleClear,
  hasGuessedCorrectly,
  guess,
  setGuess,
  handleGuess
}) => {
  const timerPercent = (timeLeft / roundTime) * 100;
  const timerColor = timeLeft > 30 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : timeLeft > 10 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]';
  const hint = currentWord ? `${currentWord.charAt(0)}${'＿'.repeat(currentWord.length - 1)}` : '';

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 flex flex-col" style={{ height: '100dvh' }}>
      {renderErrorToast()}
      <div className="flex items-center justify-between px-3 h-12 bg-slate-900 border-b border-slate-800 shrink-0" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg">
            {round + 1}/{totalRounds}
          </span>
          <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-lg mr-2 uppercase tracking-widest">
            {{ easy: 'ง่าย', medium: 'กลาง', hard: 'ยาก', funny: 'ฮาๆ', random: 'สุ่ม', custom: 'กำหนดเอง' }[gameData.difficulty as keyof typeof ROUND_TIME] || 'ง่าย'}
          </span>
          <TimerDisplay timeLeft={timeLeft} />
        </div>
        <div className="flex items-center gap-2">
          <Pencil size={12} className="text-slate-500" />
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            {isDrawer ? 'คุณวาด' : currentDrawer}
          </span>
          {isDrawer ? (
            <span className="text-[11px] font-black text-emerald-900 bg-emerald-400 px-3 py-1 rounded-xl shadow-[0_0_10px_rgba(52,211,153,0.5)] ml-1">
              {currentWord}
            </span>
          ) : (
            <span className="text-[18px] font-black text-slate-200 bg-slate-800 px-3 py-1 rounded-xl tracking-[0.2em] border border-slate-700 ml-1">
              {hint}
            </span>
          )}
        </div>
      </div>

      <div className="h-[3px] bg-slate-800 shrink-0 relative overflow-hidden">
        <motion.div
          className={`absolute top-0 left-0 bottom-0 ${timerColor}`}
          animate={{ width: `${timerPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden bg-slate-950">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          style={{ cursor: isDrawer ? 'crosshair' : 'default', backgroundColor: '#ffffff' }}
          onMouseDown={handleDrawStart}
          onMouseMove={handleDrawMove}
          onMouseUp={handleDrawEnd}
          onMouseLeave={handleDrawEnd}
          onTouchStart={handleDrawStart}
          onTouchMove={handleDrawMove}
          onTouchEnd={handleDrawEnd}
          onTouchCancel={handleDrawEnd}
        />
        {Object.keys(guesses).length > 0 && (
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 pointer-events-none max-h-[40px] overflow-hidden justify-end">
            {Object.entries(guesses).map(([name, g]: any) => (
              <span
                key={name}
                className={`text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-md shadow-md ${
                  g.correct ? 'bg-emerald-500/90 text-slate-900 font-black' : 'bg-slate-900/80 text-slate-300 border border-slate-700'
                }`}
              >
                {name}: {g.correct ? '✅' : g.text}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 bg-slate-900 border-t border-slate-800 p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-10 relative" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        {isDrawer ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 flex-1 overflow-x-auto hide-scrollbar pb-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full shrink-0 transition-all ${
                    color === c ? 'border-[3px] border-emerald-400 scale-110 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'border-2 border-slate-800 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1 bg-slate-800 p-1.5 rounded-2xl border border-slate-700">
              {BRUSH_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setBrushSize(s)}
                  className={`w-8 h-8 rounded-xl flex-center transition-colors ${brushSize === s ? 'bg-slate-700 border border-slate-600 shadow-inner' : 'hover:bg-slate-700/50'}`}
                >
                  <div className="rounded-full bg-slate-300" style={{ width: s + 2, height: s + 2 }} />
                </button>
              ))}
            </div>
            <button onClick={handleClear} className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/30 flex-center text-red-500 active:scale-90 transition-all hover:bg-red-500/20">
              <Eraser size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {hasGuessedCorrectly ? (
              <div className="flex-1 flex-center gap-2 py-2 bg-emerald-500/10 rounded-2xl border border-emerald-500/30">
                <span className="text-[14px] font-black text-emerald-400 tracking-widest drop-shadow-sm">✅ ทายถูกแล้ว!</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="w-full py-3 px-5 bg-slate-950 border border-slate-700 rounded-full text-[14px] font-bold text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                  placeholder="พิมพ์คำตอบ..."
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleGuess(); }}
                  enterKeyHint="send"
                  maxLength={50}
                />
                <button
                  onClick={handleGuess}
                  disabled={!guess.trim()}
                  className="w-12 h-12 rounded-full bg-emerald-500 text-slate-900 flex-center shrink-0 active:scale-90 transition-transform disabled:opacity-40 disabled:grayscale shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                >
                  <Send size={18} className="ml-1" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DrawingPlayingPhase;

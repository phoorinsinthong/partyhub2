import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil } from 'lucide-react';
import NeonCard from '../../../components/ui/NeonCard';
import { TimerDisplay } from '../../../components/game-ui/TimerDisplay';

export const DrawingPhase = ({
  skippedPlayer, turnAnnounce, userNickname, currentRound, totalRounds,
  timeLeft, turnTime, iAmFakeArtist, secretWord, secretSyllables,
  currentPlayer, colorMap, isMyTurn, turnOrder, currentTurnIndex,
  containerRef, canvasRef, canvasSize, startDraw, moveDraw, endDraw
}) => (
  <div className="flex flex-col gap-3 flex-1 bg-slate-950 p-2">
    <AnimatePresence>
      {skippedPlayer && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-900 px-5 py-3 rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.5)]"
        >
          {skippedPlayer} หมดเวลา! ข้ามตา
        </motion.div>
      )}
      {turnAnnounce && !skippedPlayer && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-900 px-6 py-3 rounded-2xl font-black text-[14px] uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center gap-2"
        >
          <Pencil size={16} />
          {turnAnnounce === userNickname ? 'ถึงตาคุณวาด!' : `ถึงตา ${turnAnnounce} วาด`}
        </motion.div>
      )}
    </AnimatePresence>

    <NeonCard color="slate" className="p-3 bg-slate-900/50 border-slate-800 rounded-3xl mx-1">
      <div className="flex-between mb-3">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800 px-2 py-1 rounded-lg">รอบ {currentRound}/{totalRounds}</span>
        <div className="flex items-center gap-1.5">
          <TimerDisplay timeLeft={timeLeft} />
        </div>
        {!iAmFakeArtist && (
          <span className="text-[11px] font-black text-slate-400">คำ: <span className="text-emerald-400 ml-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">{secretWord}</span></span>
        )}
        {iAmFakeArtist && (
          <span className="text-[11px] font-black text-red-500">คำ: ??? <span className="text-amber-500 ml-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">{secretSyllables} พยางค์</span></span>
        )}
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full mb-3 overflow-hidden shadow-inner">
        <motion.div
          className={`h-full rounded-full ${timeLeft <= 5 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : timeLeft <= 10 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'}`}
          animate={{ width: `${(timeLeft / turnTime) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <div className="flex items-center gap-2 px-1">
        <div className="w-5 h-5 rounded-full border-2 border-slate-300 shadow-[0_0_10px_rgba(255,255,255,0.2)]" style={{ backgroundColor: colorMap[currentPlayer] }} />
        <span className={`text-[12px] font-black uppercase tracking-widest ${isMyTurn ? 'text-emerald-400 animate-pulse' : 'text-slate-300'}`}>
          {isMyTurn ? 'ถึงตาคุณวาด!' : `${currentPlayer} กำลังวาด...`}
        </span>
      </div>
    </NeonCard>

    <div className="flex gap-2 overflow-x-auto px-2 pb-2 hide-scrollbar">
      {turnOrder.map((p: string, i: number) => (
        <div
          key={p}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
            i === currentTurnIndex ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)] scale-105' : 'bg-slate-900 border border-slate-800 text-slate-500'
          }`}
        >
          <div className="w-3 h-3 rounded-full border border-slate-700" style={{ backgroundColor: colorMap[p] }} />
          {p === userNickname ? 'คุณ' : p}
        </div>
      ))}
    </div>

    <div ref={containerRef} className="flex-1 min-h-[300px] relative rounded-3xl overflow-hidden border-2 border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.5)] mx-1">
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        className={`absolute inset-0 w-full h-full bg-slate-900 ${isMyTurn ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
        style={{ touchAction: 'none', backgroundColor: '#ffffff' }}
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
      />
    </div>

    {isMyTurn && (
      <p className="text-center text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 mx-1 mt-1 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
        วาดเส้นเดียว แล้วยกนิ้วเพื่อจบตา
      </p>
    )}
  </div>
);

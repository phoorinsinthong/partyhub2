import React from 'react';
import { motion } from 'framer-motion';
import { Share2, Trophy, RotateCcw, LogOut } from 'lucide-react';
import NeonCard from '../../components/NeonCard';
import GiantButton from '../../components/GiantButton';
import LeaveConfirmModal from '../../components/LeaveConfirmModal';

interface Props {
  phase: string;
  guesses: any;
  gameData: any;
  players: string[];
  round: number;
  renderErrorToast: () => React.ReactNode;
  currentWord: string;
  currentDrawer: string;
  shareCanvasRef: React.RefObject<HTMLCanvasElement>;
  handleShare: () => void;
  isHost: boolean;
  handleNextRound: () => void;
  scores: any;
  showConfirm: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
  handleStartGame: () => void;
  handleBackToLobby: () => void;
  requestLeave: () => void;
}

const DrawingResultPhase: React.FC<Props> = ({
  phase,
  guesses,
  gameData,
  players,
  round,
  renderErrorToast,
  currentWord,
  currentDrawer,
  shareCanvasRef,
  handleShare,
  isHost,
  handleNextRound,
  scores,
  showConfirm,
  confirmLeave,
  cancelLeave,
  handleStartGame,
  handleBackToLobby,
  requestLeave
}) => {
  if (phase === 'roundEnd') {
    const correctGuessers = Object.entries(guesses).filter(([, g]: any) => g.correct).map(([name]) => name);
    const drawerOrder = gameData.drawerOrder || players;
    const isLastRound = (round + 1) >= drawerOrder.length;

    return (
      <div className="flex-1 flex flex-col gap-5 py-6 px-4 animate-fade-in bg-slate-950 text-slate-200">
        {renderErrorToast()}
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <span className="text-6xl drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">{correctGuessers.length > 0 ? '🎉' : '⏰'}</span>
          <h3 className="font-black text-[24px] uppercase tracking-widest text-slate-200 mt-3 drop-shadow-md">
            {correctGuessers.length > 0 ? 'ทายถูก!' : 'หมดเวลา!'}
          </h3>
        </motion.div>

        <NeonCard color="amber" className="p-6 text-center bg-amber-900/10 border-amber-500/30">
          <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest mb-2 drop-shadow-sm">คำตอบคือ</p>
          <p className="font-black text-[32px] text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">{currentWord}</p>
          <p className="text-[12px] font-bold text-slate-400 mt-2">วาดโดย <span className="text-slate-200">{currentDrawer}</span></p>
        </NeonCard>

        <div className="p-2 bg-slate-900 rounded-[28px] border border-slate-700 shadow-xl overflow-hidden mx-auto w-full max-w-[320px]">
          <canvas
            ref={shareCanvasRef}
            width={300}
            height={300}
            className="w-full rounded-[20px]"
            style={{ aspectRatio: '1/1', background: '#fff' }}
          />
        </div>

        {correctGuessers.length > 0 && (
          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
            <p className="text-[11px] font-black text-emerald-500 uppercase tracking-widest mb-3">ทายถูก:</p>
            <div className="flex flex-wrap gap-2">
              {correctGuessers.map(name => (
                <span key={name} className="text-[12px] font-bold bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                  ✅ {name}
                </span>
              ))}
            </div>
          </div>
        )}

        <button onClick={handleShare} className="py-4 text-[13px] font-black uppercase tracking-widest border border-slate-700 bg-slate-900 text-slate-300 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:border-slate-500">
          <Share2 size={16} /> แชร์รูปวาด
        </button>

        {isHost ? (
          <GiantButton color="emerald" onClick={handleNextRound} className="mt-2">
            {isLastRound ? '🏆 ดูผลลัพธ์' : '➡️ รอบถัดไป'}
          </GiantButton>
        ) : (
          <p className="text-slate-500 font-black uppercase tracking-widest text-xs mt-4 text-center animate-pulse">รอ Host...</p>
        )}
      </div>
    );
  }

  if (phase === 'finished') {
    const sortedScores = Object.entries(scores).sort((a: any, b: any) => b[1] - a[1]);
    const winner = sortedScores[0];

    return (
      <div className="flex-1 flex flex-col gap-5 py-6 px-4 animate-fade-in bg-slate-950 text-slate-200">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-center">
          <span className="text-6xl drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]">🏆</span>
          <h2 className="font-black text-[28px] uppercase tracking-widest text-slate-200 mt-3 drop-shadow-md">จบเกม!</h2>
        </div>
        {winner && (
          <NeonCard color="amber" className="p-6 text-center bg-amber-900/20 border-amber-500/50">
            <Trophy size={32} className="text-amber-500 mx-auto mb-3 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
            <p className="font-black text-[22px] text-amber-400 drop-shadow-md">{winner[0]}</p>
            <p className="text-[28px] font-black text-white mt-1">{winner[1] as number} <span className="text-lg text-amber-500">คะแนน</span></p>
          </NeonCard>
        )}
        <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
          <h3 className="font-black text-[12px] text-slate-400 uppercase tracking-widest mb-4 text-center">คะแนนรวม</h3>
          <div className="space-y-3">
            {sortedScores.map(([name, score], idx) => (
              <div key={name} className="flex items-center gap-4 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className={`w-8 h-8 rounded-full flex-center text-[14px] font-black ${idx === 0 ? 'bg-amber-500 text-slate-900 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-slate-800 text-slate-400'}`}>{idx + 1}</span>
                <span className={`flex-1 font-bold text-[16px] ${idx === 0 ? 'text-amber-400' : 'text-slate-300'}`}>{name}</span>
                <span className="font-black text-[18px] text-white">{score as number}</span>
              </div>
            ))}
          </div>
        </div>
        {isHost ? (
          <div className="space-y-3 mt-4">
            <GiantButton color="emerald" onClick={handleStartGame}>
              <RotateCcw size={20} className="mr-2 inline-block" /> เล่นอีกรอบ
            </GiantButton>
            <button onClick={handleBackToLobby} className="w-full py-4 text-[13px] font-black uppercase tracking-widest border border-slate-700 bg-slate-900 text-slate-400 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2">
              <LogOut size={16} /> กลับ Lobby
            </button>
          </div>
        ) : (
          <button
            className="w-full py-4 text-[13px] font-black uppercase tracking-widest border border-red-500/50 bg-red-500/10 text-red-500 rounded-2xl active:scale-95 transition-all mt-6 flex items-center justify-center gap-2"
            onClick={requestLeave}
          >
            <LogOut size={16} /> ออกจากห้อง
          </button>
        )}
      </div>
    );
  }

  return null;
};

export default DrawingResultPhase;

import React from 'react';
import { NeonCard } from '@/components/ui';
import { GiantButton } from '@/components/ui';

interface WaitingPhaseProps {
  players: string[];
  isHost: boolean;
  totalQuestions: number;
  questionTime: number;
  handleStartQuiz: () => void;
  renderErrorToast: () => React.ReactNode;
}

const WaitingPhase: React.FC<WaitingPhaseProps> = ({
  players,
  isHost,
  totalQuestions,
  questionTime,
  handleStartQuiz,
  renderErrorToast
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 bg-slate-950 text-slate-200">
      {renderErrorToast()}
      <div className="text-8xl animate-bounce-soft drop-shadow-[0_0_20px_rgba(245,158,11,0.5)] text-amber-500">?</div>
      <div className="text-center px-4">
        <h2 className="font-black text-[32px] uppercase tracking-widest text-slate-200 mb-2 drop-shadow-md">Quiz Trivia</h2>
        <p className="text-slate-400 text-[12px] font-bold leading-relaxed max-w-[280px] mx-auto">ตอบคำถามให้เร็วที่สุด ยิ่งเร็วยิ่งได้คะแนนเยอะ!</p>
      </div>
      <NeonCard color="amber" className="p-4 w-full max-w-xs border-amber-500/30 bg-amber-900/10">
        <div className="text-center space-y-1">
          <p className="text-[12px] font-black uppercase tracking-widest text-amber-500">{totalQuestions} คำถาม • {questionTime} วินาที/ข้อ</p>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{players.length} ผู้เล่น</p>
        </div>
      </NeonCard>
      {isHost ? (
        <GiantButton color="amber" onClick={handleStartQuiz} className="w-full max-w-xs mt-4">
          เริ่มเกม!
        </GiantButton>
      ) : (
        <div className="flex flex-col items-center gap-4 mt-8">
          <div className="w-8 h-8 border-4 border-slate-800 border-t-amber-500 rounded-full animate-spin shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 animate-pulse">รอ Host เริ่มเกม...</span>
        </div>
      )}
    </div>
  );
};

export default WaitingPhase;

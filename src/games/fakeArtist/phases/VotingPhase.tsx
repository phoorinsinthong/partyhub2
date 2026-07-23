import React from 'react';
import { Maximize2 } from 'lucide-react';
import GiantButton from '../../../components/GiantButton';

export const VotingPhase = ({
  players, votes, userNickname, colorMap, voteTarget, setVoteTarget,
  containerRef, canvasRef, canvasSize, setShowFullCanvas, handleVote
}) => (
  <div className="flex-1 flex flex-col p-4 bg-slate-950 text-slate-200 animate-fade-in">
    <h2 className="font-black text-[22px] uppercase tracking-widest text-amber-500 mb-1 text-center drop-shadow-md">โหวตหาศิลปินปลอม!</h2>
    <p className="text-slate-500 font-bold text-[11px] uppercase tracking-widest text-center mb-4">โหวตแล้ว {Object.keys(votes || {}).length}/{players.length}</p>

    <div ref={containerRef} className="relative rounded-3xl overflow-hidden mb-6 border-2 border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        className="w-full bg-white"
        style={{ height: `${Math.min(canvasSize.w * 0.6, 240)}px` }}
      />
      <button
        onClick={() => setShowFullCanvas(true)}
        className="absolute top-3 right-3 w-10 h-10 rounded-2xl bg-slate-900/80 backdrop-blur-md flex-center border border-slate-700 text-white active:scale-95 transition-all shadow-lg hover:bg-slate-800"
      >
        <Maximize2 size={16} />
      </button>
    </div>

    <div className="space-y-3 flex-1 overflow-y-auto hide-scrollbar pb-24">
      {players.map((p) => (
        <button
          key={p}
          disabled={!!(votes && votes[userNickname || '']) || p === userNickname}
          onClick={() => setVoteTarget(p)}
          className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
            voteTarget === p || (votes && votes[userNickname || ''] === p) ? 'border-amber-500 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-[1.02]' : 'border-slate-800 bg-slate-900 hover:border-slate-600'
          } ${p === userNickname ? 'opacity-40 grayscale' : ''}`}
        >
          <div className="w-6 h-6 rounded-full border border-slate-700 shadow-sm" style={{ backgroundColor: colorMap[p] }} />
          <span className={`font-black text-[14px] uppercase tracking-widest ${voteTarget === p ? 'text-amber-400' : 'text-slate-300'}`}>{p}</span>
          {p === userNickname && <span className="text-[10px] font-bold text-slate-500 ml-auto uppercase tracking-widest bg-slate-800 px-2 py-1 rounded-md">(คุณ)</span>}
        </button>
      ))}
    </div>

    <div className="absolute bottom-4 left-4 right-4 z-10">
      {!(votes && votes[userNickname || '']) && voteTarget && (
        <GiantButton color="amber" onClick={handleVote} className="w-full shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
          ยืนยันโหวต
        </GiantButton>
      )}
      {(votes && votes[userNickname || '']) && (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.8)] text-center">
           <p className="text-amber-500 font-black text-[12px] uppercase tracking-widest animate-pulse">โหวตแล้ว — รอคนอื่น...</p>
        </div>
      )}
    </div>
  </div>
);

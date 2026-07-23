import React from 'react';
import { Maximize2, LogOut } from 'lucide-react';
import NeonCard from '../../../components/NeonCard';
import GiantButton from '../../../components/GiantButton';

export const FinishedPhase = ({
  voteResult, fakeArtist, secretWord, fakeGuess, players, colorMap,
  isHost, handlePlayAgain, handleBackToLobby, requestLeave,
  containerRef, canvasRef, canvasSize, setShowFullCanvas
}) => (
  <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-200 animate-fade-in pb-24">
    <div className={`text-7xl mb-4 drop-shadow-[0_0_20px_rgba(${voteResult === 'artists_win' ? '16,185,129' : '239,68,68'},0.5)]`}>
       {voteResult === 'artists_win' ? '🎨' : '🎭'}
    </div>
    <h2 className={`font-black text-[28px] uppercase tracking-widest mb-6 drop-shadow-md ${voteResult === 'artists_win' ? 'text-emerald-400' : 'text-red-500'}`}>
      {voteResult === 'artists_win' ? 'ศิลปินตัวจริงชนะ!' : 'ศิลปินปลอมชนะ!'}
    </h2>

    <NeonCard color={voteResult === 'artists_win' ? 'emerald' : 'red'} className={`w-full max-w-sm p-6 mb-6 text-center ${voteResult === 'artists_win' ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
      <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-1">ศิลปินปลอม</p>
      <p className="font-black text-[20px] text-red-400 mb-4">{fakeArtist}</p>
      
      <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">คำที่ต้องวาด</p>
      <p className="font-black text-[24px] text-white mb-4 drop-shadow-md">{secretWord}</p>
      
      {fakeGuess && (
        <div className="mt-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">ศิลปินปลอมเดา</p>
          <p className={`font-black text-[18px] ${fakeGuess.toLowerCase() === secretWord.toLowerCase() ? 'text-emerald-400' : 'text-red-500'}`}>{fakeGuess}</p>
        </div>
      )}
      
      {voteResult === 'fake_wins' && (
        <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest mt-4 bg-amber-500/10 px-3 py-1.5 rounded-lg inline-block border border-amber-500/30">โหวตผิดคน — ศิลปินปลอมรอดไป!</p>
      )}
      {voteResult === 'fake_guessed' && (
        <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest mt-4 bg-amber-500/10 px-3 py-1.5 rounded-lg inline-block border border-amber-500/30">โดนจับได้แต่เดาคำถูก!</p>
      )}
    </NeonCard>

    <div ref={containerRef} className="relative w-full max-w-[280px] rounded-3xl overflow-hidden mb-6 border-2 border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
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

    <div className="flex flex-wrap gap-2 justify-center mb-6 max-w-sm">
      {players.map((p) => (
        <div key={p} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
          <div className="w-3.5 h-3.5 rounded-full border border-slate-700" style={{ backgroundColor: colorMap[p] }} />
          <span className={p === fakeArtist ? 'text-red-400' : ''}>{p}</span>
        </div>
      ))}
    </div>

    <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50">
      {isHost ? (
        <div className="flex gap-3 max-w-sm mx-auto">
          <GiantButton color="emerald" onClick={handlePlayAgain} className="flex-1">
             เล่นอีกรอบ
          </GiantButton>
          <button onClick={handleBackToLobby} className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:border-slate-500">
            กลับ Lobby
          </button>
        </div>
      ) : (
        <button onClick={requestLeave} className="w-full max-w-sm mx-auto py-4 text-[12px] font-black uppercase tracking-widest border border-red-500/50 bg-red-500/10 text-red-500 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-500/20">
          <LogOut size={16} /> ออกจากห้อง
        </button>
      )}
    </div>
  </div>
);

import React from 'react';
import { Timer, Search, ChevronDown } from 'lucide-react';
import { EpicPopup } from '@/components/ui';
import { HoldToRevealCard } from '@/components/ui';
import { GiantButton } from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';

export interface PlayingPhaseProps {
  renderErrorToast: () => React.ReactNode;
  gameData: any;
  myGameData: any;
  nickname: string;
  timeLeft: number;
  showLocations: boolean;
  setShowLocations: (s: boolean) => void;
  showGuessModal: boolean;
  setShowGuessModal: (s: boolean) => void;
  selectedGuess: string;
  setSelectedGuess: (s: string) => void;
  handleReveal: () => void;
  handleCancelReveal: () => void;
  handleGuess: () => void;
  getVoteRequestInfo: () => { wantsCount: number; threshold: number };
  requestVote: () => void;
  cancelVoteRequest: () => void;
}

export const PlayingPhase: React.FC<PlayingPhaseProps> = ({
  renderErrorToast,
  gameData,
  myGameData,
  nickname,
  timeLeft,
  showLocations,
  setShowLocations,
  showGuessModal,
  setShowGuessModal,
  selectedGuess,
  setSelectedGuess,
  handleReveal,
  handleCancelReveal,
  handleGuess,
  getVoteRequestInfo,
  requestVote,
  cancelVoteRequest
}) => {
  const { wantsCount, threshold } = getVoteRequestInfo();
  const isSpy = myGameData?.isSpy;
  const isAccomplice = myGameData?.isAccomplice;

  return (
    <div className="flex flex-col gap-4 w-full animate-fade-in relative z-10 p-4">
      {renderErrorToast()}
      
      <EpicPopup
        isOpen={!!gameData.spyRevealing}
        title="SPY REVEALED"
        subtitle={`"${gameData.spyRevealing}" กำลังทายสถานที่...`}
        type="danger"
        icon="🚨"
      />

      <div className="flex justify-center mb-2">
        <div className="bg-slate-900 border border-neon-blue shadow-[0_0_15px_rgba(0,240,255,0.2)] rounded-3xl px-6 py-3 flex items-center gap-3">
          <Timer size={20} className="text-neon-blue" />
          <span className="font-display font-black text-3xl text-white tracking-widest">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {gameData.placeCategory && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">หมวดหมู่:</span>
          <span className="text-[12px] font-black text-neon-pink uppercase tracking-widest bg-neon-pink/10 px-3 py-1 rounded-full border border-neon-pink/30">{gameData.placeCategory}</span>
        </div>
      )}

      <HoldToRevealCard placeholderText="กดค้างไว้เพื่อดูบทบาท" className="mb-4 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <h2 className={`font-display font-black text-4xl uppercase tracking-widest mb-2 ${
          isSpy ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]' 
            : isAccomplice ? 'text-purple-500 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]' 
            : 'text-neon-blue drop-shadow-[0_0_15px_rgba(0,240,255,0.8)]'
        }`}>
          {isSpy ? 'SPY' : isAccomplice ? 'ACCOMPLICE' : 'CITIZEN'}
        </h2>
        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 w-full max-w-[200px] text-center mb-2">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">สถานที่</p>
          <p className="text-xl font-bold text-white">
            {isSpy || isAccomplice ? '???' : myGameData.place}
          </p>
        </div>
        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 w-full max-w-[200px] text-center">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">อาชีพ/บทบาท</p>
          <p className="text-xl font-bold text-white">
            {isSpy ? 'สายลับ' : myGameData.role}
          </p>
        </div>
        
        {isSpy && <p className="text-red-400 text-xs mt-4 font-bold animate-pulse text-center">หาที่นี่ให้เจอจากคำพูดคนอื่น!</p>}
        {isAccomplice && <p className="text-purple-400 text-xs mt-4 font-bold text-center">ช่วยปกป้องสายลับ: {myGameData.spyName}</p>}
      </HoldToRevealCard>

      {isSpy && !gameData.spyRevealing && (
        <GiantButton color="pink" onClick={handleReveal} className="mb-4 shadow-[0_0_30px_rgba(255,20,147,0.3)]">
          ประกาศตัวทายสถานที่!
        </GiantButton>
      )}

      <button
        className="w-full py-3 rounded-xl border border-slate-700 bg-slate-800 flex items-center justify-center gap-2 text-[12px] font-bold text-slate-300 hover:text-white transition-colors"
        onClick={() => setShowLocations(!showLocations)}
      >
        <Search size={16} /> {showLocations ? 'ซ่อนโพยสถานที่' : 'ดูโพยสถานที่'}
      </button>

      <AnimatePresence>
        {showLocations && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2 mt-4 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {gameData.allPlaces?.map((p: string) => (
                <div key={p} className="text-[11px] p-3 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-300 font-bold text-center">
                  {p}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-[1px] bg-slate-700 my-2" />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-slate-400 uppercase">ขอโหวต: {wantsCount}/{threshold} คน</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-neon-blue transition-all duration-300" style={{ width: `${Math.min(100, (wantsCount / threshold) * 100)}%` }} />
        </div>
        {myGameData.wantsToVote ? (
          <button className="py-2.5 rounded-xl border border-neon-blue bg-neon-blue/10 text-neon-blue font-bold text-[12px]" onClick={cancelVoteRequest}>
            ยกเลิกคำขอโหวต
          </button>
        ) : (
          <button className="py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold text-[12px]" onClick={requestVote}>
            โหวตจับสายลับ
          </button>
        )}
      </div>

      {/* Guess Modal for Spy */}
      <AnimatePresence>
        {showGuessModal && myGameData.isSpy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex-center p-4 bg-slate-950/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="glass-panel p-6 w-full max-w-sm flex flex-col gap-4 border-neon-pink shadow-neon-pink">
              <h3 className="font-display font-black text-2xl text-neon-pink uppercase tracking-widest text-center">ทายสถานที่</h3>
              <p className="text-slate-300 text-sm text-center">เลือกสถานที่ที่คุณคิดว่าถูกต้อง หากทายถูกคุณจะชนะทันที!</p>
              <div className="relative mt-2">
                <select
                  className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-neon-pink outline-none appearance-none"
                  value={selectedGuess}
                  onChange={(e) => setSelectedGuess(e.target.value)}
                >
                  <option value="">-- เลือกสถานที่ --</option>
                  {gameData.allPlaces?.map((p: string) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
              </div>
              <div className="flex gap-3 mt-4">
                {!gameData.spyForced && (
                  <button className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold" onClick={handleCancelReveal}>ยกเลิก</button>
                )}
                <button 
                  className={`flex-1 py-3 rounded-xl font-black shadow-[0_0_15px_rgba(255,20,147,0.4)] ${selectedGuess ? 'bg-neon-pink text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                  onClick={handleGuess} disabled={!selectedGuess}
                >
                  ยืนยัน
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

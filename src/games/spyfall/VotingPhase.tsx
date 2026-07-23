import React from 'react';
import { Vote, CheckCircle2, ChevronDown } from 'lucide-react';
import EpicPopup from '../../components/ui/EpicPopup';
import NeonCard from '../../components/ui/NeonCard';
import GiantButton from '../../components/ui/GiantButton';
import { motion, AnimatePresence } from 'framer-motion';

export interface VotingPhaseProps {
  renderErrorToast: () => React.ReactNode;
  gameData: any;
  myGameData: any;
  nickname: string;
  gamePlayerList: string[];
  gamePlayerCount: number;
  myVote: string;
  votedCount: number;
  voteTarget: string;
  setVoteTarget: (s: string) => void;
  submitVote: () => void;
  showGuessModal: boolean;
  selectedGuess: string;
  setSelectedGuess: (s: string) => void;
  handleGuess: () => void;
  vibrateLight: () => void;
}

export const VotingPhase: React.FC<VotingPhaseProps> = ({
  renderErrorToast,
  gameData,
  myGameData,
  nickname,
  gamePlayerList,
  gamePlayerCount,
  myVote,
  votedCount,
  voteTarget,
  setVoteTarget,
  submitVote,
  showGuessModal,
  selectedGuess,
  setSelectedGuess,
  handleGuess,
  vibrateLight
}) => {
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
      
      <NeonCard color="amber" className="text-center py-6">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 flex-center mx-auto mb-4 shadow-[0_0_20px_rgba(251,191,36,0.5)]">
          <Vote size={32} className="text-amber-500" />
        </div>
        <h2 className="font-display font-black text-2xl text-amber-500 uppercase tracking-widest mb-1">VOTE TIME</h2>
        <p className="text-[12px] font-bold text-slate-300">เลือกคนที่คุณคิดว่าเป็นสายลับ</p>
        <p className="text-[10px] text-amber-500/70 font-bold uppercase mt-2">โหวตแล้ว {votedCount}/{gamePlayerCount} คน</p>
      </NeonCard>

      {!myVote ? (
        <div className="flex flex-col gap-3 mt-4">
          {gamePlayerList.filter(p => p !== nickname).map(p => (
            <button
              key={p}
              onClick={() => { vibrateLight(); setVoteTarget(p); }}
              className={`w-full p-4 rounded-2xl border-2 flex items-center gap-3 transition-all text-left ${
                voteTarget === p
                  ? 'border-neon-pink bg-neon-pink/10 text-white shadow-[0_0_15px_rgba(255,20,147,0.3)]'
                  : 'border-slate-700 bg-slate-800/50 text-slate-300'
              }`}
            >
              <div className="w-10 h-10 rounded-full flex-center bg-slate-900 border border-slate-600 font-bold text-[14px]">
                {p.charAt(0)}
              </div>
              <span className="font-bold flex-1">{p}</span>
              {voteTarget === p && <CheckCircle2 size={20} className="text-neon-pink" />}
            </button>
          ))}

          <GiantButton color="pink" className="mt-4" onClick={submitVote} disabled={!voteTarget}>
            ยืนยันโหวต
          </GiantButton>
        </div>
      ) : (
        <div className="mt-8 p-6 text-center">
          <div className="w-20 h-20 bg-neon-green/20 rounded-full flex-center mx-auto mb-4 border border-neon-green shadow-[0_0_20px_rgba(57,255,20,0.3)]">
            <CheckCircle2 size={40} className="text-neon-green" />
          </div>
          <p className="font-bold text-white text-lg">คุณโหวตให้ "{myVote}" แล้ว</p>
          <p className="text-slate-400 text-sm mt-2">รอผู้เล่นคนอื่น...</p>
        </div>
      )}

      <AnimatePresence>
        {showGuessModal && myGameData?.isSpy && gameData.spyRevealing === nickname && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex-center p-4 bg-slate-950/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="glass-panel p-6 w-full max-w-sm flex flex-col gap-4 border-neon-pink shadow-neon-pink">
              <h3 className="font-display font-black text-2xl text-neon-pink uppercase tracking-widest text-center">ทายสถานที่</h3>
              <p className="text-slate-300 text-sm text-center">ชาวบ้านโหวตผิดคน! คุณได้โอกาสทายสถานที่ หากทายถูกคุณจะชนะ!</p>
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
              <GiantButton color="pink" className="mt-4" onClick={handleGuess} disabled={!selectedGuess}>
                ยืนยันทาย
              </GiantButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

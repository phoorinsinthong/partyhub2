import React from 'react';
import NeonCard from '../../../components/NeonCard';
import GiantButton from '../../../components/GiantButton';

export const FakeGuessPhase = ({
  fakeArtist, secretSyllables, iAmFakeArtist, guessInput, setGuessInput, handleFakeGuess
}) => (
  <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-200 animate-fade-in">
    <div className="text-6xl mb-4 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">🎯</div>
    <h2 className="font-black text-[24px] uppercase tracking-widest text-slate-200 mb-2 drop-shadow-md">จับศิลปินปลอมได้!</h2>
    <NeonCard color="red" className="p-6 w-full max-w-sm text-center bg-red-900/10 border-red-500/30">
      <p className="text-slate-300 text-[13px] font-bold leading-relaxed mb-4">
        <span className="font-black text-[18px] text-red-500 block mb-1">{fakeArtist}</span> คือศิลปินปลอม!<br />
        <span className="text-slate-400">แต่ถ้าเดาคำถูก ก็ยังชนะได้...</span>
      </p>
      <p className="text-[12px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 inline-block px-4 py-2 rounded-xl uppercase tracking-widest shadow-[0_0_10px_rgba(245,158,11,0.2)]">
        💡 ใบ้: {secretSyllables} พยางค์
      </p>
    </NeonCard>

    <div className="w-full max-w-sm mt-8">
      {iAmFakeArtist ? (
        <div className="space-y-4">
          <input
            type="text"
            value={guessInput}
            onChange={(e) => setGuessInput(e.target.value)}
            placeholder="พิมพ์คำที่คิดว่าถูก..."
            className="w-full px-6 py-4 rounded-2xl border border-slate-700 bg-slate-900 text-center font-black text-[16px] text-white focus:border-red-500 outline-none transition-colors placeholder:text-slate-600 shadow-inner"
          />
          <GiantButton
            color="red"
            onClick={handleFakeGuess}
            disabled={!guessInput.trim()}
            className="w-full"
          >
            ยืนยันคำตอบ
          </GiantButton>
        </div>
      ) : (
        <p className="text-slate-500 text-xs font-black uppercase tracking-widest text-center animate-pulse mt-4">รอศิลปินปลอมเดาคำ...</p>
      )}
    </div>
  </div>
);

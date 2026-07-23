import React from 'react';
import NeonCard from '../../components/ui/NeonCard';
import GiantButton from '../../components/ui/GiantButton';

interface Props {
  isDrawer: boolean;
  showWordChoices: boolean;
  gameData: any;
  renderErrorToast: () => React.ReactNode;
  customWordInput: string;
  setCustomWordInput: (val: string) => void;
  handleChooseWord: (word: string) => void;
  pendingWord: string;
  hasRerolled: boolean;
  handleReroll: () => void;
  roundTime: number;
  currentDrawer: string;
}

const DrawingGuessingPhase: React.FC<Props> = ({
  isDrawer,
  showWordChoices,
  gameData,
  renderErrorToast,
  customWordInput,
  setCustomWordInput,
  handleChooseWord,
  pendingWord,
  hasRerolled,
  handleReroll,
  roundTime,
  currentDrawer,
}) => {
  if (isDrawer && showWordChoices) {
    if (gameData.difficulty === 'custom') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 bg-slate-950 text-slate-200">
          {renderErrorToast()}
          <div className="text-6xl drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">✏️</div>
          <div className="text-center">
            <h2 className="font-black text-[22px] uppercase tracking-widest text-emerald-400 mb-1 drop-shadow-md">ถึงตาคุณวาด!</h2>
            <p className="text-slate-400 text-xs font-bold">พิมพ์คำที่คุณอยากวาดให้เพื่อนทาย</p>
          </div>
          <div className="w-full max-w-xs space-y-4 mt-4">
            <input
              type="text"
              value={customWordInput}
              onChange={(e) => setCustomWordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customWordInput.trim()) {
                  e.preventDefault();
                  handleChooseWord(customWordInput.trim());
                  setCustomWordInput('');
                }
              }}
              placeholder="พิมพ์คำ..."
              className="w-full py-4 px-6 bg-slate-900 border border-slate-700 rounded-2xl text-center text-[20px] font-black text-emerald-400 tracking-widest focus:border-emerald-500 focus:outline-none focus:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all placeholder:text-slate-600"
              enterKeyHint="go"
              autoFocus
            />
            <GiantButton
              color="emerald"
              onClick={() => {
                if (customWordInput.trim()) {
                  handleChooseWord(customWordInput.trim());
                  setCustomWordInput('');
                }
              }}
              disabled={!customWordInput.trim()}
              className="w-full"
            >
              🎨 เริ่มวาด!
            </GiantButton>
          </div>
        </div>
      );
    }

    if (pendingWord) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in bg-slate-950 text-slate-200">
          {renderErrorToast()}
          <div className="text-6xl drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">🎨</div>
          <h2 className="font-black text-[22px] uppercase tracking-widest text-emerald-400 drop-shadow-md">ถึงตาคุณวาด!</h2>
          <NeonCard color="emerald" className="p-6 w-full max-w-xs text-center border-emerald-500/30 bg-emerald-900/10">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">คำที่ต้องวาดคือ</p>
            <p className="text-[32px] font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">{pendingWord}</p>
          </NeonCard>
          <p className="text-slate-400 text-xs font-bold bg-slate-900 px-4 py-2 rounded-full border border-slate-800">⏱ มีเวลา <span className="text-amber-500">{roundTime}</span> วินาที</p>
          <div className="flex gap-3 w-full max-w-xs mt-4">
            <button
              onClick={handleReroll}
              disabled={hasRerolled}
              className={`flex-1 py-4 text-[12px] font-black uppercase tracking-widest rounded-xl border border-slate-700 bg-slate-900 text-slate-300 active:scale-95 transition-all ${hasRerolled ? 'opacity-40 grayscale' : 'hover:border-slate-500'}`}
            >
              🔄 สุ่มใหม่ {hasRerolled ? '(ใช้แล้ว)' : '(1 ครั้ง)'}
            </button>
            <GiantButton
              color="emerald"
              onClick={() => handleChooseWord(pendingWord)}
              className="flex-1"
            >
              🎨 เริ่มวาด!
            </GiantButton>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8 bg-slate-950 text-slate-200">
        {renderErrorToast()}
        <div className="w-8 h-8 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
        <p className="font-black text-[12px] uppercase tracking-widest text-emerald-500 animate-pulse">กำลังสุ่มคำ...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 bg-slate-950 text-slate-200">
      {renderErrorToast()}
      <span className="text-6xl animate-bounce-soft drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">🎨</span>
      <p className="font-black text-[16px] text-emerald-400 drop-shadow-md">
        <span className="text-white">{currentDrawer}</span> กำลังเตรียมตัว...
      </p>
      <div className="flex gap-2 mt-2">
        <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
        <span className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" style={{animationDelay:'0.3s'}}></span>
        <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" style={{animationDelay:'0.6s'}}></span>
      </div>
    </div>
  );
};

export default DrawingGuessingPhase;

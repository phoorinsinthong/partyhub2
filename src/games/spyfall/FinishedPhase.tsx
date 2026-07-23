import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import NeonCard from '../../components/NeonCard';
import GiantButton from '../../components/GiantButton';

export interface FinishedPhaseProps {
  renderErrorToast: () => React.ReactNode;
  gameData: any;
  gamePlayerList: string[];
  isHostActually: boolean;
  handlePlayAgain: () => void;
  resetToLobby: () => void;
  requestLeave: () => void;
}

export const FinishedPhase: React.FC<FinishedPhaseProps> = ({
  renderErrorToast,
  gameData,
  gamePlayerList,
  isHostActually,
  handlePlayAgain,
  resetToLobby,
  requestLeave
}) => {
  const gamePlayers = gameData.players || {};
  const spyWon = gameData.winner === 'Spy';
  const accentColor = spyWon ? 'pink' : 'blue';

  return (
    <div className="flex flex-col gap-4 w-full animate-fade-in relative z-10 p-4">
      {renderErrorToast()}
      
      <NeonCard color={accentColor} className="text-center py-8">
        <div className="flex-center mb-6">
          <div className={`w-24 h-24 rounded-full flex-center shadow-lg border-2 ${
            spyWon ? 'bg-red-500/20 border-red-500 text-red-500 shadow-red-500/50' : 'bg-neon-blue/20 border-neon-blue text-neon-blue shadow-neon-blue/50'
          }`}>
            {spyWon ? <XCircle size={48} /> : <CheckCircle2 size={48} />}
          </div>
        </div>
        
        <h2 className={`font-display font-black text-4xl uppercase tracking-widest mb-6 ${
          spyWon ? 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'text-neon-blue drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]'
        }`}>
          {spyWon ? 'SPY WINS!' : 'CITIZENS WIN!'}
        </h2>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">สถานที่จริง</p>
          <p className="text-2xl font-bold text-white mb-2">{gameData.targetPlace}</p>
          {gameData.guess && (
            <p className="text-sm">
              สายลับทายว่า: <span className={`font-bold ${spyWon ? 'text-neon-green' : 'text-red-500'}`}>"{gameData.guess}"</span>
            </p>
          )}
        </div>

        <div className="text-left space-y-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">สรุปบทบาท</p>
          {gamePlayerList.map((name: string) => {
            const pData = gamePlayers[name];
            const isP_Spy = pData?.isSpy;
            const isP_Acc = pData?.isAccomplice;
            return (
              <div key={name} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                <span className={`font-bold ${isP_Spy ? 'text-red-400' : isP_Acc ? 'text-purple-400' : 'text-white'}`}>{name}</span>
                <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${
                  isP_Spy ? 'bg-red-500/20 text-red-400' : isP_Acc ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {isP_Spy ? 'สายลับ' : isP_Acc ? 'ผู้สมรู้ร่วมคิด' : pData?.role || 'ชาวบ้าน'}
                </span>
              </div>
            );
          })}
        </div>
      </NeonCard>

      {isHostActually ? (
        <div className="flex flex-col gap-3 mt-4">
          <GiantButton color="blue" onClick={handlePlayAgain}>
            เล่นอีกครั้ง
          </GiantButton>
          <button className="py-4 font-bold text-slate-400 hover:text-white uppercase tracking-widest text-[12px]" onClick={resetToLobby}>
            กลับ Lobby
          </button>
        </div>
      ) : (
        <GiantButton color="slate" onClick={requestLeave} className="mt-4">
          กลับ Lobby (ขอลา)
        </GiantButton>
      )}
    </div>
  );
};

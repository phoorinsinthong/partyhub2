import React from 'react';
import { TimerDisplay } from '../../components/game-ui/TimerDisplay';
import NeonCard from '../../components/ui/NeonCard';
import GiantButton from '../../components/ui/GiantButton';

interface DiscussionPhaseProps {
  t: any;
  renderErrorToast: () => React.ReactNode;
  roundNumber: number;
  nonHostPlayers: string[];
  timeLeft: number;
  showCategory: boolean;
  category: string;
  isModerator: boolean;
  isInsider: boolean;
  secretWord: string;
  wordGuessed: boolean;
  confirmGuesser: string | null;
  setConfirmGuesser: React.Dispatch<React.SetStateAction<string | null>>;
  handleConfirmGuesser: () => void;
}

const DiscussionPhase: React.FC<DiscussionPhaseProps> = ({
  t,
  renderErrorToast,
  roundNumber,
  nonHostPlayers,
  timeLeft,
  showCategory,
  category,
  isModerator,
  isInsider,
  secretWord,
  wordGuessed,
  confirmGuesser,
  setConfirmGuesser,
  handleConfirmGuesser
}) => {
  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0 animate-fade-in bg-slate-950 text-slate-200 px-4 py-4">
      {renderErrorToast()}
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex justify-between items-center shadow-sm">
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
          {t('taboo.round')} {roundNumber}/{nonHostPlayers.length}
        </span>
        <TimerDisplay timeLeft={timeLeft} />
      </div>

      {/* Category + Word hints */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex items-center justify-between">
        {showCategory && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('insider.categoryTitle')}:</span>
            <span className="text-[14px] font-black text-slate-300">{category}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {(isModerator || isInsider) && (
            <span className={`text-[10px] font-black uppercase tracking-widest border px-3 py-1.5 rounded-xl ${
              isModerator ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-purple-400 bg-purple-500/10 border-purple-500/30'
            }`}>
              {t('insider.secretWord')}: <span className="text-[14px]">{secretWord}</span>
            </span>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-slate-900/50 border border-slate-800 p-4 text-center rounded-3xl">
        {isModerator ? (
          <div>
            <p className="text-[12px] font-black text-amber-400 uppercase tracking-widest mb-2">{t('insider.roleMasterDesc')}</p>
            <p className="text-[11px] font-bold text-slate-500">{t('taboo.selectWhoCorrect')}</p>
          </div>
        ) : (
          <div>
            <p className="text-[12px] font-black text-emerald-400 uppercase tracking-widest mb-2">{t('insider.roleCommonDesc')}</p>
            <p className="text-[11px] font-bold text-slate-500">{t('taboo.shoutAnswer')}</p>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Host: mark who guessed correctly */}
      {isModerator && !wordGuessed && (
        <NeonCard color="emerald" className="p-4 border-emerald-500/30 bg-emerald-950/20">
          {!confirmGuesser ? (
            <>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 text-center">{t('taboo.whoCorrect')}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {nonHostPlayers.map(p => (
                  <button
                    key={p}
                    onClick={() => setConfirmGuesser(p)}
                    className="text-[12px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 active:scale-95 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all"
                  >
                    ✓ {p}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="text-[12px] font-black text-slate-300 mb-4">{t('taboo.someoneCorrect')} <span className="text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">{confirmGuesser}</span> {t('taboo.correct')}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setConfirmGuesser(null)}
                  className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-400 rounded-2xl active:scale-95 transition-all hover:border-slate-500"
                >
                  {t('taboo.cancel')}
                </button>
                <GiantButton
                  color="emerald"
                  className="flex-1"
                  onClick={handleConfirmGuesser}
                >
                  {t('target.confirmTarget')}
                </GiantButton>
              </div>
            </div>
          )}
        </NeonCard>
      )}

      {/* Non-host: waiting indicator */}
      {!isModerator && !wordGuessed && (
        <div className="bg-slate-900/50 border border-slate-800 p-6 text-center rounded-3xl flex flex-col items-center gap-3">
          <div className="text-4xl animate-bounce">🗣️</div>
          <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400 animate-pulse">{t('taboo.listenAndAnswer')}</p>
        </div>
      )}
    </div>
  );
};

export default DiscussionPhase;

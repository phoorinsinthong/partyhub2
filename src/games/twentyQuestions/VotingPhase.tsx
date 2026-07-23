import React from 'react';
import { TimerDisplay } from '../../components/game-ui/TimerDisplay';
import NeonCard from '../../components/ui/NeonCard';
import GiantButton from '../../components/ui/GiantButton';

interface VotingPhaseProps {
  t: any;
  renderErrorToast: () => React.ReactNode;
  nonHostPlayers: string[];
  timeLeft: number;
  votes: Record<string, string>;
  guesser: string;
  secretWord: string;
  isModerator: boolean;
  userNickname: string;
  votedFor: string;
  handleVote: (target: string) => void;
  handleVoteEnd: () => void;
}

const VotingPhase: React.FC<VotingPhaseProps> = ({
  t,
  renderErrorToast,
  nonHostPlayers,
  timeLeft,
  votes,
  guesser,
  secretWord,
  isModerator,
  userNickname,
  votedFor,
  handleVote,
  handleVoteEnd
}) => {
  const voteCount = Object.keys(votes).length;
  const totalVoters = nonHostPlayers.length;

  return (
    <div className="flex-1 flex flex-col gap-4 py-4 animate-fade-in bg-slate-950 text-slate-200 px-4">
      {renderErrorToast()}
      <div className="text-center">
        <span className="text-5xl drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]">🗳️</span>
        <h3 className="font-black text-[24px] uppercase tracking-widest text-white mt-4 drop-shadow-md">{t('insider.votingPhase')}</h3>
        <p className="text-[12px] font-bold text-slate-400 mt-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl inline-block">{t('insider.voteInsider')}</p>
      </div>

      <div className="flex-center gap-4 mt-2">
        <TimerDisplay timeLeft={timeLeft} />
        <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 bg-rose-500/10 border border-rose-500/30 px-4 py-2 rounded-xl">
          🗳️ {voteCount}/{totalVoters}
        </span>
      </div>

      <NeonCard color="emerald" className="p-4 text-center border-emerald-500/30 bg-emerald-950/20">
        <p className="text-[12px] font-medium text-slate-300">{t('insider.wordGuessedDesc', { name: guesser })} "<span className="font-black text-emerald-400">{secretWord}</span>" {t('taboo.correct')}</p>
      </NeonCard>

      {/* Vote buttons */}
      {!isModerator && (
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">{t('spyfall.votePanelDesc')}:</p>
          <div className="space-y-2">
            {nonHostPlayers.filter(p => p !== userNickname).map(p => (
              <button
                key={p}
                onClick={() => handleVote(p)}
                disabled={!!votedFor}
                className={`w-full p-4 rounded-2xl text-left font-black text-[14px] uppercase tracking-widest border transition-all ${
                  votedFor === p
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.3)]'
                    : votedFor
                      ? 'bg-slate-900 border-slate-800 text-slate-600'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white active:scale-95'
                }`}
              >
                <div className="flex items-center gap-3">
                  {votedFor === p ? <span className="text-xl">🗳️</span> : <span className="w-5" />}
                  {p}
                </div>
              </button>
            ))}
          </div>
          {votedFor && <p className="text-[10px] text-rose-400 font-black uppercase tracking-widest mt-4 text-center animate-pulse">{t('insider.voted')}</p>}
        </div>
      )}

      {isModerator && (
        <NeonCard color="slate" className="p-6 text-center border-slate-800 bg-slate-900">
          <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('insider.voted')} <span className="text-white">{voteCount}/{totalVoters}</span></p>
          <GiantButton
            color="rose"
            onClick={handleVoteEnd}
            disabled={voteCount === 0}
            className="w-full"
          >
            {t('quiz.viewResults')}
          </GiantButton>
        </NeonCard>
      )}
    </div>
  );
};

export default VotingPhase;

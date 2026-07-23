import React from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import NeonCard from '../../components/ui/NeonCard';
import GiantButton from '../../components/ui/GiantButton';
import { ALL_CATEGORIES } from './insiderData';

export const DISCUSSION_TIME_OPTIONS = (t: any) => [
  { label: t('insider.discussionTime') + ' 5 ' + (t('insider.discussionTime').includes('Time') ? 'min' : 'นาที'), seconds: 300 },
  { label: t('insider.discussionTime') + ' 8 ' + (t('insider.discussionTime').includes('Time') ? 'min' : 'นาที'), seconds: 480 },
  { label: t('insider.discussionTime') + ' 10 ' + (t('insider.discussionTime').includes('Time') ? 'min' : 'นาที'), seconds: 600 },
];

interface WaitingPhaseProps {
  t: any;
  renderErrorToast: () => React.ReactNode;
  players: string[];
  roomData: any;
  userNickname: string;
  isHost: boolean;
  selectedCategories: string[];
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>;
  showCategorySetting: boolean;
  setShowCategorySetting: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTime: number;
  setSelectedTime: React.Dispatch<React.SetStateAction<number>>;
  handleStartGame: () => void;
  nonHostPlayers: string[];
}

const WaitingPhase: React.FC<WaitingPhaseProps> = ({
  t,
  renderErrorToast,
  players,
  roomData,
  userNickname,
  isHost,
  selectedCategories,
  setSelectedCategories,
  showCategorySetting,
  setShowCategorySetting,
  selectedTime,
  setSelectedTime,
  handleStartGame,
  nonHostPlayers
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in bg-slate-950 text-slate-200 px-4">
      {renderErrorToast()}
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} className="text-7xl select-none drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]">
        🕵️
      </motion.div>

      <div className="text-center">
        <h2 className="font-black text-[28px] uppercase tracking-widest text-white mb-2 drop-shadow-md">{t('insider.title')}</h2>
        <p className="text-slate-400 text-[12px] font-bold leading-relaxed px-4 max-w-sm">
          {t('insider.description')}
        </p>
      </div>

      <NeonCard color="purple" className="p-4 w-full max-w-xs text-left bg-purple-950/20 border-purple-500/30">
        <div className="space-y-3 font-medium text-[11px] leading-relaxed text-slate-300">
          <div className="flex items-center gap-3">
            <span className="text-[16px] drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">👑</span><span><strong className="text-amber-400">{t('insider.roleMaster')}</strong> {t('insider.roleMasterDesc')}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[16px] drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">🕵️</span><span><strong className="text-purple-400">{t('insider.roleInsider')}</strong> {t('insider.roleInsiderDesc')}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[16px] drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">❓</span><span><strong className="text-emerald-400">{t('insider.roleCommon')}</strong> {t('insider.roleCommonDesc')}</span>
          </div>
        </div>
      </NeonCard>

      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl w-full max-w-xs">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">{t('taboo.players')} {players.length} {t('spyfall.startGame').split(' ')[1]}</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {players.map(p => (
            <span key={p} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${p === roomData.host ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
              {p === roomData.host ? `👑 ${p}` : p === userNickname ? `${p} (${t('taboo.you')})` : p}
            </span>
          ))}
        </div>
      </div>

      {isHost ? (
        <>
          <div className="w-full max-w-xs">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">{t('insider.categoryTitle')}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => setSelectedCategories([])}
                className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${
                  selectedCategories.length === 0
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                }`}
              >
                {t('taboo.cardPackAll')}
              </button>
              {ALL_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategories(prev =>
                    prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                  )}
                  className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${
                    selectedCategories.includes(cat)
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full max-w-xs bg-slate-900/50 p-4 rounded-3xl border border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">แสดงหมวดหมู่ระหว่างเล่น</p>
              <button
                onClick={() => setShowCategorySetting(!showCategorySetting)}
                className={`w-12 h-6 rounded-full transition-colors relative ${showCategorySetting ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${showCategorySetting ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
          <div className="w-full max-w-xs">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">{t('taboo.roundTime')}</p>
            <div className="flex gap-2">
              {DISCUSSION_TIME_OPTIONS(t).map(opt => (
                <button
                  key={opt.seconds}
                  onClick={() => setSelectedTime(opt.seconds)}
                  className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-colors ${
                    selectedTime === opt.seconds
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <GiantButton color="purple" onClick={handleStartGame} className="w-full max-w-xs" disabled={nonHostPlayers.length < 2}>
            <Play size={20} fill="currentColor" className="mr-2 inline-block mb-1" /> {t('insider.startGame')}
          </GiantButton>
          {nonHostPlayers.length < 2 && (
            <p className="text-center text-[11px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl mt-2 w-full max-w-xs">
              {t('taboo.minPlayers')} (ไม่นับ Host)
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 mt-8">
          <div className="w-8 h-8 border-4 border-slate-800 border-t-purple-500 rounded-full animate-spin shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 animate-pulse">{t('insider.waitingHost')}</span>
        </div>
      )}
    </div>
  );
};

export default WaitingPhase;

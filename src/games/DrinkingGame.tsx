import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { RotateCcw, ChevronRight, LogOut, Settings, X, Layers } from 'lucide-react';
import { recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGame } from '../contexts/GameContext';
import { useHaptics } from '../hooks/useHaptics';
import NeonCard from '../components/NeonCard';
import GiantButton from '../components/GiantButton';
import EpicPopup from '../components/EpicPopup';
import LeaveConfirmModal from '../components/LeaveConfirmModal';

const DEFAULT_RULES: Record<string, string> = {
  'A':'ดื่มคนเดียว','2':'เลือกเพื่อนดื่ม 1 คน','3':'เลือกเพื่อนดื่ม 2 คน','4':'คนทางซ้ายดื่ม',
  '5':'ดื่มทุกคน!','6':'Thumb Master — คนช้าสุดดื่ม','7':'Heaven — ชูมือ คนช้าดื่ม',
  '8':'Mate — เลือกคู่ดื่มจนจบ','9':'Rhyme — คล้องจอง','10':'Categories — เลือกหมวด',
  'J':'Rule Maker — ตั้งกฎ','Q':'Question Master','K':"King's Cup — ดื่มทั้งแก้ว!",
};

const DrinkingGame: React.FC = () => {
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { vibrateLight, vibrateMedium, vibrateSuccess, vibrateHeavy } = useHaptics();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [editingRules, setEditingRules] = useState<Record<string, string>>({});
  const [rulePopup, setRulePopup] = useState<{show: boolean, card: any}>({show: false, card: null});

  const gameRecordedRef = useRef(false);
  const drawingCardRef = useRef(false);

  // Derived variables
  const gameData = roomData?.gameData || {};
  const deck = gameData.deck || [];
  const drawnCards = gameData.drawnCards || [];
  const currentCard = gameData.currentCard || null;
  const playerNames = roomData?.players ? Object.keys(roomData.players).sort() : [];
  const turnIndex = gameData.turnIndex ?? 0;
  const currentTurnPlayer = playerNames[turnIndex % playerNames.length] || '';
  const isMyTurn = currentTurnPlayer === userNickname;
  const customRules = gameData.customRules || {};
  const rules = { ...DEFAULT_RULES, ...customRules };

  useEffect(() => {
    if (!gameRecordedRef.current) {
      gameRecordedRef.current = true;
      recordPersonalGame('drinking');
    }
  }, []);

  useEffect(() => {
    if (isHost && roomId && deck.length === 0 && drawnCards.length === 0) {
      const suits = ['hearts','diamonds','clubs','spades'];
      const vals = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
      const d: any[] = []; suits.forEach(s => vals.forEach(v => d.push({s,v,id:`${v}-${s}-${Math.random()}`})));
      for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]]; }
      update(ref(db,`rooms/${roomId}/gameData`),{deck:d,drawnCards:[],currentCard:null,turnIndex:0,lastAction:{type:'init',by:userNickname,time:Date.now()}});
    }
  }, [isHost, roomId, deck.length, drawnCards.length, userNickname]);

  // Trigger popup when a new card is drawn by someone else
  useEffect(() => {
    if (currentCard && gameData.lastAction?.by !== userNickname && gameData.lastAction?.time > Date.now() - 3000) {
      setRulePopup({ show: true, card: currentCard });
      vibrateMedium();
    }
  }, [currentCard, gameData.lastAction, userNickname, vibrateMedium]);

  if (!roomData) return null;

  const safeUpdate = async (refPath: string, data: any) => {
    try {
      await update(ref(db, refPath), data);
    } catch {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      vibrateHeavy();
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    vibrateMedium();
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  const getRule = (v: string) => rules[v] || '';

  const openRuleEditor = () => {
    vibrateLight();
    setEditingRules({ ...rules });
    setShowRuleEditor(true);
  };

  const saveCustomRules = async () => {
    vibrateSuccess();
    const changed: Record<string, string> = {};
    Object.keys(editingRules).forEach((k) => {
      if (editingRules[k] !== DEFAULT_RULES[k]) changed[k] = editingRules[k];
    });
    await safeUpdate(`rooms/${roomId}/gameData`, { customRules: Object.keys(changed).length > 0 ? changed : null });
    setShowRuleEditor(false);
  };

  const drawCard = async () => {
    if (isDrawing || deck.length === 0 || !isMyTurn) return;
    if (drawingCardRef.current) return;
    drawingCardRef.current = true;
    setIsDrawing(true);
    vibrateLight();
    
    const newDeck = [...deck]; const card = newDeck.pop();
    const nextTurnIndex = (turnIndex + 1) % playerNames.length;
    
    await safeUpdate(`rooms/${roomId}/gameData`, {
      deck: newDeck,
      currentCard: card,
      drawnCards: [card, ...drawnCards],
      turnIndex: nextTurnIndex,
      lastAction: { type: 'draw', by: userNickname, card, time: Date.now() }
    });
    
    vibrateSuccess();
    setTimeout(() => {
      setIsDrawing(false);
      drawingCardRef.current = false;
      setRulePopup({ show: true, card });
    }, 600);
  };

  const renderCard = (card: any, index = 0, isLarge = false) => {
    if (!card) return null;
    const isRed = (card.s === 'hearts' || card.s === 'diamonds');
    const color = isRed ? 'text-neon-pink drop-shadow-[0_0_10px_rgba(255,20,147,0.8)]' : 'text-neon-blue drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]';
    const borderColor = isRed ? 'border-neon-pink shadow-neon-pink' : 'border-neon-blue shadow-neon-blue';
    const Icon = { hearts: '♥️', diamonds: '♦️', clubs: '♣️', spades: '♠️' }[card.s as keyof typeof Icon] || '';
    
    return (
      <motion.div
        key={card.id || index}
        initial={isLarge ? { scale: 0.5, rotateY: 180, opacity: 0 } : { y: 20, opacity: 0 }}
        animate={{ scale: 1, rotateY: 0, opacity: 1, y: 0 }}
        className={`${isLarge ? 'w-56 h-80' : 'w-24 h-36 shrink-0'} bg-slate-900 rounded-3xl ${borderColor} border-2 flex flex-col items-center justify-between p-4 relative overflow-hidden`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
        
        <div className={`absolute top-2 left-2 flex flex-col items-center leading-none ${color}`}>
          <span className={`${isLarge ? 'text-3xl' : 'text-lg'} font-display font-black`}>{card.v}</span>
          <span className={isLarge ? 'text-xl' : 'text-sm'}>{Icon}</span>
        </div>
        
        <div className={`${isLarge ? 'text-9xl' : 'text-5xl'} ${color} relative z-10`}>{Icon}</div>
        
        <div className={`absolute bottom-2 right-2 flex flex-col items-center rotate-180 leading-none ${color}`}>
          <span className={`${isLarge ? 'text-3xl' : 'text-lg'} font-display font-black`}>{card.v}</span>
          <span className={isLarge ? 'text-xl' : 'text-sm'}>{Icon}</span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex-1 flex flex-col py-2 animate-fade-in relative z-10">
      {errorMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border border-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)]">
          {errorMsg}
        </div>
      )}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}

      <EpicPopup
        isOpen={rulePopup.show}
        title={`ไพ่ ${rulePopup.card?.v}`}
        subtitle={getRule(rulePopup.card?.v || '')}
        type={rulePopup.card?.s === 'hearts' || rulePopup.card?.s === 'diamonds' ? 'warning' : 'info'}
        onClose={() => setRulePopup({show: false, card: null})}
      >
        <div className="flex justify-center mt-4 mb-6">
          {renderCard(rulePopup.card, 0, true)}
        </div>
        <GiantButton color="slate" onClick={() => setRulePopup({show: false, card: null})}>
          ลุยต่อ!
        </GiantButton>
      </EpicPopup>

      <AnimatePresence>
        {showRuleEditor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex-center p-6 bg-slate-950/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="glass-panel w-full max-w-md p-6 max-h-[80vh] flex flex-col border-neon-blue shadow-neon-blue">
              <div className="flex-between mb-4 border-b border-slate-700 pb-2">
                <h3 className="font-display font-black text-lg text-white uppercase tracking-widest">แก้ไขกฎกติกา</h3>
                <button onClick={() => setShowRuleEditor(false)} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-slate-700"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {Object.keys(DEFAULT_RULES).map(k => (
                  <div key={k} className="space-y-1">
                    <label className="text-[12px] font-black text-neon-blue ml-1 uppercase">ไพ่ {k}</label>
                    <input 
                      className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-neon-blue focus:shadow-neon-blue outline-none transition-all" 
                      value={editingRules[k]} 
                      onChange={e => setEditingRules({...editingRules, [k]: e.target.value})}
                    />
                  </div>
                ))}
              </div>
              <GiantButton color="blue" className="mt-6" onClick={saveCustomRules}>
                บันทึกการเปลี่ยนแปลง
              </GiantButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-between px-2 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-800 flex-center text-xl shadow-neon-blue border border-neon-blue">🍺</div>
          <div>
            <h2 className="font-display font-black text-white text-lg leading-none uppercase tracking-widest">Drinking Game</h2>
            <p className="text-[10px] font-bold text-neon-pink mt-1 uppercase tracking-widest">ไพ่เหลือ {deck.length} ใบ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <button onClick={openRuleEditor} className="w-10 h-10 rounded-xl bg-slate-800 flex-center text-slate-400 hover:text-white active:scale-95 transition-transform border border-slate-700">
              <Settings size={18} />
            </button>
          )}
          <button onClick={requestLeave} className="w-10 h-10 rounded-xl bg-slate-800 flex-center text-slate-400 hover:text-white active:scale-95 transition-transform border border-slate-700">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-4 px-4">
        
        <NeonCard color={isMyTurn ? "amber" : "slate"} glow={isMyTurn} className="w-full max-w-sm text-center py-6">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Current Turn</p>
          <div className="flex-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex-center text-2xl border-2 border-slate-600 shadow-inner">
              {roomData.players[currentTurnPlayer]?.avatar || '👤'}
            </div>
            <span className={`font-display text-2xl font-black ${isMyTurn ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'text-white'}`}>
              {isMyTurn ? 'ตาของคุณ' : currentTurnPlayer}
            </span>
            {isMyTurn && <motion.div animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity }}><ChevronRight className="text-amber-400" size={24} /></motion.div>}
          </div>
        </NeonCard>

        <div className="relative w-full max-w-sm flex-center perspective-1000 my-8">
          <AnimatePresence mode="wait">
            {isDrawing ? (
              <motion.div key="drawing" initial={{ y: 50, rotateY: 90, opacity: 0 }} animate={{ y: 0, rotateY: 0, opacity: 1 }} exit={{ scale: 1.1, opacity: 0 }} className="w-56 h-80 bg-slate-800 rounded-3xl border-4 border-neon-blue shadow-neon-blue flex-center">
                <div className="w-12 h-12 border-4 border-neon-blue border-t-transparent rounded-full animate-spin" />
              </motion.div>
            ) : deck.length > 0 ? (
              <div 
                onClick={isMyTurn ? drawCard : undefined} 
                className={`w-56 h-80 rounded-3xl border-4 flex-center flex-col gap-4 transition-all duration-300 ${
                  isMyTurn 
                    ? 'border-neon-pink bg-slate-900 shadow-[0_0_30px_rgba(255,20,147,0.5)] cursor-pointer hover:scale-105 active:scale-95' 
                    : 'border-slate-700 bg-slate-900/50 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 rounded-3xl pointer-events-none"></div>
                <Layers size={64} className={isMyTurn ? 'text-neon-pink animate-pulse' : 'text-slate-600'} strokeWidth={1} />
                <span className={`font-display font-black text-xl tracking-widest uppercase ${isMyTurn ? 'text-white' : 'text-slate-500'}`}>
                  {isMyTurn ? 'TAP TO DRAW' : 'WAITING'}
                </span>
              </div>
            ) : (
              <div className="w-56 h-80 rounded-3xl border-4 border-slate-700 bg-slate-900/50 flex-center flex-col gap-4">
                <span className="text-6xl text-slate-600">🏁</span>
                <span className="font-display font-black text-xl text-slate-500 tracking-widest uppercase">ไพ่หมดแล้ว</span>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>

      <div className="mt-auto pt-2 pb-4">
        <div className="flex gap-4 overflow-x-auto px-4 pb-4 snap-x no-scrollbar">
          {drawnCards.slice(0, 8).map((c, i) => (
            <div key={c.id || i} className="snap-start opacity-70 hover:opacity-100 transition-opacity">
              {renderCard(c, i, false)}
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <div className="mt-auto py-2 px-4 flex-center">
          <button onClick={handleBackToLobby} className="flex items-center gap-2 text-[12px] font-bold text-slate-400 hover:text-white transition-colors border border-slate-700 rounded-xl px-4 py-2 bg-slate-800">
            <RotateCcw size={14} /> ปิดวง (กลับ Lobby)
          </button>
        </div>
      )}
    </div>
  );
};

export default DrinkingGame;

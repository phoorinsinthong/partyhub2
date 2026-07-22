import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { RotateCcw, ChevronRight, LogOut, Settings, X } from 'lucide-react';
import { recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGame } from '../contexts/GameContext';
import { useTranslation } from 'react-i18next';
import LeaveConfirmModal from '../components/LeaveConfirmModal';

const DEFAULT_RULES: Record<string, string> = {
  'A':'ดื่มคนเดียว','2':'เลือกเพื่อนดื่ม 1 คน','3':'เลือกเพื่อนดื่ม 2 คน','4':'คนทางซ้ายดื่ม',
  '5':'ดื่มทุกคน!','6':'Thumb Master — คนช้าสุดดื่ม','7':'Heaven — ชูมือ คนช้าดื่ม',
  '8':'Mate — เลือกคู่ดื่มจนจบ','9':'Rhyme — คล้องจอง','10':'Categories — เลือกหมวด',
  'J':'Rule Maker — ตั้งกฎ','Q':'Question Master','K':"King's Cup — ดื่มทั้งแก้ว!",
};

const DrinkingGame: React.FC = () => {
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { t } = useTranslation();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [editingRules, setEditingRules] = useState<Record<string, string>>({});

  const gameRecordedRef = useRef(false);
  const drawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawingCardRef = useRef(false);

  // Derived variables
  const gameData = roomData?.gameData || {};
  const deck = gameData.deck || [];
  const drawnCards = gameData.drawnCards || [];
  const currentCard = gameData.currentCard || null;
  const lastAction = gameData.lastAction || null;
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
    return () => { if (drawTimerRef.current) clearTimeout(drawTimerRef.current); };
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

  if (!roomData) return null;

  const renderErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
      {errorMsg}
    </div>
  ) : null;

  const safeUpdate = async (refPath: string, data: any) => {
    try {
      await update(ref(db, refPath), data);
    } catch {
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  const getRule = (v: string) => rules[v] || '';

  const openRuleEditor = () => {
    setEditingRules({ ...rules });
    setShowRuleEditor(true);
  };

  const saveCustomRules = async () => {
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
    const newDeck = [...deck]; const card = newDeck.pop();
    const nextTurnIndex = (turnIndex + 1) % playerNames.length;
    
    await safeUpdate(`rooms/${roomId}/gameData`, {
      deck: newDeck,
      currentCard: card,
      drawnCards: [card, ...drawnCards],
      turnIndex: nextTurnIndex,
      lastAction: { type: 'draw', by: userNickname, card, time: Date.now() }
    });
    
    drawTimerRef.current = setTimeout(() => {
      setIsDrawing(false);
      drawingCardRef.current = false;
    }, 1000);
  };

  const renderCard = (card: any, index = 0, isLarge = false) => {
    if (!card) return null;
    const color = (card.s === 'hearts' || card.s === 'diamonds') ? 'text-red-500' : 'text-slate-800';
    const Icon = { hearts: '♥️', diamonds: '♦️', clubs: '♣️', spades: '♠️' }[card.s as keyof typeof Icon] || '';
    
    return (
      <motion.div
        key={card.id || index}
        initial={isLarge ? { scale: 0.5, rotateY: 180, opacity: 0 } : { y: 20, opacity: 0 }}
        animate={{ scale: 1, rotateY: 0, opacity: 1, y: 0 }}
        className={`${isLarge ? 'w-48 h-72' : 'w-24 h-36'} bg-white rounded-2xl shadow-xl border-2 border-slate-100 flex flex-col items-center justify-between p-4 relative overflow-hidden`}
      >
        <div className={`absolute top-2 left-2 flex flex-col items-center leading-none ${color}`}>
          <span className={`${isLarge ? 'text-2xl' : 'text-lg'} font-black`}>{card.v}</span>
          <span className={isLarge ? 'text-xl' : 'text-sm'}>{Icon}</span>
        </div>
        <div className={`${isLarge ? 'text-8xl' : 'text-5xl'} ${color}`}>{Icon}</div>
        <div className={`absolute bottom-2 right-2 flex flex-col items-center rotate-180 leading-none ${color}`}>
          <span className={`${isLarge ? 'text-2xl' : 'text-lg'} font-black`}>{card.v}</span>
          <span className={isLarge ? 'text-xl' : 'text-sm'}>{Icon}</span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex-1 flex flex-col py-2 animate-fade-in">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}

      <AnimatePresence>
        {showRuleEditor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="card w-full max-w-md p-6 max-h-[80vh] flex flex-col">
              <div className="flex-between mb-4">
                <h3 className="font-black text-lg text-slate-800">{t('drinking.editRules') || 'แก้ไขกฎกติกา'}</h3>
                <button onClick={() => setShowRuleEditor(false)} className="p-2 rounded-xl bg-slate-100 text-slate-400"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {Object.keys(DEFAULT_RULES).map(k => (
                  <div key={k} className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 ml-1">{k}</label>
                    <input 
                      className="input-field py-2 text-sm" 
                      value={editingRules[k]} 
                      onChange={e => setEditingRules({...editingRules, [k]: e.target.value})}
                    />
                  </div>
                ))}
              </div>
              <button onClick={saveCustomRules} className="btn btn-primary w-full py-4 mt-4 rounded-2xl font-black shadow-lg">
                {t('common.save') || 'บันทึกการเปลี่ยนแปลง'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-between px-1 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex-center text-xl shadow-sm">🍺</div>
          <div>
            <h2 className="font-black text-slate-800 text-lg leading-none">{t('drinking.title') || 'วงเหล้า'}</h2>
            <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{t('drinking.deckLeft', { count: deck.length }) || `เหลือไพ่ ${deck.length} ใบ`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <button onClick={openRuleEditor} className="w-10 h-10 rounded-2xl bg-slate-100 flex-center text-slate-400 active:scale-95 transition-transform shadow-sm">
              <Settings size={18} />
            </button>
          )}
          <button onClick={requestLeave} className="w-10 h-10 rounded-2xl bg-slate-100 flex-center text-slate-400 active:scale-95 transition-transform shadow-sm">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 py-4">
        <div className="relative w-full flex-center perspective-1000">
          <AnimatePresence mode="wait">
            {isDrawing ? (
              <motion.div key="drawing" initial={{ y: 100, rotateY: 90, opacity: 0 }} animate={{ y: 0, rotateY: 0, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }} className="w-48 h-72 bg-slate-200 rounded-2xl border-4 border-white shadow-2xl flex-center">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </motion.div>
            ) : currentCard ? (
              <div className="flex flex-col items-center gap-6">
                {renderCard(currentCard, 0, true)}
                <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center px-6">
                  <h3 className="text-[32px] font-black text-amber-600 leading-tight mb-2">{currentCard.v}</h3>
                  <p className="text-xl font-black text-slate-800 leading-relaxed">{getRule(currentCard.v)}</p>
                </motion.div>
              </div>
            ) : (
              <div onClick={isMyTurn ? drawCard : undefined} className={`w-48 h-72 rounded-2xl border-4 border-white shadow-2xl flex-center flex-col gap-4 cursor-pointer transition-all ${isMyTurn ? 'bg-amber-500 hover:scale-105 active:scale-95' : 'bg-slate-200 grayscale opacity-50'}`}>
                <div className="w-32 h-48 rounded-xl border-2 border-white/30 flex-center">
                  <span className="text-6xl text-white opacity-50">?</span>
                </div>
                <span className="text-white font-black text-lg">{t('drinking.drawCard') || 'แตะเพื่อจั่ว'}</span>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-full max-w-sm px-4">
          <div className="card p-4 bg-white/50 backdrop-blur-sm border-slate-100">
            <p className="text-center text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('drinking.currentTurn') || 'ตาของใคร?'}</p>
            <div className="flex-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex-center text-xl border-2 border-white shadow-sm">{roomData.players[currentTurnPlayer]?.avatar || '👤'}</div>
              <span className={`text-lg font-black ${isMyTurn ? 'text-amber-600' : 'text-slate-800'}`}>
                {isMyTurn ? t('common.you') || 'คุณเอง' : currentTurnPlayer}
              </span>
              {isMyTurn && <motion.div animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity }}><ChevronRight className="text-amber-500" /></motion.div>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto overflow-x-auto pb-4 pt-2 no-scrollbar">
        <div className="flex gap-3 px-4 min-w-max">
          {drawnCards.slice(0, 10).map((c, i) => (
            <div key={c.id || i} className="opacity-60 scale-75 origin-left">
              {renderCard(c, i)}
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <div className="mt-auto py-2 flex-center">
          <button onClick={handleBackToLobby} className="flex items-center gap-2 text-[12px] font-bold text-slate-300 hover:text-slate-500 transition-colors">
            <RotateCcw size={14} /> {t('common.backToLobby') || 'กลับ Lobby'}
          </button>
        </div>
      )}
    </div>
  );
};

export default DrinkingGame;

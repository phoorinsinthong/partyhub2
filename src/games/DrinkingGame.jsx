import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { RotateCcw, ChevronRight, LogOut, Settings, X } from 'lucide-react';
import { recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import LeaveConfirmModal from '../components/LeaveConfirmModal';

const DEFAULT_RULES = {
  'A':'ดื่มคนเดียว','2':'เลือกเพื่อนดื่ม 1 คน','3':'เลือกเพื่อนดื่ม 2 คน','4':'คนทางซ้ายดื่ม',
  '5':'ดื่มทุกคน!','6':'Thumb Master — คนช้าสุดดื่ม','7':'Heaven — ชูมือ คนช้าดื่ม',
  '8':'Mate — เลือกคู่ดื่มจนจบ','9':'Rhyme — คล้องจอง','10':'Categories — เลือกหมวด',
  'J':'Rule Maker — ตั้งกฎ','Q':'Question Master','K':"King's Cup — ดื่มทั้งแก้ว!",
};

const DrinkingGame = ({ roomId, roomData, userNickname }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const nickname = userNickname;
  const isHost = roomData.host === nickname;
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, nickname);
  const gameRecordedRef = useRef(false);
  const drawTimerRef = useRef(null);
  const drawingCardRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [editingRules, setEditingRules] = useState({});

  const safeUpdate = async (refPath, data) => {
    try {
      await update(ref(db, refPath), data);
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
      throw e;
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  useEffect(() => {
    if (!gameRecordedRef.current) {
      gameRecordedRef.current = true;
      recordPersonalGame('drinking');
    }
    return () => { if (drawTimerRef.current) clearTimeout(drawTimerRef.current); };
  }, []);

  const gameData = roomData.gameData || {};
  const deck = gameData.deck || [];
  const drawnCards = gameData.drawnCards || [];
  const currentCard = gameData.currentCard || null;
  const lastAction = gameData.lastAction || null;

  const playerNames = roomData.players ? Object.keys(roomData.players).sort() : [];
  const turnIndex = gameData.turnIndex ?? 0;
  const currentTurnPlayer = playerNames[turnIndex % playerNames.length] || '';
  const isMyTurn = currentTurnPlayer === nickname;

  const customRules = gameData.customRules || {};
  const rules = { ...DEFAULT_RULES, ...customRules };
  const getRule = (v) => rules[v] || '';

  const openRuleEditor = () => {
    setEditingRules({ ...rules });
    setShowRuleEditor(true);
  };

  const saveCustomRules = async () => {
    const changed = {};
    Object.keys(editingRules).forEach((k) => {
      if (editingRules[k] !== DEFAULT_RULES[k]) changed[k] = editingRules[k];
    });
    await safeUpdate(`rooms/${roomId}/gameData`, { customRules: Object.keys(changed).length > 0 ? changed : null });
    setShowRuleEditor(false);
  };

  useEffect(() => {
    if (isHost && deck.length === 0 && drawnCards.length === 0) {
      const suits = ['hearts','diamonds','clubs','spades'];
      const vals = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
      let d = []; suits.forEach(s => vals.forEach(v => d.push({s,v,id:`${v}-${s}-${Math.random()}`})));
      for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]]; }
      update(ref(db,`rooms/${roomId}/gameData`),{deck:d,drawnCards:[],currentCard:null,turnIndex:0,lastAction:{type:'init',by:nickname,time:Date.now()}});
    }
  }, [isHost, roomId, deck.length, drawnCards.length, nickname]);

  const drawCard = async () => {
    if (isDrawing || deck.length === 0 || !isMyTurn) return;
    if (drawingCardRef.current) return;
    drawingCardRef.current = true;
    setIsDrawing(true);
    const newDeck = [...deck]; const card = newDeck.pop();
    const nextTurnIndex = (turnIndex + 1) % playerNames.length;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`,{
        deck: newDeck,
        drawnCards: [card,...drawnCards],
        currentCard: card,
        turnIndex: nextTurnIndex,
        lastAction: { type:'draw', by: nickname, time: Date.now() }
      });
    } finally {
      drawingCardRef.current = false;
    }
    if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
    drawTimerRef.current = setTimeout(() => setIsDrawing(false), 400);
  };

  const restartRef = useRef(false);
  const handleRestart = async () => {
    if (!isHost || restartRef.current) return;
    restartRef.current = true;
    const suits = ['hearts','diamonds','clubs','spades'];
    const vals = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    let d = []; suits.forEach(s => vals.forEach(v => d.push({s,v,id:`${v}-${s}-${Math.random()}`})));
    for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]]; }
    try {
      await safeUpdate(`rooms/${roomId}/gameData`,{deck:d,drawnCards:[],currentCard:null,turnIndex:0,lastAction:{type:'restart',by:nickname,time:Date.now()}});
    } finally {
      restartRef.current = false;
    }
  };

  const isRed = (s) => s==='hearts'||s==='diamonds';
  const suit = (s) => ({hearts:'♥',diamonds:'♦',clubs:'♣',spades:'♠'}[s]||'');

  const ErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
      {errorMsg}
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-4 pb-6 flex-1">
      <ErrorToast />
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      {/* Rule Editor Modal */}
      <AnimatePresence>
        {showRuleEditor && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-0"
            style={{ background: 'rgba(47,42,34,0.4)' }}
            onClick={() => setShowRuleEditor(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="bg-white rounded-t-3xl w-full max-w-[460px] max-h-[80dvh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex-between p-4 pb-2 border-b border-olive-100">
                <h3 className="font-display font-bold text-[14px] text-olive-700">แก้ไขกฎไพ่</h3>
                <button onClick={() => setShowRuleEditor(false)} className="w-8 h-8 rounded-xl bg-olive-50 flex-center">
                  <X size={16} className="text-olive-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                {Object.keys(DEFAULT_RULES).map((card) => (
                  <div key={card} className="flex items-center gap-2">
                    <span className="w-8 text-center font-black text-[14px] text-olive-700">{card}</span>
                    <input
                      type="text"
                      value={editingRules[card] || ''}
                      onChange={(e) => setEditingRules({ ...editingRules, [card]: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-xl border-2 border-olive-100 text-[12px] font-semibold focus:border-sage-300 outline-none"
                    />
                  </div>
                ))}
              </div>
              <div className="p-4 pt-2 border-t border-olive-100">
                <button onClick={saveCustomRules} className="btn btn-primary w-full py-3 text-[14px]">
                  บันทึกกฎ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="flex-between">
        <div className="inline-flex items-center gap-2 bg-cream-100 border-2 border-cream-200 rounded-full px-3.5 py-2">
          <span className="text-[12px] font-extrabold text-olive-600">🃏 {deck.length}/52</span>
        </div>
        {isHost && (
          <div className="flex items-center gap-2">
            <button className="btn btn-outline py-2 px-3 text-[12px] min-h-[40px]" onClick={openRuleEditor}>
              <Settings size={13} /> กฎ
            </button>
            <button className="btn btn-outline py-2 px-3 text-[12px] min-h-[40px]" onClick={handleRestart}>
              <RotateCcw size={13} /> สับใหม่
            </button>
          </div>
        )}
      </div>

      {/* Turn Indicator */}
      <div className={`rounded-2xl p-3 border-2 text-center ${isMyTurn ? 'bg-sage-50 border-sage-200' : 'bg-cream-50 border-cream-200'}`}>
        <p className="text-[11px] text-olive-400 font-bold uppercase tracking-wider mb-1">
          ตาจั่วไพ่
        </p>
        <p className={`text-[15px] font-extrabold ${isMyTurn ? 'text-sage-700' : 'text-olive-700'}`}>
          {isMyTurn ? '🎉 ตาของคุณ!' : `⏳ รอ ${currentTurnPlayer} จั่ว...`}
        </p>
      </div>

      {/* Turn Order */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{WebkitOverflowScrolling:'touch'}}>
        {playerNames.map((name, idx) => (
          <div key={name} className="flex items-center shrink-0">
            <div className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
              idx === (turnIndex % playerNames.length)
                ? 'bg-sage-500 text-white'
                : idx < (turnIndex % playerNames.length)
                  ? 'bg-olive-100 text-olive-400'
                  : 'bg-cream-100 text-olive-500'
            }`}>
              {name === nickname ? 'คุณ' : name}
            </div>
            {idx < playerNames.length - 1 && <ChevronRight size={12} className="text-olive-200 mx-0.5 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="w-full h-2 bg-olive-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-sage-300 to-sage-500 transition-[width] duration-300" style={{width:`${(drawnCards.length/52)*100}%`}} />
      </div>

      {/* Card */}
      <div className="flex-center flex-1" style={{minHeight:'220px'}}>
        <AnimatePresence mode="wait">
          {currentCard ? (
            <motion.div
              key={currentCard.id}
              initial={{opacity:0, y:20, scale:0.95}}
              animate={{opacity:1, y:0, scale:1}}
              exit={{opacity:0, scale:0.95}}
              transition={{duration:0.2, ease:'easeOut'}}
              className="w-[180px] h-[260px] card flex flex-col items-center justify-between p-4 border-2"
              style={{borderColor: isRed(currentCard.s) ? '#f5c6c6' : '#d8e4d2'}}
            >
              <span className="self-start text-[20px] font-black" style={{color: isRed(currentCard.s)?'#d45b5b':'#2f2a22'}}>
                {currentCard.v}{suit(currentCard.s)}
              </span>
              <span className="text-[60px] leading-none" style={{color: isRed(currentCard.s)?'#d45b5b':'#2f2a22'}}>
                {suit(currentCard.s)}
              </span>
              <div className="w-full bg-cream-50 border-2 border-cream-200 rounded-xl p-2.5">
                <p className="text-[11px] font-bold text-olive-700 text-center leading-snug">{getRule(currentCard.v)}</p>
              </div>
              <span className="self-end text-[20px] font-black rotate-180" style={{color: isRed(currentCard.s)?'#d45b5b':'#2f2a22'}}>
                {currentCard.v}{suit(currentCard.s)}
              </span>
            </motion.div>
          ) : (
            <div className="w-[180px] h-[260px] rounded-[20px] border-3 border-dashed border-olive-200 flex-center flex-col gap-2 bg-cream-50">
              <span className="text-3xl">🎴</span>
              <span className="text-olive-400 text-[13px] font-semibold">กดจั่วไพ่</span>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Who drew last */}
      {lastAction && lastAction.type === 'draw' && (
        <p className="text-center text-[12px] text-olive-500 font-semibold">
          {lastAction.by === nickname ? 'คุณ' : lastAction.by} เพิ่งจั่วไพ่ใบนี้
        </p>
      )}

      {/* Draw Button */}
      {deck.length > 0 ? (
        <button
          className={`btn w-full py-5 text-[18px] ${isMyTurn ? 'btn-primary' : 'btn-outline opacity-60'}`}
          onClick={drawCard}
          disabled={isDrawing || !isMyTurn}
        >
          {isDrawing ? 'จั่ว...' : isMyTurn ? 'จั่วไพ่! 🎴' : `รอ ${currentTurnPlayer}...`}
        </button>
      ) : (
        <div className="card p-5 text-center">
          <p className="font-bold text-sage-600 text-[15px]">🎉 จบเกม!</p>
          <p className="text-olive-400 text-[13px] mt-0.5">ไพ่หมดแล้ว</p>
          {isHost && (
            <button className="btn btn-primary py-3 px-6 text-[14px] mt-3" onClick={handleRestart}>
              🔄 เล่นอีกครั้ง
            </button>
          )}
        </div>
      )}

      {/* Leave/Back button */}
      {isHost ? (
        <button className="btn btn-outline w-full py-3 text-[13px]" onClick={handleBackToLobby}>
          <LogOut size={14} /> กลับ Lobby
        </button>
      ) : (
        <button className="btn btn-outline w-full py-3 text-[13px]" onClick={requestLeave}>
          <LogOut size={14} /> ออกจากห้อง
        </button>
      )}

      {/* History */}
      {drawnCards.length > 0 && (
        <div>
          <p className="text-[10px] text-olive-400 font-bold uppercase tracking-wider mb-1.5">ล่าสุด</p>
          <div className="flex overflow-x-auto gap-1.5 pb-1" style={{WebkitOverflowScrolling:'touch'}}>
            {drawnCards.slice(0,15).map(c => (
              <span key={c.id} className="shrink-0 px-2.5 py-1.5 text-[11px] font-extrabold rounded-lg bg-white border-2"
                style={{color:isRed(c.s)?'#d45b5b':'#2f2a22', borderColor:isRed(c.s)?'#fde8e8':'#e4eadf'}}>
                {c.v}{suit(c.s)}
              </span>
            ))}
            {drawnCards.length > 15 && <span className="shrink-0 px-2 py-1.5 text-[10px] text-olive-300 self-center">+{drawnCards.length-15}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default DrinkingGame;

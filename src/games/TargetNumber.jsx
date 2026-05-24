import React, { useState, useEffect, useRef } from 'react';
import { ref, update, get } from 'firebase/database';
import { db } from '../firebase';
import { Target, User, Trophy, Play, RotateCcw, Crown, Skull, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import LeaveConfirmModal from '../components/LeaveConfirmModal';

const TargetNumber = ({ roomId, roomData, userNickname }) => {
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const isHost = roomData.host === userNickname;
  const gameData = roomData.gameData || {};
  const players = roomData.players || {};
  const playerNames = Object.keys(players);

  const [selectedTarget, setSelectedTarget] = useState('');
  const [lastNumbers, setLastNumbers] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const personalRecordedRef = useRef(false);
  const advancingRef = useRef(false);

  const safeUpdate = async (refPath, data) => {
    try {
      await update(ref(db, refPath), data);
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
      throw e;
    }
  };

  const gameStatus = gameData.gameStatus || 'waiting';
  const targetChooser = gameData.targetChooser || null;
  const isTargetChooser = targetChooser === userNickname;
  const currentPlayerIndex = gameData.currentPlayerIndex ?? null;
  const currentPlayer = gameData.playerOrder?.[currentPlayerIndex] || null;
  const isMyTurn = currentPlayer === userNickname;

  useEffect(() => {
    setLastNumbers([]);
    advancingRef.current = false;
  }, [gameData.roundNumber, gameStatus]);

  useEffect(() => {
    if (gameStatus === 'waiting' || gameStatus === 'playing') personalRecordedRef.current = false;
  }, [gameStatus]);

  useEffect(() => {
    if (gameStatus !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('target');
    const loser = gameData.loser;
    if (loser && loser !== userNickname) recordPersonalWin('target');
  }, [gameStatus]);

  // Skip turn if current player left the room
  useEffect(() => {
    if (!isHost || gameStatus !== 'playing') return;
    const playerOrder = gameData.playerOrder || [];
    const current = playerOrder[currentPlayerIndex];
    if (current && !players[current]) {
      const nextIndex = (currentPlayerIndex + 1) % playerOrder.length;
      safeUpdate(`rooms/${roomId}/gameData`, { currentPlayerIndex: nextIndex });
    }
  }, [isHost, gameStatus, currentPlayerIndex, gameData.playerOrder, players, roomId]);

  const startGameRef = useRef(false);
  const startGame = async () => {
    if (!isHost) return;
    if (playerNames.length < 2) return;
    if (startGameRef.current) return;
    startGameRef.current = true;

    const chooserIndex = Math.floor(Math.random() * playerNames.length);

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        gameStatus: 'choosing_target',
        targetChooser: playerNames[chooserIndex],
        targetNumber: null,
        range: null,
        currentCount: 0,
        currentPlayerIndex: null,
        playerOrder: null,
        loser: null,
        lastMove: null,
        roundNumber: (gameData.roundNumber || 0) + 1
      });
    } finally {
      startGameRef.current = false;
    }
  };

  const handleSetTarget = async () => {
    const num = parseInt(selectedTarget, 10);
    if (isNaN(num) || num < 1 || num > 100) return;
    if (advancingRef.current) return;
    advancingRef.current = true;

    const allPlayers = [...playerNames].sort((a, b) => {
      const aTime = players[a]?.joinedAt || 0;
      const bTime = players[b]?.joinedAt || 0;
      return aTime - bTime;
    });

    const chooserIdx = allPlayers.indexOf(userNickname);
    const firstPlayerIndex = (chooserIdx + 1) % allPlayers.length;

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        gameStatus: 'playing',
        targetNumber: num,
        range: {
          min: Math.max(1, num - 5),
          max: Math.min(100, num + 5)
        },
        currentCount: 0,
        currentPlayerIndex: firstPlayerIndex,
        playerOrder: allPlayers,
        loser: null,
        lastMove: null
      });
    } finally {
      advancingRef.current = false;
    }

    setSelectedTarget('');
  };

  const handleMove = async (increment) => {
    if (!isMyTurn) return;
    if (gameStatus !== 'playing') return;
    if (advancingRef.current) return;
    advancingRef.current = true;

    const currentCount = gameData.currentCount || 0;
    const target = gameData.targetNumber;
    const playerOrder = gameData.playerOrder || [];

    const startNum = currentCount + 1;
    const numbersSaid = Array.from({ length: increment }, (_, i) => startNum + i);
    const newCount = currentCount + increment;

    let loser = null;
    if (numbersSaid.includes(target)) {
      loser = userNickname;
    }

    const nextPlayerIndex = loser
      ? currentPlayerIndex
      : (currentPlayerIndex + 1) % playerOrder.length;

    const updates = {
      currentCount: newCount,
      currentPlayerIndex: nextPlayerIndex,
      lastMove: {
        player: userNickname,
        numbers: numbersSaid,
        increment
      }
    };

    if (loser) {
      updates.loser = loser;
      updates.gameStatus = 'finished';

      const currentScores = gameData.scores || {};
      const newScores = { ...currentScores };
      playerOrder.forEach(name => {
        if (name !== loser) {
          newScores[name] = (newScores[name] || 0) + 1;
        }
      });
      updates.scores = newScores;
    }

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, updates);
      if (loser) {
        const newScores = updates.scores;
        const topWinner = Object.entries(newScores).sort((a, b) => b[1] - a[1])[0];
        if (topWinner) await recordWin(roomId, topWinner[0], 'target');
      }
    } finally {
      advancingRef.current = false;
    }
  };

  const nextRound = () => {
    startGame();
  };

  const ErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-danger text-white px-lg py-sm rounded-2xl font-bold text-sm shadow-xl animate-fade-in">
      {errorMsg}
    </div>
  ) : null;

  // Waiting screen
  if (gameStatus === 'waiting') {
    return (
      <div className="flex flex-col gap-lg w-full animate-fade-in">
        <ErrorToast />
        <div className="glass-panel p-xl text-center">
          <div className="flex-center mb-md">
            <div className="p-lg bg-primary/20 rounded-full text-primary shadow-lg shadow-primary/10">
              <Target size={48} />
            </div>
          </div>
          <h2 className="text-3xl font-black mb-sm">เกมนับเลขเป้า</h2>
          <p className="text-secondary leading-relaxed">
            ผู้เล่นคนหนึ่งจะตั้งตัวเลขลับ (1-100) แล้วทุกคนผลัดกันนับ +1, +2 หรือ +3 ใครนับถึงเลขเป้าคนนั้นแพ้!
          </p>

          <div className="mt-lg p-md bg-glass-dark/30 rounded-xl border border-glass">
            <h4 className="text-xs font-black text-secondary uppercase tracking-widest mb-sm">กติกา</h4>
            <div className="text-left text-sm text-secondary space-y-xs">
              <p>🎯 คนหนึ่งจะถูกสุ่มให้ตั้งตัวเลขลับ 1-100</p>
              <p>💡 ผู้เล่นอื่นจะเห็นช่วงใบ้ (±5 จากเป้า)</p>
              <p>🔢 ผลัดกันนับ +1, +2, หรือ +3</p>
              <p>💀 ใครนับถึงตัวเลขเป้า...แพ้!</p>
            </div>
          </div>
        </div>

        {isHost ? (
          <button className="btn btn-primary w-full py-xl text-xl font-black" onClick={startGame}>
            <Play size={24} fill="currentColor" />
            เริ่มเกม!
          </button>
        ) : (
          <div className="glass-panel p-md text-center border-primary/30">
            <p className="animate-pulse text-primary font-bold">รอโฮสต์เริ่มเกม...</p>
          </div>
        )}
      </div>
    );
  }

  // Choosing target screen
  if (gameStatus === 'choosing_target') {
    return (
      <div className="flex flex-col gap-lg w-full animate-fade-in">
        <ErrorToast />
        <div className="glass-panel p-xl text-center">
          <div className="flex-center mb-md">
            <div className="p-lg bg-warning/20 rounded-full text-warning shadow-lg shadow-warning/10">
              <Target size={40} />
            </div>
          </div>

          {isTargetChooser ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col gap-lg"
            >
              <div>
                <h2 className="text-2xl font-black mb-xs">คุณถูกเลือกให้ตั้งตัวเลขลับ!</h2>
                <p className="text-secondary">เลือกตัวเลขระหว่าง 1 ถึง 100 ผู้เล่นอื่นจะเห็นช่วง ±5 เท่านั้น</p>
              </div>

              <div className="flex flex-col gap-md items-center">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  placeholder="พิมพ์เลข 1-100"
                  className="input-field py-lg text-center text-2xl font-black w-48"
                />
                <button
                  className="btn btn-primary py-lg px-xl font-black text-lg"
                  onClick={handleSetTarget}
                  disabled={!selectedTarget || parseInt(selectedTarget) < 1 || parseInt(selectedTarget) > 100}
                >
                  ยืนยันตัวเลข
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center gap-md">
              <h2 className="text-2xl font-black">กำลังตั้งตัวเลขลับ...</h2>
              <p className="text-secondary">
                รอ <span className="text-primary font-bold">{targetChooser}</span> เลือกตัวเลขลับ
              </p>
              <div className="text-4xl animate-bounce mt-md">🎲</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Playing screen
  if (gameStatus === 'playing') {
    const playerOrder = gameData.playerOrder || [];
    const currentCount = gameData.currentCount || 0;
    const range = gameData.range || {};
    const lastMove = gameData.lastMove;

    return (
      <div className="flex flex-col gap-lg w-full animate-fade-in pb-20">
        <ErrorToast />
        {/* Header */}
        <div className="glass-panel p-md flex justify-between items-center border-primary/20">
          <div className="flex items-center gap-sm">
            <div className="p-sm rounded-lg bg-warning/20 text-warning">
              <Target size={18} />
            </div>
            <div>
              <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">ตัวเลขปัจจุบัน</p>
              <p className="font-black text-2xl text-white">{currentCount}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">คะแนนของคุณ</p>
            <p className="font-black text-primary text-lg">{gameData.scores?.[userNickname] || 0}</p>
          </div>
        </div>

        {/* Hint Range */}
        {!isTargetChooser && (
          <div className="glass-panel p-lg text-center border-warning/30 bg-warning/5">
            <p className="text-xs font-bold text-warning uppercase tracking-widest mb-sm">💡 ช่วงตัวเลขใบ้</p>
            <div className="flex items-center justify-center gap-md">
              <span className="bg-warning/20 text-warning font-black text-2xl px-lg py-sm rounded-xl border border-warning/30">
                {range.min}
              </span>
              <span className="text-secondary font-bold">ถึง</span>
              <span className="bg-warning/20 text-warning font-black text-2xl px-lg py-sm rounded-xl border border-warning/30">
                {range.max}
              </span>
            </div>
          </div>
        )}

        {isTargetChooser && (
          <div className="glass-panel p-lg text-center border-accent/30 bg-accent/5">
            <p className="text-xs font-bold text-accent uppercase tracking-widest mb-xs">🤫 ตัวเลขลับของคุณ</p>
            <p className="text-4xl font-black text-accent">{gameData.targetNumber}</p>
          </div>
        )}

        {/* Last Move */}
        <AnimatePresence mode="wait">
          {lastMove && (
            <motion.div
              key={`${lastMove.player}-${lastMove.numbers.join(',')}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass-panel p-md text-center border-glass"
            >
              <p className="text-xs text-secondary font-bold mb-xs">เมื่อกี้</p>
              <p className="font-bold">
                <span className="text-primary">{lastMove.player}</span> นับ{' '}
                <span className="text-white font-black">
                  {lastMove.numbers.join(', ')}
                </span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Turn Indicator */}
        <div className={`glass-panel p-lg text-center ${isMyTurn ? 'border-success/40 bg-success/10' : 'border-glass'}`}>
          <p className="text-xs font-bold text-secondary uppercase tracking-widest mb-xs">
            {isMyTurn ? '🎯 ถึงตาคุณแล้ว!' : '⏰ ตาปัจจุบัน'}
          </p>
          <p className={`text-xl font-black ${isMyTurn ? 'text-success' : 'text-white'}`}>
            {isMyTurn ? 'เร็วเข้า! เลือกจำนวนเลขที่จะนับ' : `รอ ${currentPlayer} เลือก...`}
          </p>
        </div>

        {/* Controls */}
        {isMyTurn ? (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col gap-md"
          >
            <p className="text-center text-xs font-bold text-secondary uppercase tracking-widest">🎮 เลือกจำนวนเลขที่จะนับ</p>
            <div className="grid grid-cols-3 gap-md">
              <button
                className="glass-panel p-lg flex flex-col items-center gap-xs border-2 border-blue-400/40 bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 transition-all"
                onClick={() => handleMove(1)}
              >
                <span className="text-3xl font-black text-blue-400">+1</span>
                <span className="text-[10px] font-bold text-secondary">นับ 1 ตัว</span>
                <span className="text-xs text-blue-300 font-bold">{currentCount + 1}</span>
              </button>
              <button
                className="glass-panel p-lg flex flex-col items-center gap-xs border-2 border-green-400/40 bg-green-500/10 hover:bg-green-500/20 active:scale-95 transition-all"
                onClick={() => handleMove(2)}
              >
                <span className="text-3xl font-black text-green-400">+2</span>
                <span className="text-[10px] font-bold text-secondary">นับ 2 ตัว</span>
                <span className="text-xs text-green-300 font-bold">{currentCount + 1}-{currentCount + 2}</span>
              </button>
              <button
                className="glass-panel p-lg flex flex-col items-center gap-xs border-2 border-orange-400/40 bg-orange-500/10 hover:bg-orange-500/20 active:scale-95 transition-all"
                onClick={() => handleMove(3)}
              >
                <span className="text-3xl font-black text-orange-400">+3</span>
                <span className="text-[10px] font-bold text-secondary">นับ 3 ตัว</span>
                <span className="text-xs text-orange-300 font-bold">{currentCount + 1}-{currentCount + 3}</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="glass-panel p-xl flex-center flex-col gap-md">
            <div className="text-4xl animate-bounce">⏳</div>
            <p className="text-secondary font-bold">รอ {currentPlayer} เลือก...</p>
          </div>
        )}

        {/* Player Order */}
        <div className="glass-panel p-md">
          <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-sm">ลำดับผู้เล่น</p>
          <div className="flex flex-wrap gap-xs">
            {playerOrder.map((name, idx) => (
              <div
                key={name}
                className={`px-sm py-xs rounded-lg text-xs font-bold flex items-center gap-xs ${
                  idx === currentPlayerIndex
                    ? 'bg-success/20 text-success border border-success/40'
                    : 'bg-glass-dark/30 text-secondary border border-glass'
                }`}
              >
                {idx === currentPlayerIndex && <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></span>}
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Finished screen
  if (gameStatus === 'finished') {
    const loser = gameData.loser;
    const isLoser = loser === userNickname;
    const playerOrder = gameData.playerOrder || [];
    const winners = playerOrder.filter(n => n !== loser);

    return (
      <div className="flex flex-col gap-lg w-full animate-fade-in">
        <ErrorToast />
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-panel p-xl text-center"
        >
          <div className="text-4xl mb-md">🎊 🎉 🎊</div>
          <h2 className="text-3xl font-black mb-lg">เกมจบแล้ว!</h2>

          {/* Loser */}
          <div className={`p-xl rounded-2xl mb-lg ${isLoser ? 'bg-danger/10 border-2 border-danger/30' : 'bg-warning/10 border border-warning/30'}`}>
            <div className="text-5xl mb-sm">{isLoser ? '😢' : '🎭'}</div>
            <h3 className="text-2xl font-black mb-sm">
              {isLoser ? 'คุณแพ้!' : `${loser} แพ้!`}
            </h3>
            <div className="flex items-center justify-center gap-sm mt-md">
              <span className="text-secondary">ตัวเลขลับคือ</span>
              <span className="bg-primary/20 text-primary font-black text-2xl px-lg py-sm rounded-xl border border-primary/30">
                {gameData.targetNumber}
              </span>
            </div>
          </div>

          {/* Winners */}
          <div className="p-lg rounded-2xl bg-success/10 border border-success/30 mb-lg">
            <div className="flex items-center justify-center gap-sm mb-md">
              <Trophy size={20} className="text-success" />
              <h4 className="font-black text-success">ผู้ชนะ</h4>
            </div>
            <div className="flex flex-wrap gap-sm justify-center">
              {winners.map(name => (
                <span key={name} className="bg-success/20 text-success font-bold px-md py-xs rounded-lg border border-success/30">
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Scores */}
          <div className="space-y-sm">
            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-sm">คะแนนรวม</p>
            {Object.entries(gameData.scores || {}).sort((a, b) => b[1] - a[1]).map(([name, score]) => (
              <div key={name} className="flex justify-between items-center p-md bg-glass-dark/30 rounded-xl border border-glass">
                <div className="flex items-center gap-sm">
                  {name === loser ? <Skull size={16} className="text-danger" /> : <Crown size={16} className="text-warning" />}
                  <span className="font-bold">{name}</span>
                </div>
                <span className="font-black text-primary">{score} แต้ม</span>
              </div>
            ))}
          </div>
        </motion.div>

        {isHost ? (
          <button className="btn btn-primary w-full py-xl text-xl font-black" onClick={nextRound}>
            <RotateCcw size={24} />
            เล่นรอบถัดไป
          </button>
        ) : (
          <button
            className="btn btn-outline w-full py-lg font-black"
            onClick={requestLeave}
          >
            <LogOut size={18} /> ออกจากห้อง
          </button>
        )}
      </div>
    );
  }

  return null;
};

export default TargetNumber;

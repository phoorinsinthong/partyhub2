import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { RotateCcw, LogOut, Pencil, Clock, Maximize2, X } from 'lucide-react';
import { feedback } from '../utils/feedback';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useTurnNotification } from '../hooks/useTurnNotification';
import LeaveConfirmModal from '../components/LeaveConfirmModal';

const PLAYER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#e91e63', '#00bcd4', '#8bc34a',
];

const WORD_CATEGORIES = {
  animals: {
    label: 'สัตว์',
    words: [
      'แมว', 'หมา', 'ช้าง', 'ยีราฟ', 'เพนกวิน', 'ปลา', 'นก', 'กบ', 'เต่า', 'กระต่าย',
      'นกฮูก', 'ปลาฉลาม', 'เป็ด', 'กวาง', 'ผีเสื้อ', 'ม้า', 'ลิง', 'งู', 'แมงมุม', 'โลมา',
      'หมีแพนด้า', 'จระเข้', 'ปลาหมึก', 'แมงกะพรุน', 'หอยทาก', 'ปู', 'ไก่', 'หมู',
      'แรด', 'ฮิปโป', 'สิงโต', 'เสือ', 'หมีขั้วโลก', 'นกฟลามิงโก', 'ค้างคาว',
      'แมลงปอ', 'ตั๊กแตน', 'กุ้ง', 'ปลาการ์ตูน', 'นกยูง', 'อูฐ', 'แพนด้าแดง',
      'ควายไทย', 'ปลากัด', 'ชะนี', 'ตุ๊กแก', 'นกเงือก', 'ปลาช่อน',
    ],
  },
  food: {
    label: 'อาหาร',
    words: [
      'พิซซ่า', 'แฮมเบอร์เกอร์', 'ซูชิ', 'ไอศกรีม', 'เค้ก', 'แตงโม', 'กล้วย', 'ส้มตำ', 'ข้าวผัด', 'ก๋วยเตี๋ยว',
      'ฮอทดอก', 'โดนัท', 'ข้าวปั้น', 'ชาไข่มุก', 'ป๊อปคอร์น',
      'ต้มยำกุ้ง', 'ผัดไทย', 'ข้าวมันไก่', 'ลูกชิ้นปิ้ง', 'ขนมครก',
      'แกงเขียวหวาน', 'มะม่วง', 'ทุเรียน', 'มะพร้าว', 'ส้ม',
      'ไข่ดาว', 'ข้าวเหนียวมะม่วง', 'หมูสะเต๊ะ', 'ลูกชิ้น', 'ไก่ย่าง',
      'ราเมน', 'ทาโก้', 'เครป', 'วาฟเฟิล', 'แพนเค้ก',
      'ขนมจีน', 'ผัดกะเพรา', 'หมูกระทะ', 'ชาบู', 'กุ้งเผา',
    ],
  },
  places: {
    label: 'สถานที่',
    words: [
      'บ้าน', 'ภูเขา', 'ทะเล', 'ปราสาท', 'สะพาน', 'โรงเรียน', 'สนามบิน', 'สวนสนุก', 'ชายหาด', 'น้ำตก',
      'วัด', 'ห้างสรรพสินค้า', 'ถ้ำ', 'เกาะ', 'สวนสัตว์',
      'ตลาดน้ำ', 'พีระมิด', 'ประภาคาร', 'กังหันลม', 'ภูเขาไฟ',
      'ไร่นา', 'ป่าดงดิบ', 'ทะเลทราย', 'หอไอเฟล', 'สะพานแขวน',
      'ตึกระฟ้า', 'สระว่ายน้ำ', 'สวนสาธารณะ', 'ตลาดนัด', 'สถานีรถไฟ',
      'วัดอรุณ', 'เยาวราช', 'ดอยสุเทพ', 'เขาใหญ่', 'ตลาดจตุจักร',
    ],
  },
  objects: {
    label: 'สิ่งของ',
    words: [
      'ร่ม', 'จักรยาน', 'กล้อง', 'นาฬิกา', 'หมวก', 'แว่นตา', 'โทรศัพท์', 'กีตาร์', 'กระเป๋า', 'รองเท้า',
      'ตุ๊กตาหมี', 'เตียง', 'ตู้เย็น', 'แว่นกันแดด', 'กระบองเพชร',
      'เทียน', 'กรรไกร', 'กุญแจ', 'หนังสือ', 'ดินสอ',
      'ถังขยะ', 'พัดลม', 'โคมไฟ', 'หม้อ', 'ช้อนส้อม',
      'กระทง', 'ว่าว', 'ตะเกียง', 'กลอง', 'ลูกโป่ง',
      'ครกตำส้มตำ', 'พวงมาลัย', 'ธูปเทียน', 'รถตุ๊กตุ๊ก', 'บัตรแรบบิท',
      'เครื่องซักผ้า', 'ไม้กวาด', 'สายชาร์จ', 'หมวกกันน็อค', 'ไมโครโฟน',
    ],
  },
  vehicles: {
    label: 'ยานพาหนะ',
    words: [
      'รถ', 'เรือ', 'เครื่องบิน', 'จรวด', 'เรือดำน้ำ', 'รถไฟ', 'จักรยาน', 'เฮลิคอปเตอร์', 'รถบัส', 'เรือใบ',
      'สเก็ตบอร์ด', 'รถแข่ง', 'บอลลูน', 'รถตุ๊กตุ๊ก', 'รถมอเตอร์ไซค์',
      'เรือยาว', 'รถสามล้อ', 'รถพยาบาล', 'รถดับเพลิง', 'รถถัง',
      'เรือสำเภา', 'รถเข็น', 'กอนโดลา', 'รถไถนา', 'เรือคายัค',
      'รถแทรกเตอร์', 'รถเมล์สาย 8', 'เรือหางยาว', 'รถไฟฟ้า BTS', 'รถสองแถว',
    ],
  },
  fantasy: {
    label: 'แฟนตาซี',
    words: [
      'มังกร', 'หุ่นยนต์', 'ยูนิคอร์น', 'มงกุฎ', 'ดาบ', 'เงือก', 'พ่อมด', 'ซุปเปอร์ฮีโร่', 'ปราสาท', 'นินจา',
      'เจ้าหญิง', 'อัศวิน', 'ซอมบี้', 'แวมไพร์', 'หุ่นยนต์ยักษ์',
      'ผี', 'ยักษ์', 'แม่มด', 'นางฟ้า', 'โจรสลัด',
      'เอเลี่ยน', 'มัมมี่', 'โทรลล์', 'ฟีนิกซ์', 'กระบี่วิเศษ',
      'ไม้กายสิทธิ์', 'พรมวิเศษ', 'ไข่มังกร', 'ดาวมรณะ', 'ยานอวกาศ',
      'นาค', 'กุมารทอง', 'พญาครุฑ', 'กินรี', 'หนุมาน',
    ],
  },
};

const ALL_WORDS = Object.values(WORD_CATEGORIES).flatMap(c => c.words);

const TURN_TIME_OPTIONS = [
  { label: '10 วิ', seconds: 10 },
  { label: '15 วิ', seconds: 15 },
  { label: '30 วิ', seconds: 30 },
];
const ROUNDS_OPTIONS = [
  { label: '2 รอบ', value: 2 },
  { label: '3 รอบ', value: 3 },
  { label: '4 รอบ', value: 4 },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FakeArtist = ({ roomId, roomData, userNickname }) => {
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const isHost = userNickname === roomData.host;
  const gameData = roomData.gameData || {};
  const players = Object.keys(roomData.players || {});
  const [errorMsg, setErrorMsg] = useState('');
  const [voteTarget, setVoteTarget] = useState(null);
  const [guessInput, setGuessInput] = useState('');
  const [customWord, setCustomWord] = useState('');
  const [wordMode, setWordMode] = useState('random');
  const [selectedCategory, setSelectedCategory] = useState('animals');
  const [selectedTurnTime, setSelectedTurnTime] = useState(15);
  const [selectedRounds, setSelectedRounds] = useState(2);
  const turnTime = gameData.turnTime || 15;
  const totalRounds = gameData.totalRounds || 2;
  const [timeLeft, setTimeLeft] = useState(turnTime);
  const [skippedPlayer, setSkippedPlayer] = useState(null);
  const [showFullCanvas, setShowFullCanvas] = useState(false);

  const canvasRef = useRef(null);
  const fullCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const personalRecordedRef = useRef(false);
  const advancingRef = useRef(false);
  const autoSkipRef = useRef(false);
  const voteProcessedRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const lastPointRef = useRef(null);
  const [localPaths, setLocalPaths] = useState([]);

  const phase = gameData.phase || 'waiting';
  const secretWord = gameData.secretWord || '';
  const fakeArtist = gameData.fakeArtist || '';
  const turnOrder = gameData.turnOrder || [];
  const currentTurnIndex = gameData.currentTurnIndex ?? 0;
  const currentRound = gameData.currentRound ?? 1;
  const turnsPlayed = gameData.turnsPlayed ?? 0;
  const paths = gameData.paths || [];
  const votes = gameData.votes || null;
  const colorMap = gameData.colorMap || {};
  const fakeGuess = gameData.fakeGuess || '';
  const voteResult = gameData.voteResult || null;

  const totalTurnsNeeded = turnOrder.length * totalRounds;
  const currentPlayer = turnOrder[currentTurnIndex] || '';
  const isMyTurn = currentPlayer === userNickname;
  const iAmFakeArtist = fakeArtist === userNickname;

  useTurnNotification(isMyTurn, phase === 'drawing' ? 'playing' : phase);

  const safeUpdate = async (refPath, data) => {
    try {
      await update(ref(db, refPath), data);
    } catch {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  useEffect(() => {
    if (phase === 'waiting') personalRecordedRef.current = false;
    if (phase === 'voting') voteProcessedRef.current = false;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('fakeartist');
    if (voteResult === 'artists_win' && !iAmFakeArtist) {
      recordPersonalWin('fakeartist');
    } else if ((voteResult === 'fake_wins' || voteResult === 'fake_guessed') && iAmFakeArtist) {
      recordPersonalWin('fakeartist');
    }
  }, [phase, voteResult]);

  // Canvas resize — re-run when phase changes (container may not exist in earlier phases)
  useEffect(() => {
    const resizeCanvas = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = Math.min(w, 400);
      if (w > 0) setCanvasSize({ w, h });
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [phase]);

  // Turn timer — auto-skip if time runs out
  useEffect(() => {
    if (phase !== 'drawing') return;
    setTimeLeft(turnTime);
    setSkippedPlayer(null);
    autoSkipRef.current = false;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          feedback('timeUp');
          if (isHost && !autoSkipRef.current) {
            autoSkipRef.current = true;
            setSkippedPlayer(currentPlayer);
            setTimeout(() => setSkippedPlayer(null), 2000);
            const newTurnsPlayed = turnsPlayed + 1;
            let nextIndex = (currentTurnIndex + 1) % turnOrder.length;
            let nextRound = currentRound + (currentTurnIndex + 1 >= turnOrder.length ? 1 : 0);
            let nextPhase = newTurnsPlayed >= totalTurnsNeeded ? 'voting' : 'drawing';
            safeUpdate(`rooms/${roomId}/gameData`, {
              currentTurnIndex: nextIndex,
              currentRound: nextRound,
              turnsPlayed: newTurnsPlayed,
              phase: nextPhase,
              turnStartedAt: Date.now(),
            });
          }
          return 0;
        }
        if (t <= 6) feedback('countdown');
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, currentTurnIndex, currentRound]);

  // Draw all paths on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.w === 0) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const allPaths = [...paths, ...localPaths];
    allPaths.forEach((path) => {
      if (!path.points || path.points.length < 2) return;
      ctx.strokeStyle = path.color || '#000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(path.points[0].x * canvas.width, path.points[0].y * canvas.height);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x * canvas.width, path.points[i].y * canvas.height);
      }
      ctx.stroke();
    });
  }, [paths, localPaths, canvasSize, phase, showFullCanvas]);

  // Draw paths on fullscreen canvas
  useEffect(() => {
    const canvas = fullCanvasRef.current;
    if (!canvas || !showFullCanvas || canvasSize.w === 0) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    paths.forEach((path) => {
      if (!path.points || path.points.length < 2) return;
      ctx.strokeStyle = path.color || '#000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(path.points[0].x * canvas.width, path.points[0].y * canvas.height);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x * canvas.width, path.points[i].y * canvas.height);
      }
      ctx.stroke();
    });
  }, [paths, canvasSize, showFullCanvas]);

  // Drawing handlers
  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const startDraw = (e) => {
    if (!isMyTurn || phase !== 'drawing') return;
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    setIsDrawing(true);
    lastPointRef.current = pos;
    setLocalPaths([{ color: colorMap[userNickname] || '#000', points: [pos] }]);
  };

  const moveDraw = (e) => {
    if (!isDrawing || !isMyTurn) return;
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    setLocalPaths((prev) => {
      const current = prev[0];
      if (!current) return prev;
      return [{ ...current, points: [...current.points, pos] }];
    });
    lastPointRef.current = pos;
  };

  const endDraw = async (e) => {
    if (!isDrawing || !isMyTurn) return;
    e?.preventDefault();
    setIsDrawing(false);
    const myPath = localPaths[0];
    if (!myPath || myPath.points.length < 2) {
      setLocalPaths([]);
      return;
    }

    const newPaths = [...paths, myPath];
    const newTurnsPlayed = turnsPlayed + 1;
    let nextIndex = (currentTurnIndex + 1) % turnOrder.length;
    let nextRound = currentRound + (currentTurnIndex + 1 >= turnOrder.length ? 1 : 0);
    let nextPhase = newTurnsPlayed >= totalTurnsNeeded ? 'voting' : 'drawing';

    await safeUpdate(`rooms/${roomId}/gameData`, {
      paths: newPaths,
      currentTurnIndex: nextIndex,
      currentRound: nextRound,
      turnsPlayed: newTurnsPlayed,
      phase: nextPhase,
    });
    setLocalPaths([]);
  };

  // Register non-passive touch listeners for iOS Safari
  const drawHandlersRef = useRef({ startDraw, moveDraw, endDraw });
  drawHandlersRef.current = { startDraw, moveDraw, endDraw };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || phase !== 'drawing') return;
    const opts = { passive: false };
    const onStart = (e) => drawHandlersRef.current.startDraw(e);
    const onMove = (e) => drawHandlersRef.current.moveDraw(e);
    const onEnd = (e) => drawHandlersRef.current.endDraw(e);
    canvas.addEventListener('touchstart', onStart, opts);
    canvas.addEventListener('touchmove', onMove, opts);
    canvas.addEventListener('touchend', onEnd, opts);
    return () => {
      canvas.removeEventListener('touchstart', onStart, opts);
      canvas.removeEventListener('touchmove', onMove, opts);
      canvas.removeEventListener('touchend', onEnd, opts);
    };
  }, [phase, canvasSize]);

  // Host starts game
  const handleStartGame = async () => {
    if (!isHost || advancingRef.current) return;
    if (wordMode === 'custom' && !customWord.trim()) return;
    advancingRef.current = true;
    feedback('gameStart');

    let word;
    if (wordMode === 'custom' && customWord.trim()) {
      word = customWord.trim();
    } else if (wordMode === 'category') {
      const catWords = WORD_CATEGORIES[selectedCategory]?.words || ALL_WORDS;
      word = catWords[Math.floor(Math.random() * catWords.length)];
    } else {
      word = ALL_WORDS[Math.floor(Math.random() * ALL_WORDS.length)];
    }
    const fake = players[Math.floor(Math.random() * players.length)];
    const order = shuffle(players);
    const startIndex = Math.floor(Math.random() * order.length);
    const colors = {};
    players.forEach((p, i) => { colors[p] = PLAYER_COLORS[i % PLAYER_COLORS.length]; });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'reveal',
        secretWord: word,
        fakeArtist: fake,
        turnOrder: order,
        currentTurnIndex: startIndex,
        currentRound: 1,
        turnsPlayed: 0,
        turnTime: selectedTurnTime,
        totalRounds: selectedRounds,
        paths: [],
        votes: null,
        colorMap: colors,
        voteResult: null,
        fakeGuess: null,
        turnStartedAt: Date.now(),
        startTime: Date.now(),
      });
      setCustomWord('');
    } finally {
      advancingRef.current = false;
    }
  };

  const handleStartDrawing = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'drawing' });
  };

  // Vote submission
  const handleVote = async () => {
    if (!voteTarget || (votes && votes[userNickname])) return;
    await safeUpdate(`rooms/${roomId}/gameData/votes`, { [userNickname]: voteTarget });
  };

  // Check vote results (host processes)
  useEffect(() => {
    if (phase !== 'voting' || !isHost || !votes || voteProcessedRef.current) return;
    const totalVoted = Object.keys(votes).length;
    if (totalVoted < players.length) return;

    voteProcessedRef.current = true;
    const tally = {};
    Object.values(votes).forEach((v) => { tally[v] = (tally[v] || 0) + 1; });
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const mostVoted = sorted[0][0];

    if (mostVoted === fakeArtist) {
      safeUpdate(`rooms/${roomId}/gameData`, { phase: 'fake_guess', voteResult: 'caught' });
    } else {
      safeUpdate(`rooms/${roomId}/gameData`, { phase: 'finished', voteResult: 'fake_wins' });
      recordWin(roomId, fakeArtist, 'fakeartist');
    }
  }, [votes, phase, players.length]);

  // Fake artist guesses
  const handleFakeGuess = async () => {
    if (!iAmFakeArtist || !guessInput.trim()) return;
    const correct = guessInput.trim().toLowerCase() === secretWord.toLowerCase();
    const result = correct ? 'fake_guessed' : 'artists_win';
    await safeUpdate(`rooms/${roomId}/gameData`, {
      phase: 'finished',
      fakeGuess: guessInput.trim(),
      voteResult: result,
    });
    if (correct) {
      recordWin(roomId, fakeArtist, 'fakeartist');
    }
  };

  const handlePlayAgain = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'waiting',
        secretWord: null,
        fakeArtist: null,
        turnOrder: null,
        currentTurnIndex: 0,
        currentRound: 1,
        turnsPlayed: 0,
        paths: null,
        votes: null,
        colorMap: null,
        voteResult: null,
        fakeGuess: null,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  const ErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-xl">
      {errorMsg}
    </div>
  ) : null;

  // Fullscreen Canvas Modal
  const fullCanvasModal = showFullCanvas ? (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-white flex flex-col"
    >
      <div className="flex-between p-3 border-b border-olive-100">
        <span className="text-[13px] font-bold text-olive-600">ดูรูปเต็มจอ</span>
        <button className="w-9 h-9 rounded-xl bg-olive-100 flex-center" onClick={() => setShowFullCanvas(false)}>
          <X size={18} className="text-olive-500" />
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[500px]">
          <canvas
            ref={fullCanvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            className="w-full bg-white border-2 border-olive-100 rounded-xl"
            style={{ height: `${canvasSize.h}px` }}
          />
        </div>
        <div className="flex flex-wrap gap-2 justify-center mt-4">
          {players.map((p) => (
            <div key={p} className="flex items-center gap-1 text-[12px] text-olive-600">
              <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: colorMap[p] }} />
              <span className={p === fakeArtist && phase === 'finished' ? 'font-bold text-red-500' : ''}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  ) : null;

  // ─── WAITING ───
  if (phase === 'waiting') {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <ErrorToast />
        <div className="card p-6 text-center">
          <div className="text-5xl mb-3">🎨</div>
          <h2 className="font-display font-bold text-xl text-olive-800 mb-2">ศิลปินปลอม</h2>
          <p className="text-olive-500 text-sm mb-4">
            ทุกคนวาดรูปตามคำ แต่มี 1 คนที่ไม่รู้คำ!<br />
            หาให้เจอว่าใครคือศิลปินปลอม
          </p>
          <div className="text-[12px] text-olive-400 mb-4">
            ผู้เล่น {players.length} คน • วาด {selectedRounds} รอบ • {selectedTurnTime} วิ/ตา
          </div>
          {isHost ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {['random', 'category', 'custom'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setWordMode(mode)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-bold border-2 transition-all ${
                      wordMode === mode ? 'border-sage-400 bg-sage-50 text-sage-700' : 'border-olive-100 text-olive-400'
                    }`}
                  >
                    {{ random: 'สุ่มคำ', category: 'เลือกหมวด', custom: 'ตั้งคำเอง' }[mode]}
                  </button>
                ))}
              </div>
              {wordMode === 'category' && (
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(WORD_CATEGORIES).map(([key, cat]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedCategory(key)}
                      className={`px-2 py-2 rounded-xl text-[11px] font-bold border-2 transition-all ${
                        selectedCategory === key ? 'border-sage-400 bg-sage-50 text-sage-700' : 'border-olive-100 text-olive-400'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}
              {wordMode === 'custom' && (
                <input
                  type="text"
                  value={customWord}
                  onChange={(e) => setCustomWord(e.target.value)}
                  placeholder="พิมพ์คำที่ต้องการ..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-olive-200 text-center font-bold text-[15px] focus:border-sage-400 outline-none"
                />
              )}
              <div>
                <p className="text-[11px] font-bold text-olive-500 mb-2 text-center">เวลาวาดต่อตา</p>
                <div className="flex gap-2 justify-center">
                  {TURN_TIME_OPTIONS.map(opt => (
                    <button
                      key={opt.seconds}
                      onClick={() => setSelectedTurnTime(opt.seconds)}
                      className={`flex-1 py-2.5 rounded-2xl text-[13px] font-bold border-2 transition-colors ${
                        selectedTurnTime === opt.seconds
                          ? 'bg-sage-500 border-sage-500 text-white'
                          : 'bg-white border-olive-100 text-olive-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold text-olive-500 mb-2 text-center">จำนวนรอบวาด</p>
                <div className="flex gap-2 justify-center">
                  {ROUNDS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedRounds(opt.value)}
                      className={`flex-1 py-2.5 rounded-2xl text-[13px] font-bold border-2 transition-colors ${
                        selectedRounds === opt.value
                          ? 'bg-sage-500 border-sage-500 text-white'
                          : 'bg-white border-olive-100 text-olive-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleStartGame}
                disabled={wordMode === 'custom' && !customWord.trim()}
                className="btn btn-primary w-full py-3.5 text-[15px]"
              >
                <Pencil size={16} /> เริ่มเกม
              </button>
            </div>
          ) : (
            <p className="text-olive-400 text-sm font-semibold">รอ Host เริ่มเกม...</p>
          )}
        </div>
      </div>
    );
  }

  // ─── REVEAL PHASE ───
  if (phase === 'reveal') {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <ErrorToast />
        <div className="card p-6 text-center">
          <h2 className="font-display font-bold text-lg text-olive-800 mb-4">บทบาทของคุณ</h2>
          {iAmFakeArtist ? (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-4">
              <div className="text-4xl mb-2">🎭</div>
              <p className="font-bold text-red-600 text-lg">คุณคือศิลปินปลอม!</p>
              <p className="text-red-400 text-sm mt-1">คุณไม่รู้คำ — วาดตามคนอื่นไป อย่าให้ใครจับได้!</p>
            </div>
          ) : (
            <div className="bg-sage-50 border-2 border-sage-200 rounded-2xl p-5 mb-4">
              <div className="text-4xl mb-2">🎨</div>
              <p className="font-bold text-sage-700 text-lg">คุณคือศิลปินตัวจริง</p>
              <p className="text-sage-600 text-[15px] mt-2">คำที่ต้องวาด:</p>
              <p className="font-black text-2xl text-olive-800 mt-1">{secretWord}</p>
            </div>
          )}
          <div className="flex items-center gap-2 justify-center mb-4">
            <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: colorMap[userNickname] }} />
            <span className="text-sm text-olive-600">สีของคุณ</span>
          </div>
          {isHost && (
            <button onClick={handleStartDrawing} className="btn btn-primary w-full py-3 text-[14px]">
              เริ่มวาด!
            </button>
          )}
          {!isHost && <p className="text-olive-400 text-sm">รอ Host กดเริ่มวาด...</p>}
        </div>
      </div>
    );
  }

  // ─── DRAWING PHASE ───
  if (phase === 'drawing') {
    return (
      <div className="flex flex-col gap-3 animate-fade-in">
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <ErrorToast />
        <AnimatePresence>
          {skippedPlayer && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-4 py-2 rounded-2xl font-bold text-[12px] shadow-xl"
            >
              {skippedPlayer} หมดเวลา! ข้ามตา
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status bar */}
        <div className="card p-3">
          <div className="flex-between mb-2">
            <span className="text-[12px] font-bold text-olive-500">รอบ {currentRound}/{totalRounds}</span>
            <div className="flex items-center gap-1.5">
              <Clock size={12} className={timeLeft <= 5 ? 'text-red-500' : 'text-olive-400'} />
              <span className={`font-black text-[13px] ${timeLeft <= 5 ? 'text-red-500' : 'text-olive-700'}`}>{timeLeft}s</span>
            </div>
            {!iAmFakeArtist && (
              <span className="text-[12px] font-bold text-olive-600">คำ: <span className="text-sage-600">{secretWord}</span></span>
            )}
            {iAmFakeArtist && (
              <span className="text-[12px] font-bold text-red-400">คำ: ???</span>
            )}
          </div>
          {/* Timer bar */}
          <div className="h-1 bg-olive-100 rounded-full mb-2 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${timeLeft <= 5 ? 'bg-red-400' : timeLeft <= 10 ? 'bg-amber-400' : 'bg-sage-400'}`}
              animate={{ width: `${(timeLeft / turnTime) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: colorMap[currentPlayer] }} />
            <span className="text-[13px] font-bold text-olive-700">
              {isMyTurn ? 'ถึงตาคุณวาด!' : `${currentPlayer} กำลังวาด...`}
            </span>
          </div>
        </div>

        {/* Turn order */}
        <div className="flex gap-1.5 overflow-x-auto px-1 pb-1">
          {turnOrder.map((p, i) => (
            <div
              key={p}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${
                i === currentTurnIndex ? 'bg-sage-100 border-2 border-sage-300' : 'bg-olive-50 border border-olive-100'
              }`}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorMap[p] }} />
              {p === userNickname ? 'คุณ' : p}
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="card overflow-hidden">
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            className={`w-full bg-white ${isMyTurn ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
            style={{ touchAction: 'none', height: `${canvasSize.h}px` }}
            onMouseDown={startDraw}
            onMouseMove={moveDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
          />
        </div>

        {isMyTurn && (
          <p className="text-center text-[12px] font-bold text-sage-600 bg-sage-50 rounded-xl p-2">
            วาดเส้นเดียว แล้วยกนิ้วเพื่อจบตา
          </p>
        )}
      </div>
    );
  }

  // ─── VOTING PHASE ───
  if (phase === 'voting') {
    const myVote = votes?.[userNickname];
    const totalVoted = Object.keys(votes || {}).length;
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        {fullCanvasModal}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <ErrorToast />
        <div className="card p-5">
          <h2 className="font-display font-bold text-lg text-olive-800 mb-1 text-center">โหวตหาศิลปินปลอม!</h2>
          <p className="text-olive-400 text-[12px] text-center mb-4">โหวตแล้ว {totalVoted}/{players.length}</p>

          {/* Canvas preview */}
          <div ref={containerRef} className="relative rounded-xl overflow-hidden mb-4 border-2 border-olive-100">
            <canvas
              ref={canvasRef}
              width={canvasSize.w}
              height={canvasSize.h}
              className="w-full bg-white"
              style={{ height: `${Math.min(canvasSize.w * 0.6, 240)}px` }}
            />
            <button
              onClick={() => setShowFullCanvas(true)}
              className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/30 backdrop-blur-sm flex-center text-white active:bg-black/50"
            >
              <Maximize2 size={14} />
            </button>
          </div>

          <div className="space-y-2">
            {players.map((p) => (
              <button
                key={p}
                disabled={!!myVote || p === userNickname}
                onClick={() => setVoteTarget(p)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
                  voteTarget === p ? 'border-sage-400 bg-sage-50' :
                  myVote === p ? 'border-sage-400 bg-sage-50' :
                  'border-olive-100 bg-white'
                } ${p === userNickname ? 'opacity-40' : ''}`}
              >
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: colorMap[p] }} />
                <span className="font-bold text-[14px] text-olive-700">{p}</span>
                {p === userNickname && <span className="text-[10px] text-olive-400 ml-auto">(คุณ)</span>}
              </button>
            ))}
          </div>

          {!myVote && voteTarget && (
            <button onClick={handleVote} className="btn btn-primary w-full py-3 mt-4 text-[14px]">
              ยืนยันโหวต
            </button>
          )}
          {myVote && (
            <p className="text-center text-sage-600 font-bold text-[13px] mt-4">โหวตแล้ว — รอคนอื่น...</p>
          )}
        </div>
      </div>
    );
  }

  // ─── FAKE GUESS PHASE ───
  if (phase === 'fake_guess') {
    const syllableCount = secretWord.replace(/[\s\-]/g, '').length;
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <ErrorToast />
        <div className="card p-6 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <h2 className="font-display font-bold text-lg text-olive-800 mb-2">จับศิลปินปลอมได้!</h2>
          <p className="text-olive-500 text-sm mb-2">
            <span className="font-bold text-red-500">{fakeArtist}</span> คือศิลปินปลอม!<br />
            แต่ถ้าเดาคำถูก ก็ยังชนะได้...
          </p>
          <p className="text-[13px] font-bold text-amber-600 bg-amber-50 inline-block px-3 py-1.5 rounded-full mb-4">
            💡 ใบ้: {syllableCount} ตัวอักษร
          </p>

          {iAmFakeArtist ? (
            <div className="space-y-3">
              <input
                type="text"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder="พิมพ์คำที่คิดว่าถูก..."
                className="w-full px-4 py-3 rounded-xl border-2 border-olive-200 text-center font-bold text-[15px]"
              />
              <button
                onClick={handleFakeGuess}
                disabled={!guessInput.trim()}
                className="btn btn-primary w-full py-3 text-[14px]"
              >
                ยืนยันคำตอบ
              </button>
            </div>
          ) : (
            <p className="text-olive-400 text-sm font-semibold">รอศิลปินปลอมเดาคำ...</p>
          )}
        </div>
      </div>
    );
  }

  // ─── FINISHED ───
  if (phase === 'finished') {
    const artistsWon = voteResult === 'artists_win';
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        {fullCanvasModal}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <ErrorToast />
        <div className="card p-6 text-center">
          <div className="text-5xl mb-3">{artistsWon ? '🎨' : '🎭'}</div>
          <h2 className="font-display font-bold text-xl text-olive-800 mb-2">
            {artistsWon ? 'ศิลปินตัวจริงชนะ!' : 'ศิลปินปลอมชนะ!'}
          </h2>

          <div className="bg-olive-50 rounded-2xl p-4 mb-4 space-y-2">
            <p className="text-sm text-olive-600">
              ศิลปินปลอม: <span className="font-bold text-red-500">{fakeArtist}</span>
            </p>
            <p className="text-sm text-olive-600">
              คำที่ต้องวาด: <span className="font-bold text-olive-800">{secretWord}</span>
            </p>
            {fakeGuess && (
              <p className="text-sm text-olive-600">
                ศิลปินปลอมเดา: <span className={`font-bold ${fakeGuess === secretWord ? 'text-green-600' : 'text-red-500'}`}>{fakeGuess}</span>
              </p>
            )}
            {voteResult === 'fake_wins' && (
              <p className="text-[12px] text-olive-400 mt-1">โหวตผิดคน — ศิลปินปลอมรอดไป!</p>
            )}
            {voteResult === 'fake_guessed' && (
              <p className="text-[12px] text-olive-400 mt-1">โดนจับได้แต่เดาคำถูก!</p>
            )}
          </div>

          {/* Canvas preview */}
          <div ref={containerRef} className="relative rounded-xl overflow-hidden mb-4 border-2 border-olive-100">
            <canvas
              ref={canvasRef}
              width={canvasSize.w}
              height={canvasSize.h}
              className="w-full bg-white"
              style={{ height: `${Math.min(canvasSize.w * 0.6, 240)}px` }}
            />
            <button
              onClick={() => setShowFullCanvas(true)}
              className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/30 backdrop-blur-sm flex-center text-white active:bg-black/50"
            >
              <Maximize2 size={14} />
            </button>
          </div>

          {/* Color legend */}
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {players.map((p) => (
              <div key={p} className="flex items-center gap-1 text-[11px] text-olive-600">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorMap[p] }} />
                <span className={p === fakeArtist ? 'font-bold text-red-500' : ''}>{p}</span>
              </div>
            ))}
          </div>

          {isHost ? (
            <div className="space-y-2">
              <button onClick={handlePlayAgain} className="btn btn-primary w-full py-3.5 text-[15px]">
                <RotateCcw size={16} /> เล่นอีกรอบ
              </button>
              <button onClick={handleBackToLobby} className="btn btn-outline w-full py-3 text-[13px]">
                <LogOut size={14} /> กลับ Lobby
              </button>
            </div>
          ) : (
            <button onClick={requestLeave} className="btn btn-outline w-full py-3.5 text-[14px]">
              <LogOut size={15} /> ออกจากห้อง
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default FakeArtist;

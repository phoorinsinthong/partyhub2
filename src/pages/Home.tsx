import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Users, Crown, UserPlus, QrCode, X, Sparkles } from 'lucide-react';
import { ref, set, get, onValue, remove } from 'firebase/database';
import { db, auth, authReady } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import AvatarPicker from '../components/AvatarPicker';
import ThemeToggle from '../components/ThemeToggle';
import SoundToggle from '../components/SoundToggle';
import ReconnectBanner, { saveSession } from '../components/ReconnectBanner';
import { loadAvatar, getAvatarColor, getRandomAvatar, getRandomColor, saveAvatar } from '../utils/avatars';
import { rateLimitCreateRoom, rateLimitJoinRoom } from '../utils/rateLimit';
import { useGame } from '../contexts/GameContext';

interface Room {
  code: string;
  host: string;
  status: string;
  createdAt: number;
  playerCount: number;
  playerNames: string[];
  players: Record<string, any>;
  hostDisconnectedAt?: number;
  currentGame?: string;
}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [nickname, setNickname] = useState(() => localStorage.getItem('nickname') || '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { setUserNickname } = useGame();

  const [avatarEmoji, setAvatarEmoji] = useState(() => loadAvatar().emoji || getRandomAvatar());
  const [avatarColor, setAvatarColor] = useState(() => loadAvatar().color || getRandomColor());
  const [avatarFrame, setAvatarFrame] = useState(() => loadAvatar().frame || 'none');
  const [avatarGradient, setAvatarGradient] = useState(() => loadAvatar().gradient || '');

  // Kicked toast state
  const [kickedToast, setKickedToast] = useState(() => !!location.state?.kicked);

  useEffect(() => {
    if (location.state?.kicked) {
      window.history.replaceState({}, '');
      const t = setTimeout(() => setKickedToast(false), 4000);
      return () => clearTimeout(t);
    }
  }, [location.state?.kicked]);

  // Save avatar if it was newly generated
  useEffect(() => {
    const saved = loadAvatar();
    if (!saved.emoji) {
      saveAvatar(avatarEmoji, avatarColor, avatarFrame, avatarGradient);
    }
  }, [avatarEmoji, avatarColor, avatarFrame, avatarGradient]);

  useEffect(() => {
    const ROOM_MAX_AGE = 2 * 60 * 60 * 1000;
    const PLAYING_MAX_AGE = 60 * 60 * 1000;
    const HOST_DISCONNECT_MAX = 10 * 60 * 1000; // 10 minutes grace period
    const cleanedRooms = new Set();
    const shouldCleanup = Math.random() < 0.33;

    const unsubscribe = onValue(ref(db, 'rooms'), (snapshot) => {
      setLoading(false);
      if (!snapshot.exists()) { setRooms([]); return; }
      const data = snapshot.val();
      const now = Date.now();

      if (shouldCleanup) {
        Object.entries(data).forEach(([code, room]: [string, any]) => {
          if (cleanedRooms.has(code)) return;
          const age = now - (room.createdAt || 0);
          const pc = room.players ? Object.keys(room.players).length : 0;
          const allOffline = room.players && Object.values(room.players).every((p: any) => p.online === false);
          const hostGone = room.hostDisconnectedAt && (now - room.hostDisconnectedAt) > HOST_DISCONNECT_MAX;
          const playingTooLong = room.status === 'playing' && age > PLAYING_MAX_AGE;

          const shouldDelete = pc === 0 || age > ROOM_MAX_AGE || playingTooLong || (allOffline && hostGone);

          if (shouldDelete) {
            cleanedRooms.add(code);
            remove(ref(db, `rooms/${code}`)).catch(() => {});
          }
        });
      }

      const list = Object.entries(data)
        .filter(([code, room]: [string, any]) => {
          if (cleanedRooms.has(code)) return false;
          const age = now - (room.createdAt || 0);
          const pc = room.players ? Object.keys(room.players).length : 0;
          return pc > 0 && age <= ROOM_MAX_AGE;
        })
        .map(([code, room]: [string, any]) => ({
          code, ...room,
          playerCount: room.players ? Object.keys(room.players).length : 0,
          playerNames: room.players ? Object.keys(room.players) : []
        }));
      
      list.sort((a, b) => {
        if (a.status === 'waiting' && b.status !== 'waiting') return -1;
        if (a.status !== 'waiting' && b.status === 'waiting') return 1;
        return b.createdAt - a.createdAt;
      });
      setRooms(list);
    });
    return () => unsubscribe();
  }, []);

  const handleAvatarSelect = (emoji: string, color: string, frame = 'none', gradient = '') => {
    setAvatarEmoji(emoji);
    setAvatarColor(color);
    setAvatarFrame(frame);
    setAvatarGradient(gradient);
    setShowAvatarPicker(false);
  };

  const validateNickname = (name: string) => {
    if (/[.#$[\]/]/.test(name)) {
      setError('ชื่อห้ามมีอักขระ . # $ [ ] /');
      return false;
    }
    return true;
  };

  const handleCreateRoom = useCallback(async () => {
    if (isSubmitting) return;
    const trimmedName = nickname.trim();
    if (!trimmedName) { setError('โปรดใส่ชื่อเล่นก่อนนะ!'); return; }
    if (!validateNickname(trimmedName)) return;
    if (!rateLimitCreateRoom()) { setError('สร้างห้องบ่อยเกินไป รอสักครู่นะ'); return; }
    
    setIsSubmitting(true);
    try {
      await authReady;
      const currentUser = auth.currentUser;
      if (!currentUser) { setError('ยังไม่ได้เข้าสู่ระบบ — ลองรีเฟรช'); return; }
      
      const uid = currentUser.uid;
      let code = '';
      for (let i = 0; i < 5; i++) {
        code = Math.random().toString(36).substring(2, 6).toUpperCase();
        const existing = await get(ref(db, `rooms/${code}/host`));
        if (!existing.exists()) break;
        if (i === 4) { setError('สร้างรหัสห้องไม่ได้ ลองใหม่อีกครั้ง'); return; }
      }
      
      const now = Date.now();
      await set(ref(db, `rooms/${code}`), {
        host: trimmedName, status: 'waiting', createdAt: now, currentGame: null,
        players: { [trimmedName]: {
          name: trimmedName, isHost: true, joinedAt: now,
          avatar: avatarEmoji, avatarColor: avatarColor, uid,
        } }
      });
      
      localStorage.setItem('nickname', trimmedName);
      setUserNickname(trimmedName);
      localStorage.setItem('isHost', 'true');
      saveSession(code, trimmedName);
      navigate(`/lobby/${code}`);
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการสร้างห้อง: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, nickname, avatarEmoji, avatarColor, setUserNickname, navigate]);

  const handleJoinRoom = useCallback(async (roomCode: string) => {
    if (isSubmitting) return;
    const trimmedName = nickname.trim();
    if (!trimmedName) { setError('ใส่ชื่อเล่นก่อนเข้าห้องนะ!'); return; }
    if (!validateNickname(trimmedName)) return;
    if (!rateLimitJoinRoom()) { setError('เข้าห้องบ่อยเกินไป รอสักครู่นะ'); return; }
    
    setIsSubmitting(true);
    try {
      await authReady;
      const currentUser = auth.currentUser;
      if (!currentUser) { setError('ยังไม่ได้เข้าสู่ระบบ — ลองรีเฟรช'); return; }
      
      const uid = currentUser.uid;
      const snap = await get(ref(db, `rooms/${roomCode}`));
      if (!snap.exists()) { setError('ห้องนี้ไม่อยู่แล้ว'); return; }
      
      const data = snap.val();
      if (data.status !== 'waiting') { setError('ห้องนี้เริ่มเล่นไปแล้ว'); return; }
      
      const currentPlayers = data.players ? Object.keys(data.players).length : 0;
      const maxLimit = data.currentGame === 'werewolf_physical' ? 100 : 50;
      if (currentPlayers >= maxLimit) { setError(`ห้องเต็มแล้ว (สูงสุด ${maxLimit} คน)`); return; }
      if (data.players?.[trimmedName]) { setError('ชื่อนี้มีคนใช้แล้วในห้องนี้'); return; }
      
      const now = Date.now();
      await set(ref(db, `rooms/${roomCode}/players/${trimmedName}`), {
        name: trimmedName, isHost: false, joinedAt: now,
        avatar: avatarEmoji, avatarColor: avatarColor, uid,
      });
      
      localStorage.setItem('nickname', trimmedName);
      setUserNickname(trimmedName);
      localStorage.setItem('isHost', 'false');
      saveSession(roomCode, trimmedName);
      navigate(`/lobby/${roomCode}`);
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการเข้าห้อง: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, nickname, avatarEmoji, avatarColor, setUserNickname, navigate]);

  const waitingRooms = rooms.filter(r => r.status === 'waiting');
  const playingRooms = rooms.filter(r => r.status === 'playing');

  return (
    <div className="flex flex-col flex-1 animate-fade-in">
      <AnimatePresence>
        {kickedToast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-[13px] font-bold"
          >
            <span>🚪</span> คุณถูกเตะออกจากห้อง
          </motion.div>
        )}
      </AnimatePresence>

      <header className="relative pt-5 pb-6 mb-2">
        <div className="absolute top-4 right-0 flex items-center gap-2">
          <SoundToggle />
          <ThemeToggle />
          <button
            onClick={() => setShowQR(true)}
            className="w-11 h-11 rounded-2xl bg-white border-2 border-sage-100 flex-center text-olive-400 active:scale-95 shadow-sm transition-transform"
          >
            <QrCode size={18} />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <div className="relative mb-3">
            <div className="w-16 h-16 rounded-[22px] bg-gradient-to-br from-sage-200 to-sage-100 flex-center shadow-sm overflow-hidden pixel-logo-frame">
              <img src="./favicon.svg" alt="Party Hub" className="w-12 h-12" style={{ imageRendering: 'pixelated' }} />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-warm-200 flex-center animate-pixel-sparkle">
              <Sparkles size={10} className="text-warm-500" />
            </div>
          </div>
          <h1 className="font-display text-[22px] font-bold text-olive-800" style={{ letterSpacing: '0.5px' }}>Party Hub</h1>
          <p className="text-olive-400 text-[13px] mt-0.5" style={{ fontFamily: "'Mali', sans-serif", fontWeight: 600, letterSpacing: '0.3px' }}>รวมเกมปาร์ตี้ เล่นกับเพื่อนได้เลย</p>
        </div>
      </header>

      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 flex-center p-6"
            style={{ background: 'rgba(47,42,34,0.4)' }}
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
              transition={{ duration: 0.15 }}
              className="card p-6 w-full max-w-[280px] flex flex-col items-center gap-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex-between w-full">
                <span className="font-display font-bold text-olive-700 text-sm">แชร์ให้เพื่อน</span>
                <button onClick={() => setShowQR(false)} className="w-8 h-8 rounded-xl bg-olive-50 flex-center text-olive-400 active:bg-olive-100">
                  <X size={15} />
                </button>
              </div>
              <div className="p-4 bg-white rounded-2xl border-2 border-sage-100">
                <QRCodeSVG value={"https://phoorinsinthong.github.io/partyhub/"} size={180} level="M" bgColor="#ffffff" fgColor="#2f2a22" />
              </div>
              <div className="text-center">
                <p className="text-xs text-olive-500 font-semibold">สแกนเพื่อเข้าเว็บ</p>
                <p className="text-[10px] text-olive-300 mt-0.5 font-mono">{"https://phoorinsinthong.github.io/partyhub/"}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReconnectBanner />

      <section className="card p-5 mb-4">
        <label className="text-[11px] font-bold text-olive-400 uppercase tracking-wider mb-2 block">
          โปรไฟล์ของคุณ
        </label>

        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            className="relative shrink-0 group"
          >
            <motion.div
              whileTap={{ scale: 0.9 }}
              className={`w-14 h-14 rounded-[20px] flex-center text-2xl shadow-md border-[3px] border-white/80 transition-shadow group-active:shadow-sm ${
                avatarFrame === 'neon' ? 'ring-2 ring-purple-400 ring-offset-1' : ''
              } ${avatarFrame === 'star' ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`}
              style={{ background: avatarGradient || avatarColor }}
            >
              {avatarEmoji}
            </motion.div>
            {avatarFrame === 'crown' && (
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs animate-bounce-soft">
                👑
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white shadow-sm border-2 border-olive-100 flex-center">
              <span className="text-[8px]">✏️</span>
            </div>
          </button>

          <div className="flex-1">
            <input
              type="text"
              className="input-field"
              placeholder="พิมพ์ชื่อเล่นของคุณ..."
              value={nickname}
              onChange={(e) => { setNickname(e.target.value); setError(''); }}
              enterKeyHint="done"
              autoComplete="nickname"
            />
          </div>
        </div>

        <AnimatePresence>
          {showAvatarPicker && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t-2 border-olive-50">
                <AvatarPicker
                  onSelect={handleAvatarSelect}
                  currentEmoji={avatarEmoji}
                  currentColor={avatarColor}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.12 }}
            className="mb-3 overflow-hidden"
          >
            <div className="p-3.5 bg-red-50 border-2 border-red-100 rounded-2xl flex items-center gap-3">
              <span className="text-lg shrink-0">😅</span>
              <p className="text-red-600 text-[13px] font-bold">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="flex-1 flex flex-col min-h-0 mb-4">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Users size={14} className="text-sage-400" />
          <span className="font-bold text-[13px] text-olive-600">ห้องที่เปิดอยู่</span>
          {waitingRooms.length > 0 && (
            <span className="ml-auto text-[10px] font-bold text-sage-600 bg-sage-100 px-2.5 py-1 rounded-full">
              {waitingRooms.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="card flex-1 flex-center flex-col gap-3 min-h-[100px]">
            <div className="w-7 h-7 border-[3px] border-sage-200 border-t-sage-500 rounded-full animate-spin"></div>
            <p className="text-olive-400 text-[13px]">กำลังโหลด...</p>
          </div>
        ) : waitingRooms.length === 0 && playingRooms.length === 0 ? (
          <div className="card flex-1 flex-center flex-col gap-3 min-h-[100px] p-6">
            <span className="text-4xl animate-bounce-soft">🏡</span>
            <p className="font-bold text-olive-400 text-[13px] text-center leading-relaxed">
              ยังไม่มีห้อง — สร้างใหม่เลย!
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2.5 min-h-0 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            {waitingRooms.map((room) => {
              const playerEntries = room.players
                ? Object.entries(room.players).map(([key, val]: [string, any]) => ({ ...val, name: val.name || key }))
                : [];
              return (
                <div key={room.code} className="card p-4 active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sage-100 to-olive-100 flex-center shrink-0 shadow-sm">
                      <span className="text-xl">🎲</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-[16px] text-sage-700 tracking-wider">{room.code}</span>
                        <span className="text-[9px] font-extrabold bg-sage-100 text-sage-600 px-2 py-0.5 rounded-full uppercase">
                          open
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex items-center -space-x-1.5">
                          {playerEntries.slice(0, 4).map((p, idx) => (
                            <div
                              key={idx}
                              className="w-5 h-5 rounded-full flex-center text-[9px] border-[1.5px] border-white"
                              style={{ backgroundColor: p.avatarColor || getAvatarColor(p.name), zIndex: 4 - idx }}
                            >
                              {p.avatar || p.name.charAt(0)}
                            </div>
                          ))}
                          {playerEntries.length > 4 && (
                            <div className="w-5 h-5 rounded-full flex-center text-[8px] font-bold bg-olive-100 text-olive-500 border-[1.5px] border-white">
                              +{playerEntries.length - 4}
                            </div>
                          )}
                        </div>
                        <span className="text-olive-200 text-[10px]">•</span>
                        <Crown size={10} className="text-warm-400" />
                        <span className="text-[12px] text-olive-500 font-semibold truncate">{room.host}</span>
                        <span className="text-olive-200 text-[10px]">•</span>
                        <span className="text-[11px] text-olive-400 font-semibold">{room.playerCount} คน</span>
                      </div>
                    </div>

                    <button
                      className="btn btn-primary py-2.5 px-4 text-[13px] min-h-[46px] shrink-0"
                      onClick={() => handleJoinRoom(room.code)}
                      disabled={isSubmitting}
                    >
                      <UserPlus size={14} strokeWidth={2.5} />
                      {isSubmitting ? '...' : 'เข้า'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="pt-1 pb-2 space-y-2">
        <button
          className="btn btn-primary w-full py-4 text-[17px]"
          onClick={handleCreateRoom}
          disabled={isSubmitting}
        >
          <Plus size={20} strokeWidth={2.5} />
          {isSubmitting ? 'กำลังสร้าง...' : 'สร้างห้องใหม่'}
        </button>

        <button
          className="w-full py-3 px-4 rounded-2xl bg-purple-900/30 border-2 border-purple-500/40 hover:bg-purple-900/40 text-purple-300 font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          onClick={() => navigate('/werewolf-moderator')}
        >
          <span className="text-base">🎭</span>
          ผู้บรรยาย Werewolf (การ์ดจริง GM)
        </button>
      </section>

      <footer className="flex-center gap-2 pt-3 pb-1 opacity-40">
        <span className="text-xs">🍺</span><span className="text-xs">🕵️‍♂️</span><span className="text-xs">🎯</span><span className="text-xs">🐺</span><span className="text-xs">🎭</span><span className="text-xs">🧠</span><span className="text-xs">🎨</span><span className="text-xs">⚖️</span><span className="text-xs">💣</span><span className="text-xs">🙋</span><span className="text-xs">🤫</span><span className="text-xs">🔢</span><span className="text-xs">🕵️</span>
      </footer>
    </div>
  );
};

export default Home;

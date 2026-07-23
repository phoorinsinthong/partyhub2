// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, UserPlus, QrCode, X, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import { ref, set, get } from 'firebase/database';
import { db, auth, authReady } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import AvatarPicker from '../components/AvatarPicker';
import ThemeToggle from '../components/ThemeToggle';
import SoundToggle from '../components/SoundToggle';
import ReconnectBanner, { saveSession } from '../components/ReconnectBanner';
import OtpInput from '../components/OtpInput';
import { loadAvatar, generateRandomSeed, getRandomGradient, saveAvatar, getAvatarUrl } from '../utils/avatars';
import { rateLimitCreateRoom, rateLimitJoinRoom } from '../utils/rateLimit';
import { useGame } from '../contexts/GameContext';
import { useHaptics } from '../hooks/useHaptics';

type Step = 'setup' | 'action' | 'join';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { vibrateLight, vibrateMedium, vibrateHeavy } = useHaptics();
  
  const [step, setStep] = useState<Step>('setup');
  const [nickname, setNickname] = useState(() => localStorage.getItem('nickname') || '');
  const [error, setError] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { setUserNickname } = useGame();

  const [avatarSeed, setAvatarSeed] = useState(() => loadAvatar().seed || generateRandomSeed());
  const [avatarGradient, setAvatarGradient] = useState(() => loadAvatar().gradient || getRandomGradient());

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
    saveAvatar(avatarSeed, avatarGradient);
  }, [avatarSeed, avatarGradient]);

  const handleAvatarSelect = (seed: string, gradient: string) => {
    setAvatarSeed(seed);
    setAvatarGradient(gradient);
  };

  const validateNickname = (name: string) => {
    if (/[.#$[\]/]/.test(name)) {
      setError('ชื่อห้ามมีอักขระ . # $ [ ] /');
      vibrateHeavy();
      return false;
    }
    return true;
  };

  const proceedToAction = () => {
    const trimmedName = nickname.trim();
    if (!trimmedName) {
      setError('โปรดใส่ชื่อเล่นก่อนนะ!');
      vibrateHeavy();
      return;
    }
    if (!validateNickname(trimmedName)) return;
    
    setError('');
    vibrateLight();
    localStorage.setItem('nickname', trimmedName);
    setUserNickname(trimmedName);
    setStep('action');
  };

  const handleCreateRoom = useCallback(async () => {
    if (isSubmitting) return;
    if (!rateLimitCreateRoom()) { setError('สร้างห้องบ่อยเกินไป รอสักครู่นะ'); vibrateHeavy(); return; }
    
    setIsSubmitting(true);
    vibrateMedium();
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
        host: nickname, status: 'waiting', createdAt: now, currentGame: null,
        players: { [nickname]: {
          name: nickname, isHost: true, joinedAt: now,
          avatar: avatarSeed, avatarColor: avatarGradient, uid,
        } }
      });
      
      localStorage.setItem('isHost', 'true');
      saveSession(code, nickname);
      vibrateMedium();
      navigate(`/lobby/${code}`);
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการสร้างห้อง: ' + (err.message || ''));
      vibrateHeavy();
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, nickname, avatarSeed, avatarGradient, navigate, vibrateMedium, vibrateHeavy]);

  const handleJoinRoom = useCallback(async (roomCode: string) => {
    if (isSubmitting) return;
    if (!rateLimitJoinRoom()) { setError('เข้าห้องบ่อยเกินไป รอสักครู่นะ'); vibrateHeavy(); return; }
    
    setIsSubmitting(true);
    vibrateMedium();
    try {
      await authReady;
      const currentUser = auth.currentUser;
      if (!currentUser) { setError('ยังไม่ได้เข้าสู่ระบบ — ลองรีเฟรช'); return; }
      
      const uid = currentUser.uid;
      const snap = await get(ref(db, `rooms/${roomCode}`));
      if (!snap.exists()) { setError('ไม่พบห้องนี้ (รหัสผิดหรือปิดไปแล้ว)'); vibrateHeavy(); return; }
      
      const data = snap.val();
      if (data.status !== 'waiting') { setError('ห้องนี้เริ่มเล่นไปแล้ว'); vibrateHeavy(); return; }
      
      const currentPlayers = data.players ? Object.keys(data.players).length : 0;
      const maxLimit = data.currentGame === 'werewolf_physical' ? 100 : 50;
      if (currentPlayers >= maxLimit) { setError(`ห้องเต็มแล้ว (สูงสุด ${maxLimit} คน)`); vibrateHeavy(); return; }
      if (data.players?.[nickname]) { setError('ชื่อนี้มีคนใช้แล้วในห้องนี้'); vibrateHeavy(); return; }
      
      const now = Date.now();
      await set(ref(db, `rooms/${roomCode}/players/${nickname}`), {
        name: nickname, isHost: false, joinedAt: now,
        avatar: avatarSeed, avatarColor: avatarGradient, uid,
      });
      
      localStorage.setItem('isHost', 'false');
      saveSession(roomCode, nickname);
      vibrateMedium();
      navigate(`/lobby/${roomCode}`);
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการเข้าห้อง: ' + (err.message || ''));
      vibrateHeavy();
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, nickname, avatarSeed, avatarGradient, navigate, vibrateMedium, vibrateHeavy]);

  return (
    <div className="flex flex-col flex-1 animate-fade-in relative z-10 p-2">
      <AnimatePresence>
        {kickedToast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center gap-2.5 text-[13px] font-bold border border-red-400"
          >
            <span>🚪</span> คุณถูกเตะออกจากห้อง
          </motion.div>
        )}
      </AnimatePresence>

      <header className="relative pt-4 pb-4 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex-center shadow-[0_0_15px_rgba(0,240,255,0.3)] border border-neon-blue/50 overflow-hidden pixel-logo-frame">
              <img src="./favicon.svg" alt="Party Hub" className="w-8 h-8" style={{ imageRendering: 'pixelated' }} />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-900 border border-neon-pink flex-center animate-pulse">
              <Sparkles size={8} className="text-neon-pink" />
            </div>
          </div>
          <div>
            <h1 className="font-display text-[18px] font-black text-white tracking-wider uppercase">Party Hub</h1>
            <p className="text-neon-blue text-[11px] font-bold tracking-widest uppercase">Neon Edition</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SoundToggle />
          <ThemeToggle />
          <button
            onClick={() => { vibrateLight(); setShowQR(true); }}
            className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex-center text-slate-300 hover:text-white active:scale-95 shadow-sm transition-transform"
          >
            <QrCode size={18} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[100] flex-center p-6 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              className="glass-panel p-6 w-full max-w-[280px] flex flex-col items-center gap-5 relative border-neon-blue/50 shadow-neon-blue"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex-between w-full">
                <span className="font-display font-black text-white text-sm tracking-widest uppercase">Share Hub</span>
                <button onClick={() => setShowQR(false)} className="w-8 h-8 rounded-xl bg-slate-800 flex-center text-slate-400 hover:text-white transition-colors">
                  <X size={15} />
                </button>
              </div>
              <div className="p-4 bg-white rounded-2xl border-4 border-slate-800 shadow-xl">
                <QRCodeSVG value={"https://phoorinsinthong.github.io/partyhub/"} size={180} level="M" bgColor="#ffffff" fgColor="#0f172a" />
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-300 font-semibold mb-1">สแกนเพื่อเข้าเว็บ</p>
                <p className="text-[10px] text-neon-blue font-mono opacity-80">{"https://phoorinsinthong.github.io/partyhub/"}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReconnectBanner />

      <AnimatePresence mode="wait">
        {/* STEP 1: SETUP PROFILE */}
        {step === 'setup' && (
          <motion.section
            key="step-setup"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col pb-4"
          >
            <div className="glass-panel p-5 mb-4 flex-1 flex flex-col">
              <div className="text-center mb-6">
                <h2 className="font-display font-black text-2xl text-white tracking-widest uppercase mb-1">Create Profile</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">ออกแบบตัวละครของคุณ</p>
              </div>

              <div className="mb-6 flex flex-col items-center">
                <div className="w-full max-w-[240px]">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block text-center">
                    1. ชื่อเล่น (Nickname)
                  </label>
                  <input
                    type="text"
                    className="input-field text-center text-xl font-bold bg-slate-900 border-2 border-slate-700 h-14 focus:border-neon-pink focus:shadow-neon-pink transition-all"
                    placeholder="ใส่ชื่อ..."
                    value={nickname}
                    onChange={(e) => { setNickname(e.target.value); setError(''); }}
                    enterKeyHint="done"
                    autoComplete="nickname"
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block text-center">
                  2. ปรับแต่ง Pixel Avatar
                </label>
                <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-700/50 shadow-inner">
                  <AvatarPicker
                    onSelect={handleAvatarSelect}
                    currentSeed={avatarSeed}
                    currentGradient={avatarGradient}
                  />
                </div>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden"
                >
                  <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-2xl flex items-center justify-center gap-3">
                    <span className="text-lg shrink-0">⚠️</span>
                    <p className="text-red-400 text-[13px] font-bold text-center">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              className="btn btn-primary py-4 text-[16px] shadow-neon-blue mt-auto"
              onClick={proceedToAction}
            >
              เข้าสู่ระบบ <ArrowRight size={18} />
            </button>
          </motion.section>
        )}

        {/* STEP 2: ACTION (CREATE OR JOIN) */}
        {step === 'action' && (
          <motion.section
            key="step-action"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col justify-center gap-4 py-8"
          >
            <div className="flex items-center gap-4 mb-8 justify-center">
              <div className="relative">
                <div 
                  className="w-16 h-16 rounded-[20px] shadow-md border-2 border-white/20 flex items-center justify-center overflow-hidden"
                  style={{ background: avatarGradient }}
                >
                  <img src={getAvatarUrl(avatarSeed)} alt="Avatar" className="w-[120%] h-[120%] object-cover mt-[20%]" style={{ imageRendering: 'pixelated' }} />
                </div>
                <button
                  onClick={() => { vibrateLight(); setStep('setup'); }}
                  className="absolute -bottom-2 -right-2 bg-slate-800 text-white rounded-full p-1.5 shadow-lg border border-slate-600 hover:bg-slate-700 transition-colors"
                >
                  <ArrowLeft size={14} />
                </button>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">ยินดีต้อนรับ</p>
                <h2 className="font-display font-black text-2xl text-white truncate max-w-[150px]">{nickname}</h2>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden"
                >
                  <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-2xl flex items-center gap-3">
                    <span className="text-lg shrink-0">⚠️</span>
                    <p className="text-red-400 text-[13px] font-bold">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="glass-panel p-6 flex flex-col gap-4 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/5 to-transparent pointer-events-none"></div>
              <h3 className="font-display font-black text-lg text-white tracking-widest uppercase text-center mb-2 relative z-10">Select Mode</h3>
              
              <button
                className="btn btn-primary py-5 text-[16px] shadow-neon-blue relative z-10"
                onClick={handleCreateRoom}
                disabled={isSubmitting}
              >
                <Plus size={20} strokeWidth={2.5} />
                {isSubmitting ? 'กำลังสร้าง...' : 'สร้างห้องใหม่ (Create)'}
              </button>

              <div className="flex items-center gap-3 my-2 relative z-10">
                <div className="h-[1px] flex-1 bg-slate-700"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">OR</span>
                <div className="h-[1px] flex-1 bg-slate-700"></div>
              </div>

              <button
                className="btn py-5 text-[16px] bg-slate-800 border-2 border-slate-600 text-white hover:border-neon-pink hover:bg-slate-700 transition-all shadow-lg active:scale-95 relative z-10 font-bold flex items-center justify-center gap-2"
                onClick={() => { vibrateLight(); setStep('join'); setError(''); }}
              >
                <UserPlus size={20} strokeWidth={2.5} />
                เข้าร่วมห้อง (Join)
              </button>
            </div>

            <button
              className="mt-6 py-4 px-4 rounded-2xl bg-purple-900/20 border border-purple-500/30 hover:bg-purple-900/40 hover:border-purple-500/60 text-purple-300 font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg"
              onClick={() => { vibrateLight(); navigate('/werewolf-moderator'); }}
            >
              <span className="text-base">🎭</span>
              ระบบผู้บรรยาย Werewolf (GM)
            </button>
          </motion.section>
        )}

        {/* STEP 3: JOIN (ENTER OTP) */}
        {step === 'join' && (
          <motion.section
            key="step-join"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col pt-12"
          >
            <button
              onClick={() => { vibrateLight(); setStep('action'); setError(''); }}
              className="flex items-center gap-2 text-slate-400 font-bold text-[13px] hover:text-white transition-colors mb-8 w-fit"
            >
              <ArrowLeft size={16} /> ย้อนกลับ
            </button>

            <div className="glass-panel p-8 text-center border-neon-pink/30 shadow-neon-pink relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-neon-pink/10 to-transparent pointer-events-none"></div>
              
              <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-neon-pink flex-center mx-auto mb-6 shadow-neon-pink">
                <UserPlus size={28} className="text-neon-pink" />
              </div>
              
              <h2 className="font-display font-black text-2xl text-white tracking-widest uppercase mb-2">Join Room</h2>
              <p className="text-slate-400 text-sm font-medium mb-8">กรอกรหัสห้อง 4 หลักจากหน้าจอโฮสต์</p>

              <OtpInput 
                length={4} 
                onComplete={handleJoinRoom} 
                disabled={isSubmitting} 
              />

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="mt-6 overflow-hidden"
                  >
                    <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-2xl flex items-center justify-center gap-3">
                      <span className="text-lg shrink-0">⚠️</span>
                      <p className="text-red-400 text-[13px] font-bold">{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {isSubmitting && (
                <div className="mt-6 text-neon-pink text-sm font-bold animate-pulse">
                  กำลังเข้าร่วมห้อง...
                </div>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <footer className="flex-center gap-2 py-4 opacity-30 pointer-events-none mt-auto">
        <span className="text-[10px]">👾</span><span className="text-[10px]">⚡</span><span className="text-[10px]">🎮</span><span className="text-[10px]">🌌</span>
      </footer>
    </div>
  );
};

export default Home;

// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';
import { GAME_NAMES } from '../utils/gameData';
import { useGame } from '../contexts/GameContext';

const SESSION_KEY = 'partyhub_session';

export function saveSession(roomId, nickname) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, nickname, timestamp: Date.now() }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

const ReconnectBanner = () => {
  const [session, setSession] = useState<any>(null);
  const [roomMeta, setRoomMeta] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUserNickname } = useGame();

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      const age = Date.now() - data.timestamp;
      if (age > 2 * 60 * 60 * 1000) {
        clearSession();
        return;
      }

      get(ref(db, `rooms/${data.roomId}`)).then((snap) => {
        if (snap.exists()) {
          const room = snap.val();
          if (room.players?.[data.nickname]) {
            setSession(data);
            setRoomMeta({
              gameName: GAME_NAMES[room.currentGame] || null,
              playerCount: room.players ? Object.keys(room.players).length : 0,
            });
            setVisible(true);
          } else {
            clearSession();
          }
        } else {
          clearSession();
        }
      });
    } catch {
      clearSession();
    }
  }, []);

  const handleReconnect = async () => {
    if (!session) return;
    setLoading(true);
    const snap = await get(ref(db, `rooms/${session.roomId}`));
    if (!snap.exists()) {
      clearSession();
      setVisible(false);
      return;
    }
    const room = snap.val();
    localStorage.setItem('nickname', session.nickname);
    setUserNickname(session.nickname);
    if (room.status === 'playing' || room.status === 'finished') {
      navigate(`/game/${session.roomId}`);
    } else {
      navigate(`/lobby/${session.roomId}`);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    clearSession();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          transition={{ duration: 0.2 }}
          className="mb-3 overflow-hidden"
        >
          <div className="card p-4 border-2 border-sage-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sage-100 flex-center shrink-0">
                <RotateCcw size={18} className="text-sage-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-olive-700">คุณเคยอยู่ในห้อง</p>
                <p className="text-[15px] font-black text-sage-600 tracking-wider font-display">{session?.roomId}</p>
                {roomMeta && (
                  <p className="text-[11px] text-olive-400 font-semibold mt-0.5">
                    {[roomMeta.gameName, roomMeta.playerCount ? `${roomMeta.playerCount} คน` : null].filter(Boolean).join(' • ')}
                  </p>
                )}
              </div>
              <button
                onClick={handleDismiss}
                className="w-8 h-8 rounded-xl bg-olive-50 flex-center text-olive-300 active:bg-olive-100 shrink-0"
              >
                <X size={14} />
              </button>
            </div>
            <button
              onClick={handleReconnect}
              disabled={loading}
              className="btn btn-primary w-full mt-3 py-3 text-[14px]"
            >
              <RotateCcw size={15} className={loading ? 'animate-spin' : ''} />
              {loading ? 'กำลังเชื่อมต่อ...' : 'กลับเข้าห้อง'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReconnectBanner;

import { useState, useCallback } from 'react';
import { ref, remove } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { clearSession } from '../components/ReconnectBanner';

export function useGameLeave(roomId, userNickname) {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const requestLeave = useCallback(() => setShowConfirm(true), []);

  const confirmLeave = useCallback(async () => {
    setShowConfirm(false);
    clearSession();
    await remove(ref(db, `rooms/${roomId}/players/${userNickname}`));
    navigate('/');
  }, [roomId, userNickname, navigate]);

  const cancelLeave = useCallback(() => setShowConfirm(false), []);

  return { requestLeave, confirmLeave, cancelLeave, showConfirm };
}

import { useState, useCallback } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { useTranslation } from 'react-i18next';

export const useGameUpdate = (roomId: string | null) => {
  const { t } = useTranslation();
  const [errorMsg, setErrorMsg] = useState('');

  const safeUpdate = useCallback(async (updates: any, customRefPath?: string) => {
    if (!roomId) return;
    try {
      const targetRef = customRefPath ? ref(db, customRefPath) : ref(db, `rooms/${roomId}/gameData`);
      await update(targetRef, updates);
    } catch (error) {
      console.error("Game update failed", error);
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  }, [roomId, t]);

  const clearError = useCallback(() => setErrorMsg(''), []);

  return { safeUpdate, errorMsg, setErrorMsg, clearError };
};

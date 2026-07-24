import { useState, useCallback } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { useTranslation } from 'react-i18next';

export const useGameUpdate = (roomId: string | null) => {
  const { t } = useTranslation();
  const [errorMsg, setErrorMsg] = useState('');

  const safeUpdate = useCallback(async (arg1: any, arg2?: any) => {
    if (!roomId) return;
    try {
      let targetRef;
      let updatesObj;

      if (typeof arg1 === 'string') {
        // Called as safeUpdate('rooms/XYZ/path', { foo: 'bar' })
        targetRef = ref(db, arg1);
        updatesObj = arg2;
      } else if (typeof arg2 === 'string') {
        // Called as safeUpdate({ foo: 'bar' }, 'rooms/XYZ/path')
        targetRef = ref(db, arg2);
        updatesObj = arg1;
      } else {
        // Called as safeUpdate({ foo: 'bar' })
        targetRef = ref(db, `rooms/${roomId}/gameData`);
        updatesObj = arg1;
      }

      if (updatesObj && typeof updatesObj === 'object') {
        await update(targetRef, updatesObj);
      }
    } catch (error) {
      console.error("Game update failed", error);
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  }, [roomId, t]);

  const clearError = useCallback(() => setErrorMsg(''), []);

  return { safeUpdate, errorMsg, setErrorMsg, clearError };
};

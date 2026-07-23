import { useCallback } from 'react';

/**
 * Hook สำหรับจัดการ Haptic Feedback (การสั่นของมือถือ)
 * ช่วยเพิ่ม Immersive UX ในเกม
 */
export function useHaptics() {
  // สั่นเบาๆ (Tap/Click)
  const vibrateLight = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);

  // สั่นระดับกลาง (Warning/Alert)
  const vibrateMedium = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([20, 50, 20]);
    }
  }, []);

  // สั่นแรงตู้มต้าม! (Epic Popup / Error)
  const vibrateHeavy = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 100, 100, 50, 150]);
    }
  }, []);

  // สั่นเหมือนหัวใจเต้น (ลุ้นระทึก)
  const vibrateHeartbeat = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 200, 50, 600]);
    }
  }, []);

  return {
    vibrateLight,
    vibrateMedium,
    vibrateHeavy,
    vibrateHeartbeat,
  };
}

// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Zap } from 'lucide-react';
import { useHaptics } from '../../hooks/useHaptics';

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const { vibrateHeavy, vibrateMedium } = useHaptics();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      vibrateMedium();
      setTimeout(() => setShowReconnected(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
      vibrateHeavy();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [vibrateHeavy, vibrateMedium]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-body)',
          }}
          className="neon-error-bg"
        >
          <div className="flex flex-col items-center animate-neon-flicker">
            <WifiOff size={80} className="text-danger mb-6" strokeWidth={1.5} />
            <h1 className="font-display font-black text-4xl text-danger tracking-widest uppercase text-center">
              Connection<br/>Lost
            </h1>
            <p className="mt-4 text-white/70 font-body text-center max-w-[250px] font-medium">
              ไฟตก! สัญญาณขาดหาย<br/>กรุณาตรวจสอบอินเทอร์เน็ตของคุณ
            </p>
          </div>
        </motion.div>
      )}

      {showReconnected && isOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 24px',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '2px solid var(--neon-green)',
            borderRadius: '20px',
            color: '#fff',
            fontFamily: "'Prompt', sans-serif",
            fontWeight: 700,
            fontSize: '14px',
            boxShadow: '0 0 20px rgba(57, 255, 20, 0.4), inset 0 0 10px rgba(57, 255, 20, 0.2)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Zap size={18} className="text-success" />
          ไฟมาแล้ว! ออนไลน์สำเร็จ
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineIndicator;

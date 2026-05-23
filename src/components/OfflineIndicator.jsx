import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            paddingTop: 'max(10px, env(safe-area-inset-top))',
            background: 'linear-gradient(135deg, #d45b5b 0%, #b94444 100%)',
            color: 'white',
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 700,
            fontSize: '13px',
            boxShadow: '0 4px 20px rgba(180,68,68,0.3)',
          }}
        >
          <WifiOff size={16} />
          <span>ไม่มีสัญญาณอินเทอร์เน็ต</span>
        </motion.div>
      )}

      {showReconnected && isOnline && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            paddingTop: 'max(10px, env(safe-area-inset-top))',
            background: 'linear-gradient(135deg, #5f8252 0%, #4d7a3f 100%)',
            color: 'white',
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 700,
            fontSize: '13px',
            boxShadow: '0 4px 20px rgba(77,122,63,0.3)',
          }}
        >
          กลับมาออนไลน์แล้ว!
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineIndicator;

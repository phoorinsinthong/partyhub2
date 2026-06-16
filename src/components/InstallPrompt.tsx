import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => 
    window.matchMedia('(display-mode: standalone)').matches
  );

  useEffect(() => {
    if (isInstalled) return;

    // Check if user previously dismissed
    const dismissed = localStorage.getItem('pwa-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait a bit before showing to not interrupt initial experience
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Detect when app is installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-dismissed', Date.now().toString());
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9998,
          padding: '16px',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <div
          style={{
            maxWidth: '460px',
            margin: '0 auto',
            background: '#fff',
            borderRadius: '20px',
            padding: '16px',
            boxShadow: '0 -4px 30px rgba(50,60,30,0.12), 0 0 0 1px rgba(50,60,30,0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #6a9e5a, #4d7a3f)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Download size={22} color="white" />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontWeight: 800,
              fontSize: '14px',
              color: '#2f2a22',
              fontFamily: "'Nunito', sans-serif",
              marginBottom: '2px',
            }}>
              ติดตั้ง Party Hub
            </p>
            <p style={{
              fontSize: '12px',
              color: '#8a7e6a',
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 600,
            }}>
              เพิ่มลงหน้าจอหลัก เปิดเล่นได้ทันที!
            </p>
          </div>

          {/* Install button */}
          <button
            onClick={handleInstall}
            style={{
              padding: '10px 18px',
              borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(160deg, #6a9e5a, #4d7a3f)',
              color: 'white',
              fontWeight: 800,
              fontSize: '13px',
              fontFamily: "'Nunito', sans-serif",
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 3px 0 #3d6333',
            }}
          >
            ติดตั้ง
          </button>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '10px',
              border: 'none',
              background: '#f4f5ee',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              color: '#8a7e6a',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InstallPrompt;

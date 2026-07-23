import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWerewolf } from './WerewolfContext';

export const StarsBackground: React.FC = () => {
  const [stars, setStars] = useState<{ id: number; left: string; top: string; delay: number; duration: number }[]>([]);
  useEffect(() => {
    const newStars = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 3
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStars(newStars);
  }, []);
  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-slate-950">
      {stars.map(star => (
        <motion.div
          key={star.id}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{ left: star.left, top: star.top }}
          animate={{ opacity: [0.1, 0.8, 0.1], scale: [1, 1.5, 1] }}
          transition={{ duration: star.duration, repeat: Infinity, delay: star.delay }}
        />
      ))}
    </div>
  );
};

export const AmbientMist: React.FC = () => {
  const { phase } = useWerewolf();
  if (phase !== 'night' && phase !== 'waiting' && phase !== 'result') return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden opacity-30 mix-blend-screen">
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/40 via-transparent to-transparent blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-purple-900/30 via-transparent to-transparent blur-3xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
    </div>
  );
};

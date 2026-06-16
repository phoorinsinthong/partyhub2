import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AVATARS, AVATAR_COLORS, saveAvatar, loadAvatar } from '../utils/avatars';
import { Shuffle, Check } from 'lucide-react';

const AvatarPicker = ({ onSelect, currentEmoji, currentColor }) => {
  const [tab, setTab] = useState('emoji'); // 'emoji' | 'color'
  const [selectedEmoji, setSelectedEmoji] = useState(currentEmoji || '🐱');
  const [selectedColor, setSelectedColor] = useState(currentColor || AVATAR_COLORS[0]);

  const handleConfirm = () => {
    saveAvatar(selectedEmoji, selectedColor);
    onSelect(selectedEmoji, selectedColor);
  };

  const handleRandom = () => {
    const randEmoji = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const randColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    setSelectedEmoji(randEmoji);
    setSelectedColor(randColor);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Preview */}
      <div className="flex-center">
        <motion.div
          key={selectedEmoji + selectedColor}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="w-20 h-20 rounded-[28px] flex-center text-4xl shadow-lg border-[3px] border-white/80"
          style={{ backgroundColor: selectedColor }}
        >
          {selectedEmoji}
        </motion.div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-olive-50 rounded-2xl p-1 gap-1">
        <button
          className={`flex-1 py-2 rounded-xl text-[12px] font-extrabold transition-all ${
            tab === 'emoji'
              ? 'bg-white text-olive-700 shadow-sm'
              : 'text-olive-400'
          }`}
          onClick={() => setTab('emoji')}
        >
          😊 อีโมจิ
        </button>
        <button
          className={`flex-1 py-2 rounded-xl text-[12px] font-extrabold transition-all ${
            tab === 'color'
              ? 'bg-white text-olive-700 shadow-sm'
              : 'text-olive-400'
          }`}
          onClick={() => setTab('color')}
        >
          🎨 สีพื้นหลัง
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === 'emoji' ? (
          <motion.div
            key="emoji"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-8 gap-1.5 max-h-[180px] overflow-y-auto p-1"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {AVATARS.map((emoji) => (
              <button
                key={emoji}
                className={`w-full aspect-square rounded-xl flex-center text-xl transition-all active:scale-90 ${
                  selectedEmoji === emoji
                    ? 'bg-sage-100 border-2 border-sage-400 shadow-sm scale-110'
                    : 'bg-olive-50/60 border-2 border-transparent hover:bg-olive-50'
                }`}
                onClick={() => setSelectedEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="color"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-6 gap-2 p-1"
          >
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                className={`w-full aspect-square rounded-2xl transition-all active:scale-90 flex-center ${
                  selectedColor === color
                    ? 'ring-[3px] ring-olive-400 ring-offset-2 scale-110'
                    : ''
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
              >
                {selectedColor === color && (
                  <Check size={16} color="white" strokeWidth={3} />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          className="btn btn-outline flex-1 py-2.5 text-[12px] min-h-[44px]"
          onClick={handleRandom}
        >
          <Shuffle size={14} /> สุ่ม
        </button>
        <button
          className="btn btn-primary flex-[2] py-2.5 text-[13px] min-h-[44px]"
          onClick={handleConfirm}
        >
          <Check size={14} /> ใช้อวาตาร์นี้
        </button>
      </div>
    </div>
  );
};

export default AvatarPicker;

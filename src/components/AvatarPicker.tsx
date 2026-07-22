import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AVATARS, AVATAR_COLORS, AVATAR_CATEGORIES, AVATAR_FRAMES, AVATAR_GRADIENTS, 
  saveAvatar, loadAvatar 
} from '../utils/avatars';
import { Shuffle, Check } from 'lucide-react';

interface AvatarPickerProps {
  onSelect: (emoji: string, color: string, frame?: string, gradient?: string) => void;
  currentEmoji?: string;
  currentColor?: string;
  currentFrame?: string;
  currentGradient?: string;
}

const AvatarPicker: React.FC<AvatarPickerProps> = ({ 
  onSelect, 
  currentEmoji, 
  currentColor, 
  currentFrame, 
  currentGradient 
}) => {
  const loaded = loadAvatar();
  const [tab, setTab] = useState<'emoji' | 'color' | 'frame'>('emoji');
  const [category, setCategory] = useState<keyof typeof AVATAR_CATEGORIES>('animals');
  
  const [selectedEmoji, setSelectedEmoji] = useState(currentEmoji || loaded.emoji || '🐱');
  const [selectedColor, setSelectedColor] = useState(currentColor || loaded.color || AVATAR_COLORS[0]);
  const [selectedFrame, setSelectedFrame] = useState(currentFrame || loaded.frame || 'none');
  const [selectedGradient, setSelectedGradient] = useState(currentGradient || loaded.gradient || '');

  const handleConfirm = () => {
    saveAvatar(selectedEmoji, selectedColor, selectedFrame, selectedGradient);
    onSelect(selectedEmoji, selectedColor, selectedFrame, selectedGradient);
  };

  const handleRandom = () => {
    const randEmoji = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const randColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const randFrame = AVATAR_FRAMES[Math.floor(Math.random() * AVATAR_FRAMES.length)].id;
    const useGrad = Math.random() > 0.5;
    const randGrad = useGrad ? AVATAR_GRADIENTS[Math.floor(Math.random() * AVATAR_GRADIENTS.length)] : '';
    
    setSelectedEmoji(randEmoji);
    setSelectedColor(randColor);
    setSelectedFrame(randFrame);
    setSelectedGradient(randGrad);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Live Preview Box */}
      <div className="flex flex-col items-center justify-center py-2">
        <div className="relative">
          <motion.div
            key={selectedEmoji + selectedColor + selectedFrame + selectedGradient}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className={`w-20 h-20 rounded-[28px] flex-center text-4xl shadow-lg border-[3px] border-white/80 transition-all ${
              selectedFrame === 'neon' ? 'ring-4 ring-purple-400 ring-offset-2 animate-pulse' : ''
            } ${selectedFrame === 'star' ? 'ring-4 ring-amber-300 ring-offset-2 shadow-amber-400/40' : ''}`}
            style={{ 
              background: selectedGradient || selectedColor 
            }}
          >
            {selectedEmoji}
          </motion.div>

          {/* Frame Badges */}
          {selectedFrame === 'crown' && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl animate-bounce-soft">
              👑
            </div>
          )}
          {selectedFrame === 'pixel' && (
            <div className="absolute -bottom-1 -right-1 bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white">
              8-BIT
            </div>
          )}
        </div>
        <p className="text-[11px] font-bold text-olive-500 mt-2">พรีวิวโปรไฟล์</p>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex bg-olive-50 rounded-2xl p-1 gap-1">
        <button
          className={`flex-1 py-2 rounded-xl text-[12px] font-extrabold transition-all ${
            tab === 'emoji' ? 'bg-white text-olive-700 shadow-sm' : 'text-olive-400'
          }`}
          onClick={() => setTab('emoji')}
        >
          😊 อีโมจิ
        </button>
        <button
          className={`flex-1 py-2 rounded-xl text-[12px] font-extrabold transition-all ${
            tab === 'color' ? 'bg-white text-olive-700 shadow-sm' : 'text-olive-400'
          }`}
          onClick={() => setTab('color')}
        >
          🎨 สี/การ์เดียนต์
        </button>
        <button
          className={`flex-1 py-2 rounded-xl text-[12px] font-extrabold transition-all ${
            tab === 'frame' ? 'bg-white text-olive-700 shadow-sm' : 'text-olive-400'
          }`}
          onClick={() => setTab('frame')}
        >
          🖼️ กรอบรูป
        </button>
      </div>

      {/* Tab 1: Emoji Categories */}
      {tab === 'emoji' && (
        <div className="space-y-2">
          {/* Category Sub-tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {Object.entries(AVATAR_CATEGORIES).map(([catKey, cat]) => (
              <button
                key={catKey}
                onClick={() => setCategory(catKey as keyof typeof AVATAR_CATEGORIES)}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold shrink-0 flex items-center gap-1 transition-all ${
                  category === catKey 
                    ? 'bg-sage-500 text-white shadow-sm' 
                    : 'bg-olive-50 text-olive-500'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <motion.div
            key={category}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-[160px] overflow-y-auto p-1"
          >
            {AVATAR_CATEGORIES[category].emojis.map((emoji) => (
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
        </div>
      )}

      {/* Tab 2: Solid Colors & Gradients */}
      {tab === 'color' && (
        <motion.div
          key="color"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <div>
            <span className="text-[11px] font-bold text-olive-400 block mb-1.5">สีพาสเทล</span>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-full aspect-square rounded-2xl transition-all active:scale-90 flex-center ${
                    selectedColor === color && !selectedGradient
                      ? 'ring-[3px] ring-olive-400 ring-offset-2 scale-110'
                      : ''
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setSelectedColor(color);
                    setSelectedGradient('');
                  }}
                >
                  {selectedColor === color && !selectedGradient && (
                    <Check size={16} color="white" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-purple-400 block mb-1.5">การ์เดียนต์นีออน</span>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_GRADIENTS.map((grad, idx) => (
                <button
                  key={idx}
                  className={`w-full h-9 rounded-xl transition-all active:scale-90 flex-center ${
                    selectedGradient === grad
                      ? 'ring-[3px] ring-purple-500 ring-offset-2 scale-105'
                      : ''
                  }`}
                  style={{ background: grad }}
                  onClick={() => setSelectedGradient(grad)}
                >
                  {selectedGradient === grad && (
                    <Check size={14} color="white" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab 3: Avatar Frames */}
      {tab === 'frame' && (
        <motion.div
          key="frame"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-3 gap-2"
        >
          {AVATAR_FRAMES.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFrame(f.id)}
              className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all ${
                selectedFrame === f.id
                  ? 'border-purple-500 bg-purple-50 text-purple-700 font-bold shadow-md'
                  : 'border-olive-100 bg-white text-olive-500 hover:border-olive-200'
              }`}
            >
              <span className="text-2xl">{f.icon}</span>
              <span className="text-xs font-semibold">{f.label}</span>
            </button>
          ))}
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t border-olive-100">
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

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  generateRandomSeed, getAvatarUrl, AVATAR_GRADIENTS, getRandomGradient,
  saveAvatar, loadAvatar 
} from '../utils/avatars';
import { Shuffle, Check, Edit3 } from 'lucide-react';
import { useHaptics } from '../hooks/useHaptics';

interface AvatarPickerProps {
  onSelect: (seed: string, gradient: string) => void;
  currentSeed?: string;
  currentGradient?: string;
}

const AvatarPicker: React.FC<AvatarPickerProps> = ({ 
  onSelect, 
  currentSeed, 
  currentGradient 
}) => {
  const loaded = loadAvatar();
  const [tab, setTab] = useState<'avatar' | 'color'>('avatar');
  const { vibrateLight, vibrateMedium } = useHaptics();
  
  const [selectedSeed, setSelectedSeed] = useState(currentSeed || loaded.seed || generateRandomSeed());
  const [selectedGradient, setSelectedGradient] = useState(currentGradient || loaded.gradient || AVATAR_GRADIENTS[0]);

  const handleConfirm = () => {
    vibrateMedium();
    saveAvatar(selectedSeed, selectedGradient);
    onSelect(selectedSeed, selectedGradient);
  };

  const handleRandom = () => {
    vibrateLight();
    setSelectedSeed(generateRandomSeed());
    setSelectedGradient(getRandomGradient());
  };

  const avatarUrl = getAvatarUrl(selectedSeed);

  return (
    <div className="flex flex-col gap-4">
      {/* Live Preview Box */}
      <div className="flex flex-col items-center justify-center py-2">
        <div className="relative">
          <motion.div
            key={selectedSeed + selectedGradient}
            initial={{ scale: 0.8, rotate: -5 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="w-24 h-24 rounded-[28px] shadow-neon-blue border-[3px] border-white/80 transition-all flex items-center justify-center overflow-hidden"
            style={{ background: selectedGradient }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-[120%] h-[120%] object-cover mt-[20%]" style={{ imageRendering: 'pixelated' }} />
            ) : (
              <div className="text-4xl animate-bounce">👾</div>
            )}
          </motion.div>
          <div className="absolute -bottom-2 -right-2 bg-slate-900 text-neon-blue text-[10px] font-bold px-2 py-1 rounded border border-neon-blue shadow-neon-blue">
            PIXEL
          </div>
        </div>
        <p className="text-[12px] font-bold text-slate-400 mt-3 uppercase tracking-wider">พรีวิวโปรไฟล์</p>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex bg-slate-800 rounded-2xl p-1 gap-1 border border-slate-700">
        <button
          className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
            tab === 'avatar' ? 'bg-slate-700 text-neon-blue shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
          onClick={() => { vibrateLight(); setTab('avatar'); }}
        >
          👾 ตัวละคร
        </button>
        <button
          className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
            tab === 'color' ? 'bg-slate-700 text-neon-pink shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
          onClick={() => { vibrateLight(); setTab('color'); }}
        >
          🎨 พื้นหลัง
        </button>
      </div>

      <div className="min-h-[140px]">
        <AnimatePresence mode="wait">
          {/* Tab 1: Avatar Generator */}
          {tab === 'avatar' && (
            <motion.div
              key="avatar"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3"
            >
              <div className="text-center">
                <span className="text-[12px] font-bold text-slate-400 block mb-2">โค้ดพันธุกรรมตัวละคร (Seed)</span>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      className="input-field text-lg uppercase h-[50px] min-h-[50px] py-0"
                      value={selectedSeed}
                      onChange={(e) => setSelectedSeed(e.target.value.toUpperCase())}
                      maxLength={10}
                    />
                    <Edit3 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  </div>
                  <button
                    className="w-[50px] h-[50px] bg-slate-800 rounded-2xl flex-center border-2 border-slate-700 text-neon-blue active:bg-slate-700 transition-colors"
                    onClick={handleRandom}
                  >
                    <Shuffle size={18} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">พิมพ์อะไรก็ได้เพื่อสุ่มหน้าตาใหม่!</p>
              </div>
            </motion.div>
          )}

          {/* Tab 2: Solid Colors & Gradients */}
          {tab === 'color' && (
            <motion.div
              key="color"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-3"
            >
              <div>
                <span className="text-[12px] font-bold text-slate-400 block mb-2">การ์เดียนต์นีออน</span>
                <div className="grid grid-cols-3 gap-3">
                  {AVATAR_GRADIENTS.map((grad, idx) => (
                    <button
                      key={idx}
                      className={`w-full h-12 rounded-xl transition-all active:scale-90 flex-center shadow-md ${
                        selectedGradient === grad
                          ? 'ring-[3px] ring-white ring-offset-2 ring-offset-slate-900 scale-105'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ background: grad }}
                      onClick={() => { vibrateLight(); setSelectedGradient(grad); }}
                    >
                      {selectedGradient === grad && (
                        <Check size={18} color="white" strokeWidth={3} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-3 border-t border-slate-800 mt-2">
        <button
          className="w-full bg-neon-blue text-white font-bold rounded-xl py-3 text-[15px] flex justify-center items-center gap-2"
          onClick={handleConfirm}
        >
          <Check size={18} /> ยืนยันตัวละคร
        </button>
      </div>
    </div>
  );
};

export default AvatarPicker;

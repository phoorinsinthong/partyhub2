import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

const STORAGE_KEY = 'partyhub_sound_enabled';

let _soundEnabled = localStorage.getItem(STORAGE_KEY) !== 'false';

export function isSoundEnabled() {
  return _soundEnabled;
}

const SoundToggle = () => {
  const [enabled, setEnabled] = useState(_soundEnabled);

  useEffect(() => {
    _soundEnabled = enabled;
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  }, [enabled]);

  return (
    <button
      onClick={() => setEnabled(!enabled)}
      className="w-11 h-11 rounded-2xl bg-white border-2 border-sage-100 flex-center active:scale-95 shadow-sm transition-transform"
      title={enabled ? 'ปิดเสียง' : 'เปิดเสียง'}
    >
      {enabled ? (
        <Volume2 size={18} className="text-sage-500" />
      ) : (
        <VolumeX size={18} className="text-olive-300" />
      )}
    </button>
  );
};

export default SoundToggle;

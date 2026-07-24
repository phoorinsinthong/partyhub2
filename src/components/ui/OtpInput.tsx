import React, { useRef, useState, useEffect } from 'react';
import { useHaptics } from '../../hooks/useHaptics';

interface OtpInputProps {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
}

const OtpInput: React.FC<OtpInputProps> = ({ length = 4, onComplete, disabled = false }) => {
  const [code, setCode] = useState<string[]>(new Array(length).fill(''));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const { vibrateLight } = useHaptics();

  useEffect(() => {
    // Focus first input on mount
    if (inputsRef.current[0] && !disabled) {
      inputsRef.current[0].focus();
    }
  }, [disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const value = e.target.value.toUpperCase();
    if (/[^A-Z0-9]/.test(value)) return; // Allow only alphanumeric

    const newCode = [...code];
    // Keep only the last character entered
    newCode[index] = value.slice(-1);
    setCode(newCode);
    vibrateLight();

    // Auto-advance
    if (value && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    // Check completion
    if (newCode.every(char => char !== '')) {
      onComplete(newCode.join(''));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length);
    if (!pastedData) return;

    const newCode = [...code];
    for (let i = 0; i < pastedData.length; i++) {
      newCode[i] = pastedData[i];
      if (inputsRef.current[i]) {
        inputsRef.current[i]!.value = pastedData[i];
      }
    }
    setCode(newCode);
    vibrateLight();

    const focusIndex = Math.min(pastedData.length, length - 1);
    inputsRef.current[focusIndex]?.focus();

    if (newCode.every(char => char !== '')) {
      onComplete(newCode.join(''));
    }
  };

  return (
    <div className="flex items-center justify-center gap-3 w-full" dir="ltr">
      {code.map((value, index) => (
        <input
          key={index}
          ref={(el) => { inputsRef.current[index] = el; }}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          maxLength={2}
          value={value}
          disabled={disabled}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          className="w-14 h-16 text-center text-2xl font-display font-black rounded-2xl
                     bg-slate-900 border-2 border-slate-700 text-white
                     focus:border-neon-blue focus:shadow-neon-blue focus:outline-none
                     transition-all duration-200 uppercase"
        />
      ))}
    </div>
  );
};

export default OtpInput;

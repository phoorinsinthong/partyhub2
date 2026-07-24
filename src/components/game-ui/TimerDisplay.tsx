import React from 'react';
import { Timer } from 'lucide-react';

interface TimerDisplayProps {
  timeLeft: number;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ timeLeft }) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-panel px-lg py-md flex items-center gap-md border-primary/30 w-fit">
      <Timer size={20} className={timeLeft < 60 ? 'text-danger animate-pulse' : 'text-primary'} />
      <span className={`font-mono text-2xl font-black ${timeLeft < 60 ? 'text-danger' : 'text-white'}`}>
        {formatTime(timeLeft)}
      </span>
    </div>
  );
};

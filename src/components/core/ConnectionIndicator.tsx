// @ts-nocheck
import React, { useState } from 'react';
import { useConnectionQuality } from '../../hooks/useConnectionQuality';
import { Wifi, WifiOff, Signal } from 'lucide-react';

const ConnectionIndicator = () => {
  const { quality, latency } = useConnectionQuality();
  const [showDetail, setShowDetail] = useState(false);

  if (quality === 'good' && !showDetail) {
    return (
      <button
        onClick={() => setShowDetail(true)}
        className="w-2.5 h-2.5 rounded-full bg-green-400 shrink-0 animate-pulse-soft"
        title="เชื่อมต่อดี"
      />
    );
  }

  if (quality === 'slow') {
    return (
      <button
        onClick={() => setShowDetail(!showDetail)}
        className="flex items-center gap-1.5 bg-amber-50 border-2 border-amber-200 px-2.5 py-1 rounded-full"
      >
        <Signal size={12} className="text-amber-500" />
        {showDetail && (
          <span className="text-[10px] font-bold text-amber-600">
            {latency ? `${latency}ms` : 'ช้า'}
          </span>
        )}
      </button>
    );
  }

  if (quality === 'disconnected') {
    return (
      <div className="flex items-center gap-1.5 bg-red-50 border-2 border-red-200 px-2.5 py-1 rounded-full animate-pulse">
        <WifiOff size={12} className="text-red-500" />
        <span className="text-[10px] font-bold text-red-600">หลุด</span>
      </div>
    );
  }

  // good + showDetail
  return (
    <button
      onClick={() => setShowDetail(false)}
      className="flex items-center gap-1.5 bg-green-50 border-2 border-green-200 px-2.5 py-1 rounded-full"
    >
      <Wifi size={12} className="text-green-500" />
      {latency && <span className="text-[10px] font-bold text-green-600">{latency}ms</span>}
    </button>
  );
};

export default ConnectionIndicator;

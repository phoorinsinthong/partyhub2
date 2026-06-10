import React from 'react';
import { motion } from 'framer-motion';
import { getSuitInfo } from '../utils/cards';

const PlayingCard = ({ 
  card, 
  hidden = false, 
  selected = false, 
  onClick = null, 
  className = "",
  style = {},
  disabled = false,
  animated = true
}) => {
  if (!card && !hidden) return null;

  const suitInfo = hidden ? null : getSuitInfo(card.suit);

  const cardContent = (
    <div 
      className={`relative w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 shadow-md flex flex-col justify-between p-2 select-none bg-white transition-colors
        ${selected ? 'border-primary ring-4 ring-primary/30 -translate-y-4 shadow-xl' : 'border-stone-200'}
        ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : onClick ? 'cursor-pointer hover:-translate-y-2' : ''}
        ${className}
      `}
      style={style}
      onClick={() => { if (!disabled && onClick) onClick(card); }}
    >
      {hidden ? (
        // Card Back
        <div className="w-full h-full rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 border border-white/20 flex items-center justify-center">
          <div className="w-8 h-8 opacity-30 text-white flex-center">
            <span className="text-2xl">♠</span>
          </div>
        </div>
      ) : (
        // Card Front
        <>
          <div className={`text-sm sm:text-base font-bold leading-none ${suitInfo.color}`}>
            {card.value}
            <div className="text-xs sm:text-sm">{suitInfo.symbol}</div>
          </div>
          
          {/* Center Large Symbol */}
          <div className={`absolute inset-0 flex items-center justify-center opacity-10 text-4xl pointer-events-none ${suitInfo.color}`}>
            {suitInfo.symbol}
          </div>

          <div className={`text-sm sm:text-base font-bold leading-none text-right rotate-180 ${suitInfo.color}`}>
            {card.value}
            <div className="text-xs sm:text-sm">{suitInfo.symbol}</div>
          </div>
        </>
      )}
    </div>
  );

  if (!animated) return cardContent;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {cardContent}
    </motion.div>
  );
};

export default PlayingCard;

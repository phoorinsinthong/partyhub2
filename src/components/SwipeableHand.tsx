import React, { useRef, useState, useEffect } from 'react';
import { motion, PanInfo } from 'framer-motion';
import PlayingCard from './PlayingCard';

interface SwipeableHandProps {
  cards: any[];
  hidden?: boolean;
  onCardClick?: (card: any, index: number) => void;
  selectedIndices?: number[];
  disabled?: boolean;
  className?: string;
  cardClassName?: string;
  fanAngle?: number; // Max angle for fanning cards
}

export const SwipeableHand: React.FC<SwipeableHandProps> = ({
  cards,
  hidden = false,
  onCardClick,
  selectedIndices = [],
  disabled = false,
  className = '',
  cardClassName = '',
  fanAngle = 20,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  if (!cards || cards.length === 0) return null;

  return (
    <div 
      ref={containerRef}
      className={`relative w-full flex justify-center items-center pt-8 pb-4 px-4 overflow-x-auto hide-scrollbar ${className}`}
      style={{ perspective: '1000px' }}
    >
      <div className="flex justify-center items-center" style={{ minWidth: `${(cards.length * 40) + 40}px` }}>
        {cards.map((card, index) => {
          // Calculate rotation based on index relative to center
          const centerIndex = (cards.length - 1) / 2;
          const offset = index - centerIndex;
          
          // Max rotation based on fanAngle
          const maxRotation = fanAngle; 
          const rotation = cards.length > 1 ? (offset / centerIndex) * maxRotation : 0;
          
          // Y translation to create an arc
          const yTranslation = Math.abs(offset) * 4;
          
          const isSelected = selectedIndices.includes(index);

          return (
            <motion.div
              key={`${card.suit}-${card.value}-${index}`}
              initial={{ opacity: 0, y: 50, rotate: 0 }}
              animate={{ 
                opacity: 1, 
                y: isSelected ? -20 : yTranslation, 
                rotate: rotation,
                x: offset * 25 // Overlap spacing
              }}
              whileHover={{ 
                y: disabled ? (isSelected ? -20 : yTranslation) : -30,
                rotate: 0,
                zIndex: 50,
                scale: 1.1
              }}
              whileTap={{ scale: disabled ? 1 : 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{
                position: 'absolute',
                zIndex: isSelected ? 40 : index,
                transformOrigin: 'bottom center'
              }}
              onClick={() => {
                if (!disabled && onCardClick) {
                  onCardClick(card, index);
                }
              }}
              className="cursor-pointer"
            >
              <PlayingCard 
                card={card} 
                hidden={hidden} 
                selected={isSelected}
                disabled={disabled}
                animated={false} // Disable PlayingCard's internal animation to use our own
                className={`shadow-[0_0_15px_rgba(0,0,0,0.5)] ${cardClassName}`}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

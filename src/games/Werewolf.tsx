// @ts-nocheck
import React from 'react';
import { WerewolfProvider, useWerewolf } from './werewolf/WerewolfContext';
import { WerewolfSetupPhase } from './werewolf/WerewolfSetupPhase';
import { WerewolfPhysicalMode } from './werewolf/WerewolfPhysicalMode';
import { WerewolfDigitalMode } from './werewolf/WerewolfDigitalMode';
import { WerewolfResultPhase } from './werewolf/WerewolfResultPhase';

const WerewolfContent: React.FC = () => {
  const { phase, gameMode, wwData } = useWerewolf();

  // If waiting or no players, we are in setup phase
  if (phase === 'waiting' || !wwData.players) {
    return <WerewolfSetupPhase />;
  }

  // Result phase
  if (phase === 'result') {
    return <WerewolfResultPhase />;
  }

  // Active game phase delegates based on game mode
  if (gameMode === 'physical') {
    return <WerewolfPhysicalMode />;
  }
  
  return <WerewolfDigitalMode />;
};

const Werewolf: React.FC = () => {
  return (
    <WerewolfProvider>
      <WerewolfContent />
    </WerewolfProvider>
  );
};

export default Werewolf;

import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Home, Lobby, GameRoom } from '@/pages';
import { ErrorBoundary, OfflineIndicator, InstallPrompt } from '@/components/core';
import { ThemeProvider, useKeyboardResize, useSessionRecovery } from '@/hooks';
import { GameProvider } from '@/contexts/GameContext';
import WerewolfModerator from '@/games/werewolf/WerewolfModerator';
import '@/index.css';

// Wrapper component to use router hooks
function SessionManager() {
  useSessionRecovery();
  return null;
}

function App() {
  useKeyboardResize();

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <GameProvider>
          <Router>
            <SessionManager />
            <OfflineIndicator />
            <div className="app-container">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/lobby/:roomId" element={<Lobby />} />
                <Route path="/game/:roomId" element={<GameRoom />} />
                <Route path="/werewolf-moderator" element={<WerewolfModerator />} />
              </Routes>
            </div>
            <InstallPrompt />
          </Router>
        </GameProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/home';
import Lobby from './pages/lobby';
import GameRoom from './pages/GameRoom';
import ErrorBoundary from './components/core/ErrorBoundary';
import OfflineIndicator from './components/core/OfflineIndicator';
import InstallPrompt from './components/core/InstallPrompt';
import { ThemeProvider } from './hooks/useTheme';
import { GameProvider } from './contexts/GameContext';
import { useKeyboardResize } from './hooks/useKeyboardResize';
import { useSessionRecovery } from './hooks/useSessionRecovery';
import './index.css';

import WerewolfModerator from './games/werewolf/WerewolfModerator';

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

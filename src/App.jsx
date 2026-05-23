import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import GameRoom from './pages/GameRoom';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';
import InstallPrompt from './components/InstallPrompt';
import { ThemeProvider } from './hooks/useTheme';
import { useKeyboardResize } from './hooks/useKeyboardResize';
import './index.css';

function App() {
  useKeyboardResize();

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <OfflineIndicator />
          <div className="app-container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/lobby/:roomId" element={<Lobby />} />
              <Route path="/game/:roomId" element={<GameRoom />} />
            </Routes>
          </div>
          <InstallPrompt />
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

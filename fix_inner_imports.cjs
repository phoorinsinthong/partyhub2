const fs = require('fs');
const path = require('path');

const folders = ['src/components/ui', 'src/components/features', 'src/components/core'];

folders.forEach(folder => {
  if (fs.existsSync(folder)) {
    const files = fs.readdirSync(folder).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
    files.forEach(file => {
      const filePath = path.join(folder, file);
      let content = fs.readFileSync(filePath, 'utf8');
      const original = content;

      // Fix ../hooks/ -> ../../hooks/
      content = content.replace(/(['"])\.\.\/hooks\//g, '$1../../hooks/');
      // Fix ../utils/ -> ../../utils/
      content = content.replace(/(['"])\.\.\/utils\//g, '$1../../utils/');
      // Fix ../firebase -> ../../firebase
      content = content.replace(/(['"])\.\.\/firebase/g, '$1../../firebase');
      // Fix ../contexts/ -> ../../contexts/
      content = content.replace(/(['"])\.\.\/contexts\//g, '$1../../contexts/');
      // Fix ../games/ -> ../../games/
      content = content.replace(/(['"])\.\.\/games\//g, '$1../../games/');
      
      // Fix intra-component imports that were broken:
      // If a feature component imported a ui component via `../NeonCard`, it now should be `../ui/NeonCard`
      // Wait, before the move it was `import NeonCard from './NeonCard'`. So it's `./NeonCard` -> `../ui/NeonCard`.
      // Let's just blindly update `./X` to `../ui/X` if X is a ui component.
      const uiComponents = ['NeonCard', 'GiantButton', 'PlayingCard', 'EpicPopup', 'LeaveConfirmModal', 'HoldToRevealCard', 'SwipeableHand', 'OtpInput', 'AvatarPicker', 'ThemeToggle', 'SoundToggle'];
      const coreComponents = ['ErrorBoundary', 'ConnectionIndicator', 'OfflineIndicator', 'InstallPrompt', 'ReconnectBanner'];
      const featureComponents = ['Scoreboard', 'PersonalStats', 'GameGuide', 'RealTimeCanvas', 'SmartTutorialOverlay'];
      
      uiComponents.forEach(c => {
        content = content.replace(new RegExp(`(['"])\\.\\/${c}(['"])`, 'g'), `$1../ui/${c}$2`);
      });
      coreComponents.forEach(c => {
        content = content.replace(new RegExp(`(['"])\\.\\/${c}(['"])`, 'g'), `$1../core/${c}$2`);
      });
      featureComponents.forEach(c => {
        content = content.replace(new RegExp(`(['"])\\.\\/${c}(['"])`, 'g'), `$1../features/${c}$2`);
      });

      if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`Fixed inner imports in ${filePath}`);
      }
    });
  }
});

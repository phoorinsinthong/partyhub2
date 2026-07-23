const fs = require('fs');
const path = require('path');

const uiComponents = ['NeonCard', 'GiantButton', 'PlayingCard', 'EpicPopup', 'LeaveConfirmModal', 'HoldToRevealCard', 'SwipeableHand', 'OtpInput', 'AvatarPicker', 'ThemeToggle', 'SoundToggle'];
const featureComponents = ['Scoreboard', 'PersonalStats', 'GameGuide', 'RealTimeCanvas', 'SmartTutorialOverlay'];
const coreComponents = ['ErrorBoundary', 'ConnectionIndicator', 'OfflineIndicator', 'InstallPrompt', 'ReconnectBanner'];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  uiComponents.forEach(comp => {
    // Replace imports from `../components/Comp` to `../components/ui/Comp`
    // Need to handle varying depths like `../../components/Comp`
    const regex = new RegExp(`(['"])((?:\\.\\.\\/)+)components\\/${comp}(['"])`, 'g');
    content = content.replace(regex, `$1$2components/ui/${comp}$3`);
    
    // Also handle `./components/Comp` if importing from App.tsx
    const regex2 = new RegExp(`(['"])\\.\\/components\\/${comp}(['"])`, 'g');
    content = content.replace(regex2, `$1./components/ui/${comp}$2`);
  });

  featureComponents.forEach(comp => {
    const regex = new RegExp(`(['"])((?:\\.\\.\\/)+)components\\/${comp}(['"])`, 'g');
    content = content.replace(regex, `$1$2components/features/${comp}$3`);
    
    const regex2 = new RegExp(`(['"])\\.\\/components\\/${comp}(['"])`, 'g');
    content = content.replace(regex2, `$1./components/features/${comp}$2`);
  });

  coreComponents.forEach(comp => {
    const regex = new RegExp(`(['"])((?:\\.\\.\\/)+)components\\/${comp}(['"])`, 'g');
    content = content.replace(regex, `$1$2components/core/${comp}$3`);
    
    const regex2 = new RegExp(`(['"])\\.\\/components\\/${comp}(['"])`, 'g');
    content = content.replace(regex2, `$1./components/core/${comp}$2`);
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Fixed imports in ${file}`);
  }
});

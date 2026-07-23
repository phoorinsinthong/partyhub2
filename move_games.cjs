const fs = require('fs');
const path = require('path');
const glob = require('glob');

const gamesDir = path.join(__dirname, 'src', 'games');
const logicDir = path.join(gamesDir, 'logic');

const games = [
  'Blackjack', 'DrinkingGame', 'MathRace', 'NeverHaveIEver',
  'PokDeng', 'Poker', 'Quiz', 'Slaves', 'TargetNumber',
  'TruthOrDare', 'TwentyQuestions', 'WordBomb', 'WouldYouRather'
];

games.forEach(game => {
  const file = path.join(gamesDir, `${game}.tsx`);
  if (!fs.existsSync(file)) return;
  
  const lowerName = game.charAt(0).toLowerCase() + game.slice(1);
  const targetDir = path.join(gamesDir, lowerName);
  
  fs.mkdirSync(targetDir, { recursive: true });
  
  // 1. Move and update main game file
  let content = fs.readFileSync(file, 'utf8');
  // Update imports: ../ -> ../../
  content = content.replace(/from '\.\.\//g, "from '../../");
  // Logic imports: ./logic/xxx -> ./xxx
  content = content.replace(/from '\.\/logic\//g, "from './");
  // The Werewolf context or others? No.
  
  const targetFile = path.join(targetDir, 'index.tsx');
  fs.writeFileSync(targetFile, content);
  fs.unlinkSync(file);
  console.log(`Moved ${game}.tsx to ${lowerName}/index.tsx`);
});

// 2. Move logic files based on prefixes
const prefixes = {
  'mathRace': 'mathRace',
  'neverHaveIEver': 'never',
  'poker': 'poker',
  'quiz': 'quiz',
  'truthOrDare': 'truth',
  'twentyQuestions': 'twentyQuestions',
  'wordBomb': 'wordBomb',
  'wouldYouRather': 'wyr'
};

const logicFiles = fs.readdirSync(logicDir);
logicFiles.forEach(file => {
  for (const [gameName, prefix] of Object.entries(prefixes)) {
    if (file.startsWith(prefix)) {
      const targetDir = path.join(gamesDir, gameName);
      if (fs.existsSync(targetDir)) {
        const sourcePath = path.join(logicDir, file);
        let content = fs.readFileSync(sourcePath, 'utf8');
        // Update imports if logic file had any
        content = content.replace(/from '\.\.\//g, "from '../../");
        content = content.replace(/from '\.\.\/\.\.\//g, "from '../../../");
        
        fs.writeFileSync(path.join(targetDir, file), content);
        fs.unlinkSync(sourcePath);
        console.log(`Moved logic/${file} to ${gameName}/${file}`);
      }
      break;
    }
  }
});

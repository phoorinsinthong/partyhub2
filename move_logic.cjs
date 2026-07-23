const fs = require('fs');
const path = require('path');

const gamesDir = path.join(__dirname, 'src', 'games');
const logicDir = path.join(gamesDir, 'logic');

const moves = {
  'drawing': ['drawingData.ts', 'drawingLogic.ts'],
  'fakeArtist': ['fakeArtistData.ts', 'fakeArtistLogic.ts'],
  'spyfall': ['spyfallCats.ts', 'spyfallData.ts', 'spyfallLogic.test.ts', 'spyfallLogic.ts'],
  'taboo': ['tabooData.ts'],
  'werewolf': ['werewolfData.ts', 'werewolfLogic.test.ts', 'werewolfLogic.ts']
};

for (const [gameName, files] of Object.entries(moves)) {
  const targetDir = path.join(gamesDir, gameName);
  for (const file of files) {
    const sourcePath = path.join(logicDir, file);
    if (fs.existsSync(sourcePath)) {
      let content = fs.readFileSync(sourcePath, 'utf8');
      content = content.replace(/from '\.\.\//g, "from '../../");
      content = content.replace(/from '\.\.\/\.\.\//g, "from '../../../");
      fs.writeFileSync(path.join(targetDir, file), content);
      fs.unlinkSync(sourcePath);
      console.log(`Moved ${file} to ${gameName}/${file}`);
    }
  }
}

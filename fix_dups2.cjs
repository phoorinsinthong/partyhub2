const fs = require('fs');
const files = [
  'src/games/taboo/index.tsx',
  'src/games/mathRace/index.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Remove the safeUpdate block that is declared as useCallback
    content = content.replace(/const safeUpdate = (React\.)?useCallback\(async[\s\S]*?\} catch(?: \(.*?\))? \{[\s\S]*?\}\n  \}, \[.*?\]\);\n/g, '');
    
    fs.writeFileSync(file, content);
    console.log(`Fixed ${file}`);
  }
}

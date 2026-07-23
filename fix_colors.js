const fs = require('fs');
const files = [
  'src/games/TargetNumber.tsx',
  'src/games/TruthOrDare.tsx',
  'src/games/TwentyQuestions.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/"rose"/g, '"pink"');
  content = content.replace(/"emerald"/g, '"green"');
  content = content.replace(/"purple"/g, '"pink"');
  fs.writeFileSync(file, content);
});
console.log('Fixed colors');

const fs = require('fs');
const content = fs.readFileSync('src/games/Werewolf.tsx', 'utf8');

const s1 = content.indexOf("const clearSeerResults");
const e1 = content.indexOf("const startVotingPhase");
fs.writeFileSync('src/games/werewolf/night_logic.txt', content.substring(s1, e1));

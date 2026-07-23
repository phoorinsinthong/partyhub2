const fs = require('fs');
const content = fs.readFileSync('src/games/Werewolf.tsx', 'utf8');

const dayStart = content.indexOf("{phase === 'day' && (");
const dayEnd = content.indexOf("{phase === 'result' && ("); // Let's try finding the end
// Actually I'll just write the entire content from dayStart to the end of the file, then slice it.
const slice = content.substring(dayStart);
fs.writeFileSync('src/games/werewolf/day_render.txt', slice);

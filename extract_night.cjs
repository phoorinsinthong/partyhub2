const fs = require('fs');
const content = fs.readFileSync('src/games/Werewolf.tsx', 'utf8');

const nightStart = content.indexOf("{phase === 'night' && (");
const nightEnd = content.indexOf("{phase === 'day' && (");
const nightRender = content.substring(nightStart, nightEnd);

fs.writeFileSync('src/games/werewolf/night_render.txt', nightRender);

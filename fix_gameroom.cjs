const fs = require('fs');
let content = fs.readFileSync('src/pages/GameRoom.tsx', 'utf8');

// 1. Remove all lazy imports for games
content = content.replace(/const (DrinkingGame|Spyfall|TargetNumber|Werewolf|TruthOrDare|Quiz|Drawing|WouldYouRather|WordBomb|NeverHaveIEver|Taboo|MathRace|TwentyQuestions|FakeArtist|Blackjack|Slaves|Poker|PokDeng) = lazy\(\(\) => import\('\.\.\/games\/.*?'\)\);\n/g, '');

// 2. Add GAME_COMPONENTS import
content = content.replace(/import \{ fireConfetti \} from '\.\.\/utils\/confetti';\n/, "import { fireConfetti } from '../utils/confetti';\nimport { GAME_COMPONENTS } from '../utils/gameRegistry';\n");

// 3. Replace renderGame switch statement
const switchReplacement = `  const renderGame = () => {
    const GameComponent = GAME_COMPONENTS[roomData.currentGame as keyof typeof GAME_COMPONENTS];
    if (GameComponent) {
      return <GameComponent />;
    }
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center flex-col p-8 text-center flex-1 gap-3">
        <span className="text-4xl">🔨</span>
        <p className="font-bold text-slate-200">กำลังรอสักครู่...</p>
        <p className="text-slate-400 text-sm">รอหัวห้องเลือกเกม!</p>
      </div>
    );
  };`;
content = content.replace(/  const renderGame = \(\) => \{\n    const props = \{ roomId, roomData, userNickname \};\n    switch \(roomData.currentGame\) \{[\s\S]*?    \}\n  \};/m, switchReplacement);

fs.writeFileSync('src/pages/GameRoom.tsx', content);

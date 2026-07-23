const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/games/**/*.{ts,tsx}');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('const safeUpdate = ')) {
    // Add import if not exists
    if (!content.includes('useGameUpdate')) {
      if (content.includes("import { useGame } from '../contexts/GameContext';")) {
        content = content.replace("import { useGame } from '../contexts/GameContext';", "import { useGame } from '../contexts/GameContext';\nimport { useGameUpdate } from '../hooks/useGameUpdate';");
      } else if (content.includes("import { useGame } from '../../contexts/GameContext';")) {
        content = content.replace("import { useGame } from '../../contexts/GameContext';", "import { useGame } from '../../contexts/GameContext';\nimport { useGameUpdate } from '../../hooks/useGameUpdate';");
      }
    }
    
    // Remove local errorMsg
    content = content.replace(/const \[errorMsg, setErrorMsg\] = useState\(''\);\n?/g, '');
    
    // Remove safeUpdate function
    // For Spyfall which uses useCallback
    content = content.replace(/const safeUpdate = useCallback\(async[\s\S]*?\} catch \(err\) \{[\s\S]*?\}\n  \}, \[.*?\]\);\n/g, '');
    // For others
    content = content.replace(/const safeUpdate = async[\s\S]*?\} catch \{[\s\S]*?\}\n  \};\n/g, '');
    // For some which catch (e) or catch (error)
    content = content.replace(/const safeUpdate = async[\s\S]*?\} catch \(.*?\) \{[\s\S]*?\}\n  \};\n/g, '');
    
    // Insert useGameUpdate after useGame
    if (!content.includes('const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId)')) {
      content = content.replace(/(const {.*?roomId.*?} = useGame\(\);)/, "$1\n  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);");
    }
    
    fs.writeFileSync(file, content);
    console.log(`Refactored ${file}`);
  }
}

# Party Hub — System Prompt & Architecture Document

## Overview

Party Hub เป็นเว็บแอปเกมปาร์ตี้แบบเรียลไทม์ เล่นกับเพื่อนผ่านมือถือหรือคอมพิวเตอร์ รองรับ 14 เกม ใช้ Firebase Realtime Database สำหรับ sync ข้อมูลระหว่างผู้เล่น

- **URL**: `https://phoorinsinthong.github.io/partyhub/`
- **Platform**: PWA (Progressive Web App) — ติดตั้งได้ทั้ง iOS/Android
- **Language**: UI ทั้งหมดเป็นภาษาไทย

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 8 |
| Styling | Tailwind CSS 3 (custom theme: olive, sage, cream, warm, bark) |
| Animation | Framer Motion 12 |
| Routing | React Router 7 (HashRouter), base path `/partyhub/` |
| Icons | Lucide React |
| Backend | Firebase Realtime Database + Anonymous Auth |
| PWA | vite-plugin-pwa (Workbox, `registerType: 'autoUpdate'`) |
| Deployment | GitHub Pages via `gh-pages` package |
| Fonts | Mali (Thai display), Nunito (body) |
| Other | canvas-confetti, qrcode.react |

---

## Project Structure

```
party-hub/
├── index.html              # Entry point, PWA meta, font loading, old SW cleanup
├── vite.config.js          # Vite + PWA + manual chunks (firebase, vendor)
├── tailwind.config.js      # Custom color palette + font families
├── package.json            # Scripts: dev, build, preview, deploy
├── public/
│   ├── manifest.json       # PWA manifest (static, not generated)
│   ├── .nojekyll           # Required for GitHub Pages
│   ├── favicon.svg         # Pixel art emoji favicon
│   └── icons/              # PWA icons (192, 512, apple-touch-icon)
└── src/
    ├── main.jsx            # React root + authReady gate
    ├── App.jsx             # Router: /, /lobby/:roomId, /game/:roomId
    ├── index.css           # Tailwind directives + global styles
    ├── firebase.js         # Firebase init + authReady promise
    ├── pages/
    │   ├── Home.jsx        # Landing: create/join room
    │   ├── Lobby.jsx       # Room lobby: player list, game picker, start
    │   └── GameRoom.jsx    # Game wrapper: lazy-loads game components
    ├── games/
    │   ├── DrinkingGame.jsx
    │   ├── Spyfall.jsx
    │   ├── TargetNumber.jsx
    │   ├── Werewolf.jsx
    │   ├── TruthOrDare.jsx
    │   ├── Quiz.jsx
    │   ├── Drawing.jsx
    │   ├── WouldYouRather.jsx
    │   ├── WordBomb.jsx
    │   ├── NeverHaveIEver.jsx
    │   ├── Taboo.jsx
    │   ├── MathRace.jsx
    │   ├── TwentyQuestions.jsx  # (Insider game)
    │   ├── FakeArtist.jsx
    │   ├── insiderData.js       # Word bank: 198 words, 8 categories
    │   ├── spyfallData.js       # Locations + roles
    │   ├── quizData.js          # 160 quiz questions
    │   ├── tabooData.js         # 199 taboo cards
    │   └── neverData.js         # 75 "never have I ever" statements
    ├── components/
    │   ├── AvatarPicker.jsx     # Avatar selection UI
    │   ├── Scoreboard.jsx       # Cross-game win tracking + recordWin()
    │   ├── PersonalStats.jsx    # Per-player lifetime stats (localStorage)
    │   ├── ReconnectBanner.jsx  # Session restore on disconnect
    │   ├── ConnectionIndicator.jsx
    │   ├── GameGuide.jsx        # How-to-play modal per game
    │   ├── ErrorBoundary.jsx
    │   ├── OfflineIndicator.jsx
    │   ├── InstallPrompt.jsx    # PWA install banner
    │   ├── LeaveConfirmModal.jsx
    │   ├── SoundToggle.jsx
    │   └── ThemeToggle.jsx      # Dark/light mode
    ├── hooks/
    │   ├── usePresence.js       # Online status + host transfer + player cleanup
    │   ├── useGameLeave.js      # Leave confirmation
    │   ├── useGameTimer.js      # Shared timer logic
    │   ├── useConnectionQuality.js
    │   ├── useKeyboardResize.js # Virtual keyboard viewport fix
    │   └── useTheme.jsx         # Dark mode context
    └── utils/
        ├── gameData.js          # GAME_NAMES, GAME_ICONS mappings
        ├── avatars.js           # Avatar emoji list
        ├── rateLimit.js         # Client-side rate limiting (localStorage)
        ├── feedback.js          # Haptic vibration + Web Audio sound effects
        └── confetti.js          # canvas-confetti wrapper
```

---

## Firebase Architecture

### Configuration

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

### Authentication

- Anonymous auth (`signInAnonymously`)
- `authReady` promise resolves when auth completes (10s hard timeout)
- Retries on network reconnection
- Database rules: `auth != null` required for all reads/writes

### Database Schema

```
rooms/
  {roomCode}/                    # 4-char uppercase alphanumeric
    host: string                 # Nickname of room host
    status: 'waiting' | 'playing'
    currentGame: string          # Game ID (e.g., 'drinking', 'spyfall')
    hostDisconnectedAt: timestamp | null
    players/
      {nickname}/
        avatar: string           # Emoji avatar
        online: boolean
        lastSeen: timestamp
        isHost: boolean
    gameData/                    # Game-specific state (varies per game)
      phase: string
      ...
    scoreboard/                  # Cross-game cumulative scores
      {nickname}/
        wins: number
        games/
          {gameId}: number       # Wins per game type
    drawingStrokes/              # Drawing game only — separate path for perf
      {strokeId}: { color, width, points: [{x, y}] }
```

### Room Code

- 4 characters, uppercase alphanumeric (A-Z, 0-9)
- Generated client-side, checked for uniqueness before creation

---

## Core Patterns

### 1. Host-Driven Architecture

- Host controls game flow (start, advance phases, end game)
- Non-host players can only interact within their allowed actions
- Host transfer on disconnect (10-minute grace period, alphabetical priority)
- GM-based games (Werewolf, Insider) never transfer host mid-game

### 2. advancingRef — Double-Tap Prevention

```jsx
const advancingRef = useRef(false);

const handleAction = async () => {
  if (advancingRef.current) return;
  advancingRef.current = true;
  try {
    await update(ref(db, `rooms/${roomId}/gameData`), { ... });
  } finally {
    advancingRef.current = false;
  }
};
```

### 3. Presence System

- `usePresence(roomId, nickname, isHost)` — tracks online/offline status
- `usePlayerCleanup(roomId)` — removes players after grace period
- Grace periods: 10 minutes (lobby), 15 minutes (in-game)
- `onDisconnect()` handlers for instant status update
- `visibilitychange` + `pagehide` events for tab switching

### 4. Personal Stats (localStorage)

```jsx
const personalRecordedRef = useRef(false);

useEffect(() => {
  if (gameData.phase === 'finished' && !personalRecordedRef.current) {
    personalRecordedRef.current = true;
    recordPersonalGame('gameId');
    if (isWinner) recordPersonalWin('gameId');
  }
}, [gameData.phase]);
```

### 5. Timer Pattern

- Store `timerEnd: Date.now() + durationMs` in Firebase
- Client-side `setInterval` calculates remaining time
- All clients stay in sync regardless of when they join

### 6. Rate Limiting (Client-Side)

- Room creation: max 3 per 60 seconds
- Room join: max 5 per 60 seconds
- Uses localStorage bucket tracking

### 7. Feedback System

```jsx
import { feedback } from '../utils/feedback';
feedback('tap');        // Light haptic + click sound
feedback('success');    // Success pattern
feedback('gameStart');  // Fanfare
feedback('victory');    // Win celebration
feedback('countdown');  // Timer tick
feedback('timeUp');     // Time expired
```

- Haptic: `navigator.vibrate()` with various patterns
- Sound: Web Audio API synthesized tones (no external audio files)
- Sound toggle via localStorage `partyhub_sound_enabled`

### 8. Lazy Loading

All game components are lazy-loaded in `GameRoom.jsx`:
```jsx
const Drawing = lazy(() => import('../games/Drawing'));
```

### 9. iOS Safari Touch Drawing

Canvas drawing uses non-passive touch listeners to prevent scroll:
```jsx
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
  return () => { /* cleanup */ };
}, [deps]);
```

---

## Games (14 total)

### 1. วงเหล้า (Drinking Game) — `drinking`

| Property | Value |
|----------|-------|
| ผู้เล่นขั้นต่ำ | ไม่จำกัด |
| ระยะเวลา | ไม่จำกัด (เล่นจนหมดสำรับ) |
| ประเภท | Party — ไม่มีคะแนน |

**กลไก**: สุ่มไพ่จากสำรับ 52 ใบ แต่ละไพ่ (A-K) มีกฎดื่มต่างกัน เช่น A = Waterfall, K = King's Cup  
**Phase**: ไม่มี phase — เล่นต่อเนื่องจนกว่าไพ่จะหมด  
**Firebase gameData**:
```
{ deck: [], drawnCards: [], currentCard: {s, v, id}, turnIndex, lastAction, customRules: {} }
```
**Host config**: กำหนด custom rules ต่อหน้าไพ่ได้

---

### 2. สปายฟอล (Spyfall) — `spyfall`

| Property | Value |
|----------|-------|
| ผู้เล่นขั้นต่ำ | 3 คน |
| ระยะเวลา | 8 นาที (ปรับได้) |
| ประเภท | Social Deduction |

**กลไก**: ผู้เล่นทุกคนรู้สถานที่ ยกเว้น Spy สปายต้องพยายามไม่ถูกจับได้ ขณะที่ชาวบ้านต้องหาสปาย สปายสามารถทายสถานที่เพื่อชนะ  
**Phases**: `waiting` → `playing` → `voting` → `finished`  
**Player Roles**: Spy, Accomplice (4+ คน), Citizens  
**Firebase gameData**:
```
{ status, targetPlace, placeCategory, timerEnd, 
  players: { [name]: {role, place, isSpy, isAccomplice, votedFor, wantsToVote} },
  allPlaces, spyRevealing, winner, enableAccomplice }
```
**Host config**: เลือกหมวดสถานที่, ปรับเวลา, เปิด/ปิด Accomplice  
**Scoring**: `recordWin` สำหรับฝ่ายชนะ

---

### 3. เลขเป้า (Target Number) — `target`

| Property | Value |
|----------|-------|
| ผู้เล่นขั้นต่ำ | 2 คน |
| ระยะเวลา | ไม่จำกัด (หลายรอบ) |
| ประเภท | Party — มีคะแนนสะสม |

**กลไก**: ผู้เล่นคนหนึ่งเลือกเลขเป้า (1-100) คนอื่นเห็น hint ±5 แต่ละเทิร์นนับ +1, +2 หรือ +3 ใครโดนเลขเป้า = แพ้รอบนั้น  
**Phases**: `waiting` → `choosing_target` → `playing` → `finished`  
**Firebase gameData**:
```
{ gameStatus, targetChooser, targetNumber, range: {min, max}, 
  currentCount, currentPlayerIndex, playerOrder, loser, roundNumber, scores }
```
**Scoring**: สะสมคะแนนข้ามรอบ (คนแพ้ถูกหักคะแนน)

---

### 4. หมาป่า (Werewolf) — `werewolf`

| Property | Value |
|----------|-------|
| ผู้เล่นขั้นต่ำ | 5 คน (Host เป็น GM + 4 ผู้เล่น) |
| ระยะเวลา | 15-45 นาที |
| ประเภท | Social Deduction — Host เป็นผู้ดำเนินเกม (GM) |

**กลไก**: Host เป็น Game Master ควบคุมทุก phase ผู้เล่นแบ่งเป็นทีมหมาป่า vs ชาวบ้าน กลางคืนหมาป่ากัด กลางวันโหวตแขวนคอ  
**Phases**: `waiting` → `night` → `day` → `voting` → `standby` → `result`  
**Player Roles**: 30+ roles ใน 3 ทีม:
- ชาวบ้าน: seer, bodyguard, cupid, hunter, witch, elder, etc.
- หมาป่า: alpha_wolf, dire_wolf, lone_wolf, mystic_wolf, etc.
- อิสระ: serial_killer, tanner, vampire, cult_leader

**Timer**: กลางคืน 120s, กลางวัน 180s, โหวต 180s  
**Win conditions**: หมาป่า >= ชาวบ้าน, หมาป่าตายหมด, serial_killer อยู่คนเดียว, vampire ครองเมือง  
**Firebase gameData**:
```
{ wwData: { phase, dayCount, players: {[name]: {role, isAlive, vote}}, 
  nightActions, nightTurn, lastElimination, winnerTeam, deckCounts } }
```

---

### 5. จริงหรือกล้า (Truth or Dare) — `truthordare`

| Property | Value |
|----------|-------|
| ผู้เล่นขั้นต่ำ | ไม่จำกัด |
| ระยะเวลา | ไม่จำกัด |
| ประเภท | Party — ไม่มีคะแนน |

**กลไก**: เล่นตามลำดับ ผู้เล่นเลือก "จริง" หรือ "กล้า" สุ่มคำถาม/ภารกิจ (~70 truths, ~70 dares)  
**Phase**: ไม่มี explicit phase — เล่นต่อเนื่อง  
**Firebase gameData**:
```
{ turnIndex, currentCard: {type, text, player, timestamp}, history: [] }
```

---

### 6. ควิซ (Quiz) — `quiz`

| Property | Value |
|----------|-------|
| ผู้เล่นขั้นต่ำ | ไม่จำกัด |
| ระยะเวลา | ~3 นาที (10 ข้อ × 15 วินาที) |
| ประเภท | Competition |

**กลไก**: 10 คำถาม 4 ตัวเลือก ทุกคนตอบพร้อมกัน 15 วินาทีต่อข้อ คะแนน = 10 + เวลาที่เหลือ (bonus)  
**Phases**: `waiting` → `playing` → `finished`  
**Data**: ~160 คำถาม 8 หมวด (วิทย์, ภูมิศาสตร์, บันเทิง, กีฬา, วัฒนธรรม, เทค, ประวัติศาสตร์, ไทย)  
**Firebase gameData**:
```
{ phase, questions, currentQuestion, scores, answers: {[qIdx]: {[player]: {choice, correct, points}}}, 
  questionStartedAt, usedQuestionIds }
```

---

### 7. วาดรูปทายคำ (Drawing) — `drawing`

| Property | Value |
|----------|-------|
| ผู้เล่นขั้นต่ำ | 2 คน |
| ระยะเวลา | ~10 นาที |
| ประเภท | Competition — Canvas วาดรูปแบบเรียลไทม์ |

**กลไก**: แต่ละคนผลัดกันวาด คนอื่นทายผ่าน text input ทายถูก = 10 + time bonus คนวาดได้ 5 คะแนนต่อคนที่ทายถูก  
**Phases**: `waiting` → `choosing` → `playing` → `roundEnd` → `finished`  
**Timer**: 60-90s ต่อรอบ (ตามความยาก)  
**Firebase**: ใช้ path แยก `rooms/{roomId}/drawingStrokes` สำหรับ real-time stroke sync  
**Host config**: ความยาก (easy/medium/hard/funny/random/custom) — custom = คนวาดพิมพ์คำเอง  
**Firebase gameData**:
```
{ phase, scores, round, totalRounds, drawerOrder, currentDrawer, currentWord, 
  guesses: {[name]: {text, correct, points}}, roundStartedAt, difficulty }
```

---

### 8. เลือกข้าง (Would You Rather) — `wouldyourather`

| Property | Value |
|----------|-------|
| ผู้เล่นขั้นต่ำ | ไม่จำกัด |
| ระยะเวลา | ~4 นาที (10 รอบ × 15 วินาที) |
| ประเภท | Party + Competition |

**กลไก**: 10 รอบ เลือก A หรือ B ภายใน 15 วินาที คะแนน = เลือกตรงกับเสียงส่วนใหญ่  
**Phases**: `waiting` → `playing` → `results` → `finished`  
**Firebase gameData**:
```
{ phase, questions, currentRound, votes: {[round]: {[player]: 'A'|'B'}}, 
  majorityScores, questionStartedAt }
```

---

### 9. บอมบ์คำ (Word Bomb) — `wordbomb`

| Property | Value |
|----------|-------|
| ผู้เล่นขั้นต่ำ | 3 คน (Host เป็นกรรมการ + 2 ผู้เล่น) |
| ระยะเวลา | ~10-15 นาที |
| ประเภท | Party — Host เป็นกรรมการ |

**กลไก**: Host เป็นผู้ตัดสิน (ไม่เล่น) บอกหมวด ผู้เล่นพูดคำที่เข้าหมวด Host กด ถูก/ผิด สุ่มระเบิด 10-25 วินาที มี 3 ชีวิต คนสุดท้ายชนะ  
**Phases**: `waiting` → `playing` → `roundEnd` → `finished`  
**Firebase gameData**:
```
{ phase, category, currentTurnIndex, turnOrder, lives: {}, bombTime, 
  turnStartedAt, usedCategories, roundNumber, eliminated }
```

---

### 10. ไม่เคย... (Never Have I Ever) — `neverhaveiever`

| Property | Value |
|----------|-------|
| ผู้เล่นขั้นต่ำ | 2 คน |
| ระยะเวลา | ~5 นาที (15 รอบ × 20 วินาที) |
| ประเภท | Party + Competition |

**กลไก**: 15 รอบ อ่านประโยค "ไม่เคย..." ผู้เล่นโหวต "เคย" (เสียชีวิต 1) หรือ "ไม่เคย" (ปลอดภัย) เริ่ม 5 ชีวิต ชนะ = เหลือชีวิตมากสุด  
**Phases**: `waiting` → `playing` → `results` → `finished`  
**Data**: ~75 ประโยค (ระดับ light/medium/intense)  
**Firebase gameData**:
```
{ phase, currentRound, totalRounds(15), statement, usedStatements, 
  votes: {[player]: 'ever'|'never'}, lives, votingStartedAt, history }
```

---

### 11. ใบ้คำ (Taboo) — `taboo`

| Property | Value |
|----------|-------|
| ผู้เล่นขั้นต่ำ | 2 คน |
| ระยะเวลา | ~10 นาที |
| ประเภท | Competition |

**กลไก**: ผลัดกันเป็นผู้ใบ้คำ เห็นคำลับ + 5 คำต้องห้าม ใบ้ให้คนอื่นทาย ทายถูก = ผู้ใบ้ +3, คนทายถูก +1 ข้าม max 2 ครั้ง 60 วินาทีต่อรอบ  
**Phases**: `waiting` → `choosing` → `playing` → `roundEnd` → `finished`  
**Data**: 199 cards (สัตว์, อาหาร, สถานที่, กีฬา, ตัวละคร, สิ่งของ, ธรรมชาติ, concept, วัฒนธรรมไทย, pop culture, Gen Z, ฮา)  
**Host config**: Card mode — 'all', 'normal' (ไพ่ 1-132), 'funny' (ไพ่ 133+)  
**Firebase gameData**:
```
{ phase, currentDescriberIndex, describerOrder, currentCard, scores, 
  roundStartedAt, round, totalRounds, usedWords, skipsUsed, correctGuesser, cardMode }
```

---

### 12. คำนวณเร็ว (Math Race) — `mathrace`

| Property | Value |
|----------|-------|
| ผู้เล่นขั้นต่ำ | 2 คน |
| ระยะเวลา | ~3 นาที (10 ข้อ × 15 วินาที) |
| ประเภท | Competition |

**กลไก**: 10 โจทย์คณิตศาสตร์ 15 วินาทีต่อข้อ พิมพ์ตัวเลขตอบ คะแนน = เวลาที่เหลือ (ถ้าถูก)  
**Phases**: `waiting` → `playing` → `results` → `finished`  
**Host config**: ระดับความยาก (easy/medium/hard)  
**Firebase gameData**:
```
{ phase, difficulty, questions, currentQuestion, questionStartedAt, 
  answers: {[qIdx]: {[player]: {answer, correct, points, answeredAt}}}, scores }
```

---

### 13. Insider (Twenty Questions) — `twentyquestions`

| Property | Value |
|----------|-------|
| ผู้เล่นขั้นต่ำ | 3 คน (Host เป็นกรรมการ + 2 ผู้เล่น) |
| ระยะเวลา | 5-10 นาทีต่อรอบ |
| ประเภท | Social Deduction — Host เป็นกรรมการ |

**กลไก**: Host รู้คำลับ + Insider 1 คนรู้คำลับ (แต่ต้องแกล้งไม่รู้) ผู้เล่นถามคำถาม ใช่/ไม่ใช่ เพื่อทายคำ ถ้าทายถูก → โหวตหา Insider  
**Phases**: `waiting` → `reveal` → `discussion` → `voting` → `result` → `finished`  
**Player Roles**: Moderator (Host), Insider (ลับ), Common Players  
**Timer**: Discussion 5/8/10 นาที (ปรับได้), Voting 180s  
**Rounds**: = จำนวนผู้เล่น (ไม่รวม Host)  
**Scoring**:
- หมดเวลา (ไม่มีใครทายถูก): Insider +3
- ทายถูก + จับ Insider ได้: ผู้เล่นอื่น +2, คนทายถูก +3
- ทายถูก + Insider หนีรอด: Insider +3

**Host config**:
- เลือกหมวดหมู่คำ (multi-select): สัตว์, อาหาร, สถานที่, บุคคล, สิ่งของ, กีฬา, ภาพยนตร์, ปั่นๆ ฮาๆ
- เวลาสนทนา: 5/8/10 นาที
- แสดง/ซ่อนหมวดหมู่ระหว่างเล่น

**Data (insiderData.js)**: 198 คำ ใน 8 หมวด (20 คำต่อหมวด, ยกเว้น "ปั่นๆ ฮาๆ" มี 38 คำ)  
**Firebase gameData**:
```
{ phase, secretWord, category, insider, roundNumber, scores, usedWords, 
  wordGuessed, guesser, votes, timerEnd, discussionTime, showCategory, 
  filterCategories, caughtInsider, topVoted }
```
**หมายเหตุ**: Insider สามารถเป็นซ้ำได้ ไม่จำเป็นต้องเป็นทุกคน (pure random)

---

### 14. ศิลปินปลอม (Fake Artist) — `fakeartist`

| Property | Value |
|----------|-------|
| ผู้เล่นขั้นต่ำ | 3 คน |
| ระยะเวลา | 5-15 นาที |
| ประเภท | Social Deduction + Drawing |

**กลไก**: ทุกคนวาดรูปร่วมกันบน canvas เดียว ศิลปินปลอม 1 คนไม่รู้คำ วาดทีละคน (1 stroke ต่อเทิร์น) จบทุกรอบ → โหวตหาปลอม ถ้าจับได้ ปลอมทายคำ — ถ้าถูกก็ยังชนะ  
**Phases**: `waiting` → `reveal` → `drawing` → `voting` → `fake_guess` → `finished`  
**Timer**: 10/15/30 วินาทีต่อเทิร์น (ปรับได้)  
**Rounds**: 2/3/4 รอบ (ปรับได้)  
**Starting turn**: สุ่มตำแหน่งเริ่มต้น  
**Win Conditions**:
- `artists_win`: จับปลอมได้ + ปลอมทายคำผิด
- `fake_wins`: โหวตผิดคน
- `fake_guessed`: จับปลอมได้ แต่ปลอมทายคำถูก (ปลอมชนะ)

**Host config**:
- แหล่งคำ: สุ่ม, เลือกหมวด (สัตว์/อาหาร/สถานที่/สิ่งของ/ยานพาหนะ/แฟนตาซี), หรือพิมพ์เอง
- เวลาวาดต่อเทิร์น: 10s / 15s / 30s
- จำนวนรอบ: 2 / 3 / 4

**Firebase gameData**:
```
{ phase, secretWord, fakeArtist, turnOrder, currentTurnIndex, currentRound, 
  turnTime, totalRounds, paths: [{color, points: [{x,y}]}], votes, 
  colorMap: {[player]: color}, voteResult, fakeGuess, turnStartedAt }
```

---

## Deployment

### Commands

```bash
npm run dev        # Vite dev server → http://localhost:5173/partyhub/
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
npm run deploy     # Build + deploy to GitHub Pages
```

### GitHub Pages Setup

- Branch: `gh-pages` (auto-created by `gh-pages` package)
- Source: Deploy from branch → `gh-pages` / `/ (root)`
- `.nojekyll` file required (otherwise GitHub Pages ignores files starting with `_` or `.`)
- `--dotfiles` flag in deploy script ensures `.nojekyll` is included

### PWA

- `manifest: false` in vite-plugin-pwa (uses static `public/manifest.json`)
- `registerType: 'autoUpdate'` — auto-updates SW without prompt
- Workbox precaches all static assets
- Runtime caching for Google Fonts (CacheFirst, 1 year)
- `navigateFallback: 'index.html'` for SPA routing

---

## Vite Build Configuration

```javascript
// Manual chunks for optimal loading
manualChunks(id) {
  if (id.includes('firebase')) return 'firebase';        // ~249KB
  if (id.includes('react') || id.includes('framer-motion')) return 'vendor';  // ~358KB
}

// Browser targets
target: ['es2020', 'chrome80', 'safari14', 'firefox80']

// Base path for GitHub Pages subdirectory
base: '/partyhub/'
```

---

## UI/UX Design

### Color Palette (Nature Theme)

- **Olive**: Primary text, dark elements
- **Sage**: Primary brand color, buttons, accents
- **Cream**: Backgrounds, cards
- **Warm**: Warnings, highlights
- **Bark**: Secondary, muted elements

### Typography

- **Display/Headers**: Mali (Thai handwriting style)
- **Body**: Nunito (clean, rounded)

### Design Principles

- Mobile-first (designed for phone party play)
- Large touch targets (min 42px height for buttons)
- Rounded corners (2xl-4xl border-radius)
- Soft shadows (olive-tinted)
- Haptic + audio feedback on interactions
- Confetti animation on game finish
- Smooth transitions with Framer Motion

### Responsive

- Max width container: 460px
- Full-screen on mobile
- Virtual keyboard handling via `useKeyboardResize`

---

## Session & Reconnection

### Session Storage

```javascript
saveSession(roomId, nickname)   // Save to localStorage
clearSession()                  // Clear on leave/kick
```

### ReconnectBanner

- Detects stored session on app load
- Shows reconnect option if room still exists
- Auto-clears if room is gone

---

## Room Lifecycle

1. **Create**: Home → generate code → write to Firebase → navigate to Lobby
2. **Join**: Home → enter code → add player → navigate to Lobby
3. **Lobby**: Wait for players → Host selects game → Start
4. **Playing**: GameRoom lazy-loads game component → play → finish
5. **Back to Lobby**: Host ends game → status: 'waiting' → redirect all to Lobby
6. **Cleanup**: Probabilistic (33%) room deletion for old rooms (>24h)

---

## Security

- Firebase rules: `auth != null` on all paths
- Rate limiting prevents room spam
- No sensitive data in client (anonymous auth only)
- Room codes are short-lived, not guessable at scale
- Host-only actions validated by client (Firebase rules could enforce server-side)

---

## Error Handling

- `ErrorBoundary` component catches React crashes
- `OfflineIndicator` shows when network is down
- `ConnectionIndicator` shows connection quality
- Toast messages for action errors (3s auto-dismiss)
- Firebase operations wrapped in try/catch with user-facing error toasts

---

## Performance Optimizations

- Lazy-loaded game components (code splitting)
- Manual chunks (firebase ~249KB, vendor ~358KB, games ~27-58KB each)
- Firebase listeners cleaned up on unmount
- Workbox precaching for instant repeat loads
- No external audio files (Web Audio API synthesis)
- Canvas strokes stored as coordinate arrays (not images)
- Drawing strokes in separate Firebase path to reduce listener payload

---

## Development Notes

- All text is in Thai
- Lobby game list in `Lobby.jsx` must match routing in `GameRoom.jsx`
- `recordWin` gameId is always English (e.g., 'drawing', 'quiz', 'spyfall')
- manifest.json path warning in dev is benign (Vite base path doubling)
- iOS Safari requires non-passive touch listeners for canvas drawing
- GM-based games (werewolf, twentyquestions) block host transfer during gameplay

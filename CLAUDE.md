# Party Hub

Party game web app for playing with friends in real-time.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + Framer Motion
- **Routing**: React Router (HashRouter), base path `/partyhub/`
- **Backend**: Firebase Realtime Database + Anonymous Auth
- **Deployment**: GitHub Pages at `https://phoorinsinthong.github.io/partyhub/`
- **PWA**: vite-plugin-pwa with service worker

## Project Structure

```
src/
  pages/         Home.jsx, Lobby.jsx
  games/         One file per game (Drinking, Spyfall, TargetNumber, Werewolf, TruthOrDare, Quiz, Drawing, WouldYouRather, WordBomb, NeverHaveIEver, Taboo, MathRace, TwentyQuestions)
  components/    Shared UI (AvatarPicker, Scoreboard, PersonalStats, ReconnectBanner, etc.)
  hooks/         usePresence, usePlayerCleanup
  utils/         avatars, rateLimit, feedback, gameData files
  firebase.js    Firebase init + authReady promise
public/          Static assets, icons, favicon.svg (pixel Rockman style)
```

## Firebase

- Config via `.env` (VITE_FIREBASE_* vars)
- Anonymous auth required — rules enforce `auth != null` for all reads/writes
- `authReady` promise in `firebase.js` resolves after signInAnonymously (5s timeout)
- Database path: `rooms/{code}` with players, gameData, scores
- Room code: 4-char uppercase alphanumeric

## Key Patterns

- `recordWin(roomId, winnerName, gameId)` — gameId is always English (e.g. 'drawing', 'quiz', 'spyfall')
- Personal stats use `useEffect` watching game phase === 'finished' with a `personalRecordedRef` guard to prevent double-recording
- `advancingRef` pattern prevents double-tap on async Firebase actions
- Room cleanup: probabilistic (33% of clients) + age-based + host disconnect detection
- Rate limiting: 3 room creates per 60s, 5 joins per 60s

## Games (13 total)

drinking, spyfall, target, werewolf, truthordare, quiz, drawing, wouldyourather, wordbomb, neverhaveiever, taboo, mathrace, twentyquestions

## Dev Commands

```bash
npm run dev        # Vite dev server at http://localhost:5173/partyhub/
npm run build      # Production build to dist/
npm run preview    # Preview production build
npm run deploy     # Build + deploy to GitHub Pages
```

## Notes

- All UI text is in Thai
- Lobby game list in `src/pages/Lobby.jsx` must match game component routing in App.jsx
- Drawing game has custom mode where drawer types their own word
- manifest.json path warning in dev is benign (Vite base path doubling)

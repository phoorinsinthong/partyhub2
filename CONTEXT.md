# Context: Party Hub

Party Hub is a real-time multiplayer party game platform.

## Domain Language

- **Room**: A game instance identified by a 4-character uppercase alphanumeric code.
- **Player**: A user in a room, authenticated anonymously via Firebase.
- **Host**: The player who created the room or took over host duties.
- **Game**: A specific activity (e.g., Spyfall, Drawing, Quiz) played within a room.
- **Phase**: The current state of a game (e.g., 'lobby', 'playing', 'finished').
- **Score**: Points earned by players across different games.
- **Personal Stats**: Persistent player data (wins, games played) stored in the player's local state and potentially Firebase.

## Architecture

- **Frontend-Only**: No custom backend server; logic runs in the client.
- **Real-time Synchronization**: Powered by Firebase Realtime Database.
- **State Management**: React state synced with Firebase refs.
- **PWA**: Offline-capable with service workers.

## Key Constraints

- **Thai UI**: All user-facing text must be in Thai.
- **Anonymous Auth**: Users are not required to create accounts.
- **Ephemeral Rooms**: Rooms and their data are cleaned up periodically.

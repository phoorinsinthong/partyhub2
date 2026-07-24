export interface Player {
  role: string;
  place: string;
  isSpy: boolean;
  isAccomplice: boolean;
  spyName: string;
  votedFor: string;
  wantsToVote: boolean;
}

export interface GameData {
  status: 'waiting' | 'playing' | 'voting' | 'finished';
  targetPlace: string;
  placeCategory: string;
  timerEnd: number | null;
  players: Record<string, Player>;
  allPlaces: string[];
  spyRevealing: string | null;
  spyForced: boolean;
  winner: 'Spy' | 'Civilians' | null;
  guess: string | null;
  enableAccomplice: boolean;
}

// Helper: Shuffle array
export const shuffle = <T>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// Generate initial game state for a new game
export const generateInitialState = (
  playerList: string[],
  pool: { n: string; r: string[] }[],
  placeCategory: string,
  timerMinutes: number,
  enableAccomplice: boolean
): GameData => {
  const targetPlace = pool[Math.floor(Math.random() * pool.length)];
  const shuffledPlayers = shuffle(playerList);

  const spyId = shuffledPlayers[0];
  let accompliceId: string | null = null;
  
  if (enableAccomplice && playerList.length >= 4) {
    accompliceId = shuffledPlayers[1];
  }

  const availableRoles = shuffle([...targetPlace.r]);
  const gamePlayers: Record<string, Player> = {};

  playerList.forEach((pid) => {
    if (pid === spyId) {
      gamePlayers[pid] = {
        role: 'Spy',
        place: '',
        isSpy: true,
        isAccomplice: false,
        spyName: '',
        votedFor: '',
        wantsToVote: false
      };
    } else if (pid === accompliceId) {
      gamePlayers[pid] = {
        role: 'Accomplice',
        place: '???',
        isSpy: false,
        isAccomplice: true,
        spyName: spyId,
        votedFor: '',
        wantsToVote: false
      };
    } else {
      const roleName = availableRoles.pop() || 'Civilian';
      gamePlayers[pid] = {
        role: roleName,
        place: targetPlace.n,
        isSpy: false,
        isAccomplice: false,
        spyName: '',
        votedFor: '',
        wantsToVote: false
      };
    }
  });

  return {
    status: 'playing',
    targetPlace: targetPlace.n,
    placeCategory: placeCategory || 'Other',
    timerEnd: Date.now() + timerMinutes * 60 * 1000,
    players: gamePlayers,
    allPlaces: pool.map(p => p.n).sort(),
    spyRevealing: null,
    spyForced: false,
    winner: null,
    guess: null,
    enableAccomplice: enableAccomplice && playerList.length >= 4
  };
};

export const checkVoteResult = (players: Record<string, Player>, playerCount: number): { winner: 'Civilians' | null, forcedSpy: boolean } | null => {
  const gamePlayerList = Object.keys(players);
  const allVoted = gamePlayerList.every(p => players[p]?.votedFor);
  
  if (!allVoted) return null;

  const voteCounts: Record<string, number> = {};
  gamePlayerList.forEach(p => {
    const target = players[p].votedFor;
    if (target) {
      voteCounts[target] = (voteCounts[target] || 0) + 1;
    }
  });

  let maxVotes = 0;
  let maxTarget: string | null = null;
  Object.entries(voteCounts).forEach(([target, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      maxTarget = target;
    }
  });

  const spyName = gamePlayerList.find(p => players[p].isSpy);
  const majority = Math.ceil(playerCount / 2);

  if (maxTarget === spyName && maxVotes >= majority) {
    return { winner: 'Civilians', forcedSpy: false };
  } else {
    return { winner: null, forcedSpy: true };
  }
};

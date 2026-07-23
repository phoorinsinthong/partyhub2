import { lazy } from 'react';

export const GAME_COMPONENTS: Record<string, React.LazyExoticComponent<any>> = {
  drinking: lazy(() => import('../games/drinkingGame')),
  spyfall: lazy(() => import('../games/spyfall')),
  target: lazy(() => import('../games/targetNumber')),
  werewolf: lazy(() => import('../games/werewolf')),
  werewolf_physical: lazy(() => import('../games/werewolf')),
  truthordare: lazy(() => import('../games/truthOrDare')),
  quiz: lazy(() => import('../games/quiz')),
  drawing: lazy(() => import('../games/drawing')),
  wouldyourather: lazy(() => import('../games/wouldYouRather')),
  wordbomb: lazy(() => import('../games/wordBomb')),
  neverhaveiever: lazy(() => import('../games/neverHaveIEver')),
  taboo: lazy(() => import('../games/taboo')),
  mathrace: lazy(() => import('../games/mathRace')),
  twentyquestions: lazy(() => import('../games/twentyQuestions')),
  fakeartist: lazy(() => import('../games/fakeArtist')),
  blackjack: lazy(() => import('../games/blackjack')),
  slaves: lazy(() => import('../games/slaves')),
  poker: lazy(() => import('../games/poker')),
  pokdeng: lazy(() => import('../games/pokDeng')),
};

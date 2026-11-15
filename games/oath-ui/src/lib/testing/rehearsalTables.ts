import { localGames, rehearsal } from '@tabletop/oath/testing'
import type { PlayedTable } from './sessionHarness.js'

// The chronicle rehearsal's own states, made by the same local steps its spec takes: "The long
// table" played to Dana's win and chronicled, game 2 opened by Continue with Bea joining, Dana's
// first Search, and game 3 continued from the pinned finished game 2.

type LocalPlay = ReturnType<typeof localGames.playStep>

function tableOfPlay({ game, state, actions }: LocalPlay): PlayedTable {
    return {
        state,
        actions,
        names: Object.fromEntries(game.players.map((player) => [player.id, player.name]))
    }
}

async function gameTwo(): Promise<LocalPlay> {
    const store: localGames.LocalGameStore = new Map()
    await rehearsal.playGameOne(store)
    return rehearsal.continueGameOne(store)
}

/** Game 1 at its result: Dana's win, the chronicle written with the story. */
export async function rehearsalResult(): Promise<PlayedTable> {
    const { finished } = await rehearsal.playGameOne(new Map())
    return tableOfPlay(finished)
}

/** Game 2 as Continue opens it, waiting on Dana's setup choice. */
export async function rehearsalOpen(): Promise<PlayedTable> {
    return tableOfPlay(await gameTwo())
}

/** Game 2 at Dana's first Search, the drawn card waiting to be placed. */
export async function rehearsalSearch(): Promise<PlayedTable> {
    return tableOfPlay(rehearsal.chancellorSearches(rehearsal.setUp(await gameTwo())))
}

/** Game 3 as Continue opens it from the pinned finished game 2. */
export async function rehearsalPinnedOpen(): Promise<PlayedTable> {
    return tableOfPlay(await rehearsal.continuePinned(new Map()))
}

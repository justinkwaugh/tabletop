import { assertExists, type GameAction } from '@tabletop/common'
import { isScoreGame, type ScoreGameMetadata } from '../actions/scoreGame.js'
import { LastEpoch } from '../data/tracks.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { tableAtPlayingCards, type Table } from './table.js'

/** R-6.2 What `ScoreGame` recorded in a cascade. */
export function scoredIn(processed: readonly GameAction[]): ScoreGameMetadata {
    const action = processed.find((row) => isScoreGame(row))
    assertExists(action?.metadata, 'R-6.2 The game was scored')
    return action.metadata
}

/** R-6.2 One seat's row of the final sheet. */
export function rowOf(metadata: ScoreGameMetadata, playerId: string) {
    const row = metadata.sheet.find((entry) => entry.playerId === playerId)
    assertExists(row, `R-6.2 ${playerId} has a row`)
    return row
}

export interface ScoredTable {
    readonly table: Table
    readonly order: readonly string[]
    readonly action: GameAction
    readonly metadata: ScoreGameMetadata
}

/** R-6.2 `ScoreGame` alone, from what `edit` sets: no dawn moves the scores it sees. */
export function scoreFrom(
    edit: (state: HydratedFeudumGameState, order: readonly string[]) => void,
    numPlayers = 3
): ScoredTable {
    const table = tableAtPlayingCards(() => ({ cards: ['move'] }), numPlayers)
    const order = [...table.order]
    table.moveTo((state) => {
        edit(state, order)
        state.epoch = LastEpoch
        return MachineState.EndOfRound
    })
    const processed = table.sendSystem({ type: ActionType.ScoreGame, revealsInfo: true })
    const [action] = processed
    return { table, order, action, metadata: scoredIn(processed) }
}

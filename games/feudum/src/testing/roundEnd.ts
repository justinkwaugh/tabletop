import { assertExists, type GameAction } from '@tabletop/common'
import { RegionIds, type RegionId, type TileEpoch } from '../data/regionTiles.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { removeTopTile, stackTop } from '../model/regionStacks.js'
import type { Table } from './table.js'

export type StackShowing = TileEpoch | 'V'

/** R-4.3.1 One entry per region, left to right; each stack only ever gets shorter. */
export function showOnStacks(state: HydratedFeudumGameState, tops: readonly StackShowing[]): void {
    RegionIds.forEach((region, index) => {
        const showing = tops[index]
        for (
            let top = stackTop(state, region);
            top && (showing === 'V' || top.epoch < showing);
            top = stackTop(state, region)
        ) {
            removeTopTile(state, region)
        }
    })
}

/** R-3.2 Every seat forfeits what it holds; returns what the last card set off. */
/** R-4.3.1 */
export function firstEpochRegions(state: HydratedFeudumGameState): RegionId[] {
    return RegionIds.filter((id) => stackTop(state, id)?.epoch === 1)
}

export function playOutCards(table: Table): GameAction[] {
    let processed: GameAction[] = []
    while (table.state.machineState === MachineState.PlayingCards) {
        const playerId = table.asked
        const kind = table.seat(playerId).hand?.[0]
        assertExists(kind, 'R-3.2 The seat asked holds a card')
        processed = table.send(playerId, { type: ActionType.ForfeitCard, kind })
    }
    return processed
}

export function typesOf(processed: readonly GameAction[]): string[] {
    return processed.map((action) => action.type)
}

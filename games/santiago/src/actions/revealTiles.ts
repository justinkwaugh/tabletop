import * as Type from 'typebox'
import { GameAction, HydratableAction, assertExists } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { tilesPerRound } from '../util/tileBag.js'

export type RevealTiles = Type.Static<typeof RevealTiles>
export const RevealTiles = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RevealTiles),
            playerId: Type.String()
        })
    ])
)

export const RevealTilesValidator = Compile(RevealTiles)

export function isRevealTiles(action: GameAction): action is RevealTiles {
    return action.type === ActionType.RevealTiles
}

// The round's first bidder turns over this round's planting tiles. Keeping the draw as a
// deliberate player step, rather than part of the round rollover, leaves the previous
// round's final actions undoable until someone has actually seen the new tiles.
export class HydratedRevealTiles
    extends HydratableAction<typeof RevealTiles>
    implements RevealTiles
{
    declare type: ActionType.RevealTiles
    declare playerId: string

    constructor(data: RevealTiles) {
        super(data, RevealTilesValidator)
    }

    apply(state: HydratedSantiagoGameState) {
        if (!HydratedRevealTiles.canRevealTiles(state, this.playerId)) {
            throw new Error('Invalid RevealTiles action')
        }
        state.revealedTiles = Array.from({ length: tilesPerRound(state.players.length) }, () => {
            const tile = state.drawTile()
            assertExists(tile, 'The tile bag holds a whole round when tiles are revealed')
            return tile
        })
        this.revealsInfo = true
    }

    static canRevealTiles(state: HydratedSantiagoGameState, playerId: string): boolean {
        return state.machineState === MachineState.TileReveal && playerId === state.biddingOrder[0]
    }
}

import * as Type from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { anyLegalWallPlacement } from '../util/resolutionHelpers.js'

export type PassMetadata = Type.Static<typeof PassMetadata>
export const PassMetadata = Type.Object({
    // Set when the player had no legal placement left rather than choosing to stop. The
    // engine already skips a wall phase that was never possible at all (see
    // resolveBandForWinner's noLegalWallSpots), but a board can also fill up MID-phase -
    // place your first wall and the second may have nowhere to go. That still arrives as a
    // Pass, and without this history would report it as "declining to place any more",
    // which credits the player with a choice they never had.
    noLegalPlacement: Type.Optional(Type.Boolean())
})

export type Pass = Type.Static<typeof Pass>
export const Pass = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.Pass),
            metadata: Type.Optional(PassMetadata)
        })
    ])
)

export const PassValidator = Compile(Pass)

export function isPass(action?: GameAction): action is Pass {
    return action?.type === ActionType.Pass
}

// Shared across PlacingWalls/PlacingKnights - lets the winner of a border or knight
// action voluntarily stop early instead of being forced to place their full
// allotment. Rulebook phrasing is "may place as many... as shown" / "may either place
// a knight... or extend a region" (never "must") - stopping early is expected, not
// just a byproduct of running out of walls/knights/money. No state change of its own;
// each state handler's onAction drives the transition back to ResolvingActions.
export class HydratedPass extends HydratableAction<typeof Pass> implements Pass {
    declare type: ActionType.Pass
    declare metadata?: PassMetadata

    constructor(data: Pass) {
        super(data, PassValidator)
    }

    apply(state: HydratedLowenherzGameState) {
        // No state change of its own - the state handler drives the transition. This only
        // records WHY the pass happened, while the board is still in the phase being left.
        // Pass leaves playerId optional (it's the one action that doesn't redeclare it as
        // required), so it has to be narrowed before the legality check will take it.
        const playerId = this.playerId
        if (
            playerId &&
            state.machineState === MachineState.PlacingWalls &&
            state.wallPlacingPlayerId === playerId &&
            !anyLegalWallPlacement(state, playerId)
        ) {
            this.metadata = { noLegalPlacement: true }
        }
    }
}

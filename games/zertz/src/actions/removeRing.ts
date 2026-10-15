import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedZertzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Ring } from '../model/board.js'

export type RemoveRingMetadata = Type.Static<typeof RemoveRingMetadata>
export const RemoveRingMetadata = Type.Object({
    claimedRings: Type.Array(Ring)
})

export type RemoveRing = Type.Static<typeof RemoveRing>
export const RemoveRing = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RemoveRing),
            playerId: Type.String(),
            coords: AxialCoordinates,
            metadata: Type.Optional(RemoveRingMetadata)
        })
    ])
)

export const RemoveRingValidator = Compile(RemoveRing)

export function isRemoveRing(action?: GameAction): action is RemoveRing {
    return action?.type === ActionType.RemoveRing
}

export class HydratedRemoveRing extends HydratableAction<typeof RemoveRing> implements RemoveRing {
    declare type: ActionType.RemoveRing
    declare playerId: string
    declare coords: AxialCoordinates
    declare metadata?: RemoveRingMetadata

    constructor(data: RemoveRing) {
        super(data, RemoveRingValidator)
    }

    apply(state: HydratedZertzGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid RemoveRing action')
        }
        state.board.removeRing(this.coords)
        const claimedRings = structuredClone(state.claimFullGroups(this.playerId))
        state.concludeMove(this.playerId)
        this.metadata = { claimedRings }
    }

    isValid(state: HydratedZertzGameState): boolean {
        return state.board.isFree(this.coords)
    }
}

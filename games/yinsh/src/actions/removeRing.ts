import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedYinshGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { isPoint } from '../model/geometry.js'

export type RemoveRingMetadata = Type.Static<typeof RemoveRingMetadata>
export const RemoveRingMetadata = Type.Object({
    ringsRemoved: Type.Integer({ minimum: 1 }),
    won: Type.Boolean()
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

// Rule G3: each row taken costs the player one ring of their choice.
export class HydratedRemoveRing extends HydratableAction<typeof RemoveRing> implements RemoveRing {
    declare type: ActionType.RemoveRing
    declare playerId: string
    declare coords: AxialCoordinates
    declare metadata?: RemoveRingMetadata

    constructor(data: RemoveRing) {
        super(data, RemoveRingValidator)
    }

    apply(state: HydratedYinshGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid RemoveRing action')
        }
        const ringsRemoved = state.removeRing(this.playerId, this.coords)
        this.metadata = { ringsRemoved, won: state.hasWon(this.playerId) }
    }

    isValid(state: HydratedYinshGameState): boolean {
        return (
            isPoint(this.coords) &&
            state.resolvingPlayerIds[0] === this.playerId &&
            state.board.ringAt(this.coords) === this.playerId
        )
    }
}

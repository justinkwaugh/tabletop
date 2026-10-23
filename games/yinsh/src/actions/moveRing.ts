import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedYinshGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { isPoint } from '../model/geometry.js'

export type MoveRingMetadata = Type.Static<typeof MoveRingMetadata>
export const MoveRingMetadata = Type.Object({
    flipped: Type.Array(AxialCoordinates)
})

export type MoveRing = Type.Static<typeof MoveRing>
export const MoveRing = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MoveRing),
            playerId: Type.String(),
            from: AxialCoordinates,
            to: AxialCoordinates,
            metadata: Type.Optional(MoveRingMetadata)
        })
    ])
)

export const MoveRingValidator = Compile(MoveRing)

export function isMoveRing(action?: GameAction): action is MoveRing {
    return action?.type === ActionType.MoveRing
}

export class HydratedMoveRing extends HydratableAction<typeof MoveRing> implements MoveRing {
    declare type: ActionType.MoveRing
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare metadata?: MoveRingMetadata

    constructor(data: MoveRing) {
        super(data, MoveRingValidator)
    }

    apply(state: HydratedYinshGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid MoveRing action')
        }
        const move = state.moveRing(this.playerId, this.from, this.to)
        this.metadata = { flipped: structuredClone(move.jumped) }
    }

    isValid(state: HydratedYinshGameState): boolean {
        return (
            isPoint(this.from) &&
            isPoint(this.to) &&
            state.markersInPool() > 0 &&
            state.board.ringAt(this.from) === this.playerId &&
            state.board.findMove(this.from, this.to) !== undefined
        )
    }
}

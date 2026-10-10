import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Face } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { MoveOrder } from '../model/attack.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { executeMove } from '../model/movement.js'
import { Position, faceOf } from '../model/pieces.js'

export type MoveMetadata = Type.Static<typeof MoveMetadata>
export const MoveMetadata = Type.Object({
    from: Type.Optional(Position),
    revealed: Type.Optional(Type.Array(Face)),
    frenchMoraleGain: Type.Optional(Type.Integer())
})

export type Move = Type.Static<typeof Move>
export const Move = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Move),
            playerId: Type.String(),
            metadata: Type.Optional(MoveMetadata),
            order: MoveOrder,
            to: Position
        })
    ])
)

export const MoveValidator = Compile(Move)

export function isMove(action?: GameAction): action is Move {
    return action?.type === ActionType.Move
}

export class HydratedMove extends HydratableAction<typeof Move> implements Move {
    declare type: ActionType.Move
    declare playerId: string
    declare metadata?: MoveMetadata
    declare order: MoveOrder
    declare to: Position

    constructor(data: Move) {
        super(data, MoveValidator)
    }

    apply(state: HydratedNapoleonsTriumphGameState) {
        const outcome = executeMove(state, this.playerId, this.order, this.to)
        this.metadata = {
            from: outcome.from,
            revealed: outcome.revealedCavalry
                ? this.order.unitIds.map((id) => faceOf(state.unit(id)))
                : undefined,
            frenchMoraleGain: outcome.frenchMoraleGain > 0 ? outcome.frenchMoraleGain : undefined
        }
    }
}

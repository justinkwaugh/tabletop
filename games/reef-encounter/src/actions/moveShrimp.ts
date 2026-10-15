import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { ReefSquare } from '../model/reef.js'

// Action 5: any number of times a turn, a shrimp on the reef moves to another square,
// or back to the supply when no square is given.
export type MoveShrimp = Type.Static<typeof MoveShrimp>
export const MoveShrimp = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MoveShrimp),
            playerId: Type.String(),
            from: ReefSquare,
            to: Type.Optional(ReefSquare)
        })
    ])
)

export const MoveShrimpValidator = Compile(MoveShrimp)

export function isMoveShrimp(action?: GameAction): action is MoveShrimp {
    return action?.type === ActionType.MoveShrimp
}

export class HydratedMoveShrimp extends HydratableAction<typeof MoveShrimp> implements MoveShrimp {
    declare type: ActionType.MoveShrimp
    declare playerId: string
    declare from: ReefSquare
    declare to?: ReefSquare

    constructor(data: MoveShrimp) {
        super(data, MoveShrimpValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        state.moveShrimp(this.playerId, this.from, this.to)
    }
}

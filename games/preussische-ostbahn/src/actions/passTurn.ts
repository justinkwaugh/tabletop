import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedOstbahnGameState } from '../model/gameState.js'

export type PassTurn = Type.Static<typeof PassTurn>
export const PassTurn = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassTurn),
            playerId: Type.String()
        })
    ])
)

export const PassTurnValidator = Compile(PassTurn)

export function isPassTurn(action?: GameAction): action is PassTurn {
    return action?.type === ActionType.PassTurn
}

export class HydratedPassTurn extends HydratableAction<typeof PassTurn> implements PassTurn {
    declare type: ActionType.PassTurn
    declare playerId: string

    constructor(data: PassTurn) {
        super(data, PassTurnValidator)
    }

    apply(state: HydratedOstbahnGameState, _context?: MachineContext) {
        assert(state.isSlotPlayer(this.playerId), 'It is not your turn')
    }

    static canPass(state: HydratedOstbahnGameState, playerId: string): boolean {
        return state.isSlotPlayer(playerId)
    }
}

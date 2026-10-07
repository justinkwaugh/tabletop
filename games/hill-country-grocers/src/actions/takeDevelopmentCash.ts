import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedHcgGameState } from '../model/gameState.js'

export const DEVELOPMENT_CASH = 1

export type TakeDevelopmentCash = Type.Static<typeof TakeDevelopmentCash>
export const TakeDevelopmentCash = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.TakeDevelopmentCash),
            playerId: Type.String()
        })
    ])
)

export const TakeDevelopmentCashValidator = Compile(TakeDevelopmentCash)

export function isTakeDevelopmentCash(action?: GameAction): action is TakeDevelopmentCash {
    return action?.type === ActionType.TakeDevelopmentCash
}

export class HydratedTakeDevelopmentCash
    extends HydratableAction<typeof TakeDevelopmentCash>
    implements TakeDevelopmentCash
{
    declare type: ActionType.TakeDevelopmentCash
    declare playerId: string

    constructor(data: TakeDevelopmentCash) {
        super(data, TakeDevelopmentCashValidator)
    }

    apply(state: HydratedHcgGameState, _context?: MachineContext) {
        assert(HydratedTakeDevelopmentCash.canTake(state), 'Place one marker first')
        state.getPlayerState(this.playerId).cash += DEVELOPMENT_CASH
    }

    static canTake(state: HydratedHcgGameState): boolean {
        return state.turnDevelopments.length === 1
    }
}

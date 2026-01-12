import { GameAction, HydratableAction, assert } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedContainerGameState } from '../model/gameState.js'
import { LOAN_AMOUNT, MAX_LOANS } from '../definition/constants.js'

export type TakeLoan = Static<typeof TakeLoan>
export const TakeLoan = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.TakeLoan),
            playerId: Type.String()
        })
    ])
)

export const TakeLoanValidator = Compile(TakeLoan)

export function isTakeLoan(action: GameAction): action is TakeLoan {
    return action.type === ActionType.TakeLoan
}

export class HydratedTakeLoan extends HydratableAction<typeof TakeLoan> implements TakeLoan {
    declare type: ActionType.TakeLoan
    declare playerId: string

    constructor(data: TakeLoan) {
        super(data, TakeLoanValidator)
    }

    apply(state: HydratedContainerGameState): void {
        const player = state.getPlayerState(this.playerId)
        assert(player.loans < MAX_LOANS, 'Maximum loans reached')
        player.loans += 1
        player.money += LOAN_AMOUNT
    }

    static canTake(state: HydratedContainerGameState, playerId: string): boolean {
        const player = state.getPlayerState(playerId)
        return player.loans < MAX_LOANS
    }
}

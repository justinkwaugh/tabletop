import { GameAction, HydratableAction, assert } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedContainerGameState } from '../model/gameState.js'
import { LOAN_AMOUNT } from '../definition/constants.js'

export type RepayLoan = Static<typeof RepayLoan>
export const RepayLoan = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RepayLoan),
            playerId: Type.String()
        })
    ])
)

export const RepayLoanValidator = Compile(RepayLoan)

export function isRepayLoan(action: GameAction): action is RepayLoan {
    return action.type === ActionType.RepayLoan
}

export class HydratedRepayLoan extends HydratableAction<typeof RepayLoan> implements RepayLoan {
    declare type: ActionType.RepayLoan
    declare playerId: string

    constructor(data: RepayLoan) {
        super(data, RepayLoanValidator)
    }

    apply(state: HydratedContainerGameState): void {
        const player = state.getPlayerState(this.playerId)
        assert(player.loans > 0, 'No loans to repay')
        assert(state.interestPaidThisTurn, 'Must pay interest before repaying')
        assert(player.money >= LOAN_AMOUNT, 'Not enough money to repay loan')
        player.money -= LOAN_AMOUNT
        player.loans -= 1
    }

    static canRepay(state: HydratedContainerGameState, playerId: string): boolean {
        const player = state.getPlayerState(playerId)
        return state.interestPaidThisTurn && player.loans > 0 && player.money >= LOAN_AMOUNT
    }
}

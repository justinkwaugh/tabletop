import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { INTEREST_PER_LOAN, LOAN_AMOUNT } from '../components/costs.js'
import { ActionType } from '../definition/actions.js'
import { readSetup } from '../definition/setup.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import type { HydratedDickeKartoffelnPlayerState } from '../model/playerState.js'

export type LoanSettlement = Type.Static<typeof LoanSettlement>
export const LoanSettlement = Type.Object({
    playerId: Type.String(),
    repaid: Type.Number(),
    interest: Type.Number(),
    loansTaken: Type.Number()
})

export type EndYearMetadata = Type.Static<typeof EndYearMetadata>
export const EndYearMetadata = Type.Object({
    year: Type.Number(),
    final: Type.Boolean(),
    settlements: Type.Array(LoanSettlement)
})

export type EndYear = Type.Static<typeof EndYear>
export const EndYear = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.EndYear),
            metadata: Type.Optional(EndYearMetadata)
        })
    ])
)

export const EndYearValidator = Compile(EndYear)

export function isEndYear(action?: GameAction): action is EndYear {
    return action?.type === ActionType.EndYear
}

export class HydratedEndYear extends HydratableAction<typeof EndYear> implements EndYear {
    declare type: ActionType.EndYear
    declare metadata?: EndYearMetadata

    constructor(data: EndYear) {
        super(data, EndYearValidator)
    }

    apply(state: HydratedDickeKartoffelnGameState, context?: MachineContext) {
        assertExists(context, 'Ending a year needs the game configuration')
        const year = state.year()
        const final = year >= readSetup(context.gameConfig).years
        const settlements = state.players
            .map(settleLoans)
            .filter((settlement) => settlement.repaid + settlement.interest > 0)
        if (state.messages) {
            state.messages.current = undefined
        }
        state.years.endRound(state.actionCount)
        if (!final) {
            state.years.startRound(state.actionCount + 1)
        }
        this.metadata = { year, final, settlements }
    }
}

// Every bill of debt that can be redeemed must be; the rest cost 20% interest, which may itself
// be borrowed, with that interest due a year later.
function settleLoans(player: HydratedDickeKartoffelnPlayerState): LoanSettlement {
    const repaid = Math.min(player.loans, Math.floor(player.cash / LOAN_AMOUNT))
    player.loans -= repaid
    player.cash -= repaid * LOAN_AMOUNT
    const interest = player.loans * INTEREST_PER_LOAN
    const { loansTaken } = player.pay(interest)
    return { playerId: player.playerId, repaid, interest, loansTaken }
}

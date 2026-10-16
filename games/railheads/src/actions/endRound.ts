import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { CompanyRevenueChange, PayoutRates, PlayerIncome, payPlayers } from '../model/payouts.js'

export type EndRoundMetadata = Type.Static<typeof EndRoundMetadata>
export const EndRoundMetadata = Type.Object({
    round: Type.Number(),
    final: Type.Boolean(),
    rates: PayoutRates,
    income: Type.Array(PlayerIncome),
    obsolescence: Type.Array(CompanyRevenueChange),
    startPlayerId: Type.Optional(Type.String()),
    roundTimer: Type.Optional(Type.Number())
})

export type EndRound = Type.Static<typeof EndRound>
export const EndRound = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.EndRound),
            metadata: Type.Optional(EndRoundMetadata)
        })
    ])
)

export const EndRoundValidator = Compile(EndRound)

export function isEndRound(action?: GameAction): action is EndRound {
    return action?.type === ActionType.EndRound
}

export class HydratedEndRound extends HydratableAction<typeof EndRound> implements EndRound {
    declare type: ActionType.EndRound
    declare metadata?: EndRoundMetadata

    constructor(data: EndRound) {
        super(data, EndRoundValidator)
    }

    apply(state: HydratedRailheadsGameState, _context?: MachineContext) {
        const round = state.round()
        const rates = state.roundPayouts()
        const income = payPlayers(state, rates)
        state.rounds.endRound(state.actionCount)
        if (state.isFinalRound()) {
            this.metadata = { round, final: true, rates, income, obsolescence: [] }
            return
        }
        const startPlayerId = state.turnManager.nextPlayer(state.turnManager.turnOrder[0])
        state.turnManager.newFirstPlayer(startPlayerId)
        const obsolescence = state.companies.map((company) => {
            const from = company.revenue
            company.revenue = Math.max(0, from - state.edition.obsolescenceDrop(from))
            return { companyId: company.id, from, to: company.revenue }
        })
        for (const space of state.actionSpaces) {
            space.selections = 0
        }
        state.rounds.startRound(state.actionCount + 1)
        state.roundTimer = state.roundTimerSize(state.round())
        this.metadata = {
            round,
            final: false,
            rates,
            income,
            obsolescence,
            startPlayerId,
            roundTimer: state.roundTimer
        }
    }
}

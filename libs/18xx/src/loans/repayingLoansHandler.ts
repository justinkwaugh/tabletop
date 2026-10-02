import {
    ActionSource,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { controllingOwner } from '../finance/finance.js'
import {
    FinishOperatingTurn,
    finishOperatingTurnReason,
    isFinishOperatingTurn,
    type OperatingTurnState
} from '../operating/finishOperatingTurn.js'
import { nextOperatingCompany } from '../operating/operatingSet.js'
import { BetweenCompaniesState } from '../operating/operatingSteps.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { companyLoans, type LoanRules, type LoanState } from './loans.js'
import { PayInterest, isPayInterest } from './payInterest.js'
import { canRepayLoan, isRepayLoan } from './repayLoan.js'
import { canTakeLoan, isTakeLoan } from './takeLoan.js'

type State = HydratedGameState & OperatingTurnState & LoanState

/**
 * The turn's last step: interest is paid on entry, then the president repays or takes loans and
 * finishes the turn.
 */
export class RepayingLoansHandler implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly rules: LoanRules,
        private readonly trainRules: TrainRules
    ) {}

    private companyId(state: State): string {
        const companyId = nextOperatingCompany(state)
        assertExists(companyId, 'The loan step belongs to the operating company')
        return companyId
    }

    private decisions(state: State, playerId: string): string[] {
        const companyId = this.companyId(state)
        if (
            state.loanStep?.companyId !== companyId ||
            !state.activePlayerIds.includes(playerId) ||
            controllingOwner(state, companyId)?.playerId !== playerId
        )
            return []
        return [
            ...(canRepayLoan(state, this.rules, playerId, companyId) ? ['RepayLoan'] : []),
            ...(canTakeLoan(state, this.rules, playerId, companyId) ? ['TakeLoan'] : []),
            ...(!finishOperatingTurnReason(state, this.trainRules, companyId)
                ? ['FinishOperatingTurn']
                : [])
        ]
    }

    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        const companyId = this.companyId(state)
        if (isPayInterest(action))
            return (
                action.source === ActionSource.System &&
                action.companyId === companyId &&
                !state.loanStep
            )
        if (!isTakeLoan(action) && !isRepayLoan(action) && !isFinishOperatingTurn(action))
            return false
        if (action.companyId !== companyId) return false
        const decisions = this.decisions(state, action.playerId)
        if (isFinishOperatingTurn(action) && action.source === ActionSource.System)
            return decisions.length === 1 && decisions[0] === 'FinishOperatingTurn'
        return action.source === ActionSource.User && decisions.includes(action.type)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        return this.decisions(context.gameState, playerId)
    }

    enter(context: MachineContext<State>): void {
        const state = context.gameState
        const companyId = this.companyId(state)
        if (!state.loanStep) {
            if (companyLoans(state, companyId)) {
                context.addSystemAction(PayInterest, { companyId })
                return
            }
            state.loanStep = { companyId }
        }
        const playerId = controllingOwner(state, companyId)?.playerId
        if (!playerId) return
        state.activePlayerIds = [playerId]
        const decisions = this.decisions(state, playerId)
        if (decisions.length === 1 && decisions[0] === 'FinishOperatingTurn')
            context.addSystemAction(FinishOperatingTurn, { playerId, companyId })
    }

    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return isFinishOperatingTurn(action)
            ? BetweenCompaniesState
            : context.gameState.machineState
    }
}

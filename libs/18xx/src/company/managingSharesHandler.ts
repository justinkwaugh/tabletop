import {
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { controllingOwner } from '../finance/finance.js'
import { nextOperatingCompany } from '../operating/operatingSet.js'
import {
    FinishTreasuryShares,
    HydratedFinishTreasuryShares,
    HydratedTradeTreasuryShares
} from './tradeTreasuryShares.js'
import {
    shareStepOpen,
    type TreasuryShareRules,
    type TreasuryShareState
} from './treasuryShares.js'

type State = HydratedGameState & TreasuryShareState

/**
 * The operating company's share step before construction, as 1894's redemption and reissue;
 * a company with nothing to do passes through it at once.
 */
export class ManagingSharesHandler implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly rules: TreasuryShareRules,
        private readonly nextState: string
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (
            !(action instanceof HydratedTradeTreasuryShares) &&
            !(action instanceof HydratedFinishTreasuryShares)
        )
            return false
        return (
            !!action.playerId &&
            context.gameState.activePlayerIds.includes(action.playerId) &&
            action.isValid(context.gameState)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        const companyId = state.shareStep?.companyId
        if (
            !companyId ||
            !state.activePlayerIds.includes(playerId) ||
            !shareStepOpen(state, playerId, companyId)
        )
            return []
        return this.rules.choices(state, companyId).length
            ? ['TradeTreasuryShares', 'FinishTreasuryShares']
            : ['FinishTreasuryShares']
    }
    enter(context: MachineContext<State>): void {
        const state = context.gameState
        const companyId = nextOperatingCompany(state)
        assertExists(companyId, 'The share step belongs to an operating company')
        state.shareStep ??= { companyId, trades: [], completed: false }
        const playerId = controllingOwner(state, companyId)?.playerId
        if (playerId && !state.shareStep.completed && !this.rules.choices(state, companyId).length)
            context.addSystemAction(FinishTreasuryShares, { playerId, companyId })
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return context.gameState.shareStep?.completed
            ? this.nextState
            : context.gameState.machineState
    }
}

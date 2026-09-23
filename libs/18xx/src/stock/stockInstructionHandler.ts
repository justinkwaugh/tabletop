import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { BuyShares, isBuyShares } from './buyShares.js'
import { FinishStockTurn, isFinishStockTurn } from './finishStockTurn.js'
import { isSetStockInstruction, stockInstructionProblem } from './setStockInstruction.js'
import { StopStockInstruction, isStopStockInstruction } from './stopStockInstruction.js'
import {
    evaluateStockInstruction,
    standingStockInstructionFor,
    type StandingStockInstruction,
    type StockInstructionOutcome
} from './stockInstruction.js'
import { sameOwner } from '../finance/finance.js'
import type { StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

type Evaluation = { standing: StandingStockInstruction; outcome: StockInstructionOutcome }

export class StockInstructionHandler<
    State extends HydratedGameState & StockState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, State>,
        private readonly rules: StockRules
    ) {}

    private evaluate(context: MachineContext<State>): Evaluation | undefined {
        const state = context.gameState
        const playerId = state.turnManager.currentTurn()?.playerId
        if (!playerId || state.stockRound.completed) return undefined
        const standing = standingStockInstructionFor(state, playerId)
        if (!standing) return undefined
        const available = this.handler.validActionsForPlayer(playerId, context)
        return {
            standing,
            outcome: evaluateStockInstruction(state, standing, this.rules, available)
        }
    }

    private matchesOutcome(action: HydratedAction, evaluation: Evaluation): boolean {
        const { standing, outcome } = evaluation
        if (action.playerId !== standing.playerId) return false
        if (isStopStockInstruction(action))
            return (
                outcome.kind === 'stop' &&
                action.reason === outcome.reason &&
                Value.Equal(action.replacement, outcome.replacement)
            )
        if (isFinishStockTurn(action)) return outcome.kind === 'pass'
        if (isBuyShares(action))
            return (
                outcome.kind === 'buy' &&
                action.certificateId === outcome.request.certificateId &&
                sameOwner(action.buyer, outcome.request.buyer) &&
                action.expectedPrice === outcome.price
            )
        return false
    }

    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (isSetStockInstruction(action))
            return (
                action.source === ActionSource.User &&
                stockInstructionProblem(context.gameState, action) === undefined
            )
        if (action.source === ActionSource.System) {
            const evaluation = this.evaluate(context)
            if (evaluation && this.matchesOutcome(action, evaluation)) return true
            if (isStopStockInstruction(action)) return false
        }
        return this.handler.isValidAction(action, context)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const actions = this.handler.validActionsForPlayer(playerId, context)
        const state = context.gameState
        if (
            stockInstructionProblem(state, { playerId, instruction: { kind: 'pass' } }) ===
            undefined
        )
            actions.push('SetStockInstruction')
        return actions
    }

    enter(context: MachineContext<State>): void {
        this.handler.enter(context)
        if (context.getPendingActions().length > 0) return
        const evaluation = this.evaluate(context)
        if (!evaluation) return
        const { standing, outcome } = evaluation
        const playerId = standing.playerId
        switch (outcome.kind) {
            case 'pass':
                context.addSystemAction(FinishStockTurn, { playerId })
                return
            case 'buy':
                context.addSystemAction(BuyShares, {
                    playerId,
                    buyer: outcome.request.buyer,
                    certificateId: outcome.request.certificateId,
                    expectedPrice: outcome.price
                })
                return
            case 'stop':
                context.addSystemAction(StopStockInstruction, {
                    playerId,
                    reason: outcome.reason,
                    ...(outcome.replacement ? { replacement: outcome.replacement } : {})
                })
                return
            case 'wait':
                return
        }
    }

    onAction(action: HydratedAction, context: MachineContext<State>): string {
        if (isSetStockInstruction(action) || isStopStockInstruction(action))
            return context.gameState.machineState
        return this.handler.onAction(action, context)
    }
}

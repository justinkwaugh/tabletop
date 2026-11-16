import {
    allPlayersPassed,
    isCompleteStockRound,
    stepAction,
    titleAction,
    type StepAction
} from '@tabletop/18xx'
import { ActionSource, assert, type HydratedAction, type MachineContext } from '@tabletop/common'
import * as Type from 'typebox'
import { playerLoan1822, repayPlayerLoan1822, repayableLoan1822 } from './loans.js'
import type { HydratedState1822, StateHandler1822 } from './state.js'
import { doubleCashPlayerId1822, playerOrderWithDeclaration1822 } from './stock.js'

const RepayPlayerLoanAction = titleAction('RepayPlayerLoan', {
    amount: Type.Integer({ minimum: 1 }),
    metadata: Type.Optional(
        Type.Object(
            { paid: Type.Integer({ minimum: 1 }), remaining: Type.Integer({ minimum: 0 }) },
            { additionalProperties: false }
        )
    )
})
export const RepayPlayerLoan = RepayPlayerLoanAction.schema
export type RepayPlayerLoan = Type.Static<typeof RepayPlayerLoan>
export const isRepayPlayerLoan = RepayPlayerLoanAction.is

/** Whether the player on turn has a loan and cash to pay towards it (§4.1.3, §4.2.2). */
export function canRepayLoan1822(state: HydratedState1822, playerId: string): boolean {
    return (
        state.machineState === 'StockRound' &&
        !state.stockRound.completed &&
        !allPlayersPassed(state) &&
        state.activePlayerIds.includes(playerId) &&
        repayableLoan1822(state, playerId) > 0
    )
}

/** In their stock turn a player pays as much of their cash as they choose towards their loan (§4.1.3). */
export class HydratedRepayPlayerLoan extends RepayPlayerLoanAction.Base {
    declare playerId: string
    declare amount: RepayPlayerLoan['amount']
    declare metadata?: RepayPlayerLoan['metadata']
    isValid(state: HydratedState1822): boolean {
        return (
            this.source === ActionSource.User &&
            canRepayLoan1822(state, this.playerId) &&
            this.amount <= repayableLoan1822(state, this.playerId)
        )
    }
    apply(state: HydratedState1822): void {
        assert(this.isValid(state), 'This much of the loan cannot be repaid')
        repayPlayerLoan1822(state, this.playerId, this.amount)
        this.metadata = { paid: this.amount, remaining: playerLoan1822(state, this.playerId) }
    }
}

export const RepayPlayerLoanStep: StepAction<HydratedState1822> = stepAction(
    RepayPlayerLoanAction.type,
    (action: HydratedAction): action is HydratedRepayPlayerLoan =>
        action instanceof HydratedRepayPlayerLoan,
    canRepayLoan1822
)

/**
 * The player holding P9 who, the round's bids settled, still has to say whether they declare
 * double their cash: asked only where it would change the order (§3.1.9, §4.10.5).
 */
export function cashDeclarationDue1822(state: HydratedState1822): string | undefined {
    if (
        state.machineState !== 'StockRound' ||
        state.stockRound.completed ||
        !allPlayersPassed(state) ||
        !state.bidBoxes.settled ||
        state.cashDeclaration
    )
        return undefined
    const playerId = doubleCashPlayerId1822(state)
    if (!playerId) return undefined
    const plain = playerOrderWithDeclaration1822(state, undefined)
    const doubled = playerOrderWithDeclaration1822(state, playerId)
    return plain.join() === doubled.join() ? undefined : playerId
}

const DeclareCashAction = titleAction('DeclareCash', { doubled: Type.Boolean() })
export const DeclareCash = DeclareCashAction.schema
export type DeclareCash = Type.Static<typeof DeclareCash>
export const isDeclareCash = DeclareCashAction.is

/** P9's holder declares their cash, or double it, for the order of the next stock round (§3.1.9). */
export class HydratedDeclareCash extends DeclareCashAction.Base {
    declare playerId: string
    declare doubled: DeclareCash['doubled']
    isValid(state: HydratedState1822): boolean {
        return this.source === ActionSource.User && cashDeclarationDue1822(state) === this.playerId
    }
    apply(state: HydratedState1822): void {
        assert(this.isValid(state), 'No cash declaration is due')
        state.cashDeclaration = { playerId: this.playerId, doubled: this.doubled }
    }
}

/**
 * Between the settling of a stock round's bids and its completion, P9's holder makes their
 * declaration (§3.1.9). The declaration and the tax haven's purchase are the round's alone, so
 * both are dropped as it completes (§6.1.2).
 */
export function declaresCash(handler: StateHandler1822): StateHandler1822 {
    const due = (context: MachineContext<HydratedState1822>) =>
        cashDeclarationDue1822(context.gameState)
    return {
        isValidAction: (action, context) =>
            action instanceof HydratedDeclareCash
                ? action.isValid(context.gameState)
                : !due(context) && handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) => {
            const declarer = due(context)
            if (!declarer) return handler.validActionsForPlayer(playerId, context)
            return declarer === playerId ? [DeclareCashAction.type] : []
        },
        enter(context) {
            const declarer = due(context)
            if (declarer) context.gameState.activePlayerIds = [declarer]
            else handler.enter(context)
        },
        onAction: (action, context) => {
            if (action instanceof HydratedDeclareCash) return context.gameState.machineState
            if (isCompleteStockRound(action)) {
                delete context.gameState.cashDeclaration
                delete context.gameState.taxHavenBought
            }
            return handler.onAction(action, context)
        }
    }
}

export const StockTurnActions = [
    RepayPlayerLoanAction.define((action) => new HydratedRepayPlayerLoan(action)),
    DeclareCashAction.define((action) => new HydratedDeclareCash(action))
]

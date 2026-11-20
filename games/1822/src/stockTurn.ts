import {
    allPlayersPassed,
    isCompleteStockRound,
    playerLoanActions,
    repayPlayerLoanStep,
    titleAction,
    type StepAction
} from '@tabletop/18xx'
import { ActionSource, assert, type MachineContext } from '@tabletop/common'
import * as Type from 'typebox'
import { PlayerLoanRules1822 } from './loans.js'
import type { HydratedState1822, StateHandler1822 } from './state.js'
import { doubleCashPlayerId1822, playerOrderWithDeclaration1822 } from './stock.js'

export {
    RepayPlayerLoan,
    isRepayPlayerLoan,
    HydratedRepayPlayerLoan,
    canRepayPlayerLoan as canRepayLoan1822
} from '@tabletop/18xx'

export const RepayPlayerLoanStep: StepAction<HydratedState1822> = repayPlayerLoanStep()

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
    ...playerLoanActions(PlayerLoanRules1822),
    DeclareCashAction.define((action) => new HydratedDeclareCash(action))
]

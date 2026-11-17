import * as Type from 'typebox'
import { ActionSource, assert, type HydratedAction, type HydratedGameState } from '@tabletop/common'
import type { ActionDefinition } from '../actions/actionDefinition.js'
import { titleAction } from '../actions/titleAction.js'
import { finiteCashOwnedBy, type FinancialState } from '../finance/finance.js'
import { settleCashPayments } from '../finance/cashPayments.js'
import { stepAction, type StepAction } from '../game/stepAction.js'
import { allPlayersPassed } from '../stock/stockRoundRules.js'
import type { StockState } from '../stock/stockState.js'

/**
 * What a player owes on loans taken when their own cash could not pay for their company's train,
 * interest included, as 1822's (§4.2) and 1880's (§X Purchase of Trains). A player owing money
 * buys no shares; they repay it in their stock turns.
 */
export const PlayerLoan = Type.Object(
    { playerId: Type.String({ minLength: 1 }), amount: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export type PlayerLoan = Type.Static<typeof PlayerLoan>
export const PlayerLoanFields = { playerLoans: Type.Array(PlayerLoan) }
export type PlayerLoanState = Type.Static<Type.TObject<typeof PlayerLoanFields>>
type State = PlayerLoanState & FinancialState

export interface PlayerLoanRules {
    /** What the loan grows by as it is taken and as each stock round ends. */
    interest(amount: number): number
    /**
     * Whether a repayment goes to the bank, or leaves play because the loan never came from it,
     * as 1822's (§4.2.4).
     */
    repaidTo: 'bank' | 'nobody'
}

/** Half as much again, rounded up: 1822's and 1880's interest. */
export const HalfAgainInterest = (amount: number): number => Math.ceil(amount / 2)

export function playerLoan(state: PlayerLoanState, playerId: string): number {
    return state.playerLoans.find((loan) => loan.playerId === playerId)?.amount ?? 0
}

function setLoan(state: PlayerLoanState, playerId: string, amount: number): void {
    state.playerLoans = [
        ...state.playerLoans.filter((loan) => loan.playerId !== playerId),
        ...(amount > 0 ? [{ playerId, amount }] : [])
    ]
}

/** Records a loan the player took, with its interest. */
export function takePlayerLoan(
    state: PlayerLoanState,
    rules: PlayerLoanRules,
    playerId: string,
    borrowed: number
): void {
    setLoan(state, playerId, playerLoan(state, playerId) + borrowed + rules.interest(borrowed))
}

/** Adds a stock round's interest to every outstanding loan, returning each charge. */
export function chargePlayerLoanInterest(
    state: PlayerLoanState,
    rules: PlayerLoanRules
): { playerId: string; interest: number }[] {
    const charges = state.playerLoans.map(({ playerId, amount }) => ({
        playerId,
        interest: rules.interest(amount)
    }))
    state.playerLoans = state.playerLoans.map((loan) => ({
        ...loan,
        amount: loan.amount + rules.interest(loan.amount)
    }))
    return charges
}

/** The most the player could pay towards their loan now. */
export function repayablePlayerLoan(state: State, playerId: string): number {
    return Math.min(
        playerLoan(state, playerId),
        finiteCashOwnedBy(state, { kind: 'player', playerId })
    )
}

/** Pays an amount of the player's cash towards their loan. */
export function repayPlayerLoan(
    state: State,
    rules: PlayerLoanRules,
    playerId: string,
    amount: number
): void {
    const owed = playerLoan(state, playerId)
    const cash = state.cash.find(
        (entry) => entry.owner.kind === 'player' && entry.owner.playerId === playerId
    )
    assert(
        cash && typeof cash.amount === 'number' && amount <= Math.min(owed, cash.amount),
        'A repayment is of cash the player holds, up to what they owe'
    )
    // Repaid to the bank, the money is the bank's again; repaid to nobody, it leaves the game.
    if (rules.repaidTo === 'bank')
        settleCashPayments(state, [
            { from: { kind: 'player', playerId }, to: { kind: 'bank' }, amount }
        ])
    else cash.amount -= amount
    setLoan(state, playerId, owed - amount)
}

/** Whether the player on turn has a loan and cash to pay towards it. */
export function canRepayPlayerLoan(
    state: State & StockState & { machineState: string },
    playerId: string
): boolean {
    return (
        state.machineState === 'StockRound' &&
        !state.stockRound.completed &&
        !allPlayersPassed(state) &&
        state.activePlayerIds.includes(playerId) &&
        repayablePlayerLoan(state, playerId) > 0
    )
}

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

type LoanStockState = State & StockState & { machineState: string }

function holdsPlayerLoans(state: HydratedGameState): state is HydratedGameState & LoanStockState {
    return 'playerLoans' in state && 'stockRound' in state && 'cash' in state
}

/** In their stock turn a player pays as much of their cash as they choose towards their loan. */
export class HydratedRepayPlayerLoan extends RepayPlayerLoanAction.Base {
    declare playerId: string
    declare amount: RepayPlayerLoan['amount']
    declare metadata?: RepayPlayerLoan['metadata']
    readonly #rules: PlayerLoanRules
    constructor(data: RepayPlayerLoan, rules: PlayerLoanRules) {
        super(data)
        this.#rules = rules
    }
    isValid(state: LoanStockState): boolean {
        return (
            this.source === ActionSource.User &&
            canRepayPlayerLoan(state, this.playerId) &&
            this.amount <= repayablePlayerLoan(state, this.playerId)
        )
    }
    apply(state: HydratedGameState): void {
        assert(holdsPlayerLoans(state), 'Player loans belong to a title that records them')
        assert(this.isValid(state), 'This much of the loan cannot be repaid')
        repayPlayerLoan(state, this.#rules, this.playerId, this.amount)
        this.metadata = { paid: this.amount, remaining: playerLoan(state, this.playerId) }
    }
}

/** The Action repaying a loan, for a title's `titleActions`. */
export function playerLoanActions(rules: PlayerLoanRules): ActionDefinition[] {
    return [RepayPlayerLoanAction.define((action) => new HydratedRepayPlayerLoan(action, rules))]
}

/** Repaying a loan within the stock turn, for the title's stock round `StepActionsHandler`. */
export function repayPlayerLoanStep<S extends LoanStockState>(): StepAction<S> {
    return stepAction(
        RepayPlayerLoanAction.type,
        (action: HydratedAction): action is HydratedRepayPlayerLoan =>
            action instanceof HydratedRepayPlayerLoan,
        canRepayPlayerLoan
    )
}

import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    PlayerAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { CashPayment } from '../finance/cashPayments.js'
import { getCompany } from '../finance/finance.js'
import {
    TreasuryShareChoice,
    applyShareChoice,
    sameShareChoice,
    shareStepOpen,
    type TreasuryShareRules,
    type TreasuryShareState
} from './treasuryShares.js'

export const TradeTreasuryShares = Type.Object(
    {
        ...PlayerAction.properties,
        ...TreasuryShareChoice.properties,
        type: Type.Literal('TradeTreasuryShares'),
        companyId: Type.String(),
        metadata: Type.Optional(
            Type.Object(
                {
                    payments: Type.Array(CashPayment),
                    previousParPrice: Type.Optional(Type.Integer({ minimum: 1 }))
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type TradeTreasuryShares = Type.Static<typeof TradeTreasuryShares>
const TradeValidator = Compile(TradeTreasuryShares)
export function isTradeTreasuryShares(action: GameAction): action is TradeTreasuryShares {
    return (
        action instanceof HydratedTradeTreasuryShares ||
        (action.type === 'TradeTreasuryShares' && TradeValidator.Check(action))
    )
}

export class HydratedTradeTreasuryShares
    extends HydratableAction<typeof TradeTreasuryShares>
    implements TradeTreasuryShares
{
    declare type: 'TradeTreasuryShares'
    declare playerId: string
    declare companyId: string
    declare operation: TradeTreasuryShares['operation']
    declare certificateIds: string[]
    declare amount: number
    declare poolId?: string
    declare parPrice?: number
    declare metadata?: TradeTreasuryShares['metadata']
    readonly #rules: TreasuryShareRules
    constructor(data: TradeTreasuryShares, rules: TreasuryShareRules) {
        super(data instanceof HydratedTradeTreasuryShares ? data.dehydrate() : data, TradeValidator)
        this.#rules = rules
    }
    get choice(): TreasuryShareChoice {
        return {
            operation: this.operation,
            certificateIds: [...this.certificateIds],
            amount: this.amount,
            ...(this.poolId === undefined ? {} : { poolId: this.poolId }),
            ...(this.parPrice === undefined ? {} : { parPrice: this.parPrice })
        }
    }
    isValid(state: TreasuryShareState): boolean {
        return (
            this.source === ActionSource.User &&
            shareStepOpen(state, this.playerId, this.companyId) &&
            this.#rules
                .choices(state, this.companyId)
                .some((choice) => sameShareChoice(choice, this.choice))
        )
    }
    apply(state: HydratedGameState & TreasuryShareState): void {
        assert(this.isValid(state), 'This share operation is not open to the company')
        assertExists(state.shareStep, 'A share operation belongs to the share step')
        const previousParPrice = getCompany(state, this.companyId).parPrice
        const payments = applyShareChoice(state, this.companyId, this.choice)
        state.shareStep.trades.push({
            operation: this.operation,
            shares: this.certificateIds.length
        })
        if (!this.#rules.choices(state, this.companyId).length) state.shareStep.completed = true
        this.metadata = {
            payments,
            ...(this.parPrice !== undefined && previousParPrice !== undefined
                ? { previousParPrice }
                : {})
        }
    }
}

export const FinishTreasuryShares = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('FinishTreasuryShares'),
        companyId: Type.String()
    },
    { additionalProperties: false }
)
export type FinishTreasuryShares = Type.Static<typeof FinishTreasuryShares>
const FinishValidator = Compile(FinishTreasuryShares)
export function isFinishTreasuryShares(action: GameAction): action is FinishTreasuryShares {
    return (
        action instanceof HydratedFinishTreasuryShares ||
        (action.type === 'FinishTreasuryShares' && FinishValidator.Check(action))
    )
}
export class HydratedFinishTreasuryShares
    extends HydratableAction<typeof FinishTreasuryShares>
    implements FinishTreasuryShares
{
    declare type: 'FinishTreasuryShares'
    declare playerId: string
    declare companyId: string
    constructor(data: FinishTreasuryShares) {
        super(
            data instanceof HydratedFinishTreasuryShares ? data.dehydrate() : data,
            FinishValidator
        )
    }
    isValid(state: TreasuryShareState): boolean {
        return (
            (this.source === ActionSource.User || this.source === ActionSource.System) &&
            shareStepOpen(state, this.playerId, this.companyId)
        )
    }
    apply(state: HydratedGameState & TreasuryShareState): void {
        assert(this.isValid(state), 'Only the operating company’s president may end its share step')
        assertExists(state.shareStep, 'The share step is open')
        state.shareStep.completed = true
    }
}

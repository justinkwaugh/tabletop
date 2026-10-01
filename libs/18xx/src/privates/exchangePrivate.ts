import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { recordStockAction } from '../stock/stockRoundRules.js'
import type { StockRules } from '../stock/stockRules.js'
import {
    PrivateExchangeDetails,
    evaluatePrivateExchange,
    applyPrivateShareExchange,
    type PrivateExchangeRequest
} from './privateExchange.js'
import type { PrivateRules, PrivateState } from './privateRules.js'
export const ExchangePrivate = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('ExchangePrivate'),
        privateCompanyId: Type.String(),
        certificateId: Type.String(),
        metadata: Type.Optional(PrivateExchangeDetails)
    },
    { additionalProperties: false }
)
export type ExchangePrivate = Type.Static<typeof ExchangePrivate>
const Validator = Compile(ExchangePrivate)
export function isExchangePrivate(action: GameAction): action is ExchangePrivate {
    return (
        action instanceof HydratedExchangePrivate ||
        (action.type === 'ExchangePrivate' && Validator.Check(action))
    )
}
export const ExchangePrivateOutOfTurn = Type.Object(
    {
        ...ExchangePrivate.properties,
        type: Type.Literal('ExchangePrivateOutOfTurn'),
        outOfTurn: Type.Literal(true),
        sequenced: Type.Literal(true)
    },
    { additionalProperties: false }
)
export type ExchangePrivateOutOfTurn = Type.Static<typeof ExchangePrivateOutOfTurn>
const OutOfTurnValidator = Compile(ExchangePrivateOutOfTurn)
export function isExchangePrivateOutOfTurn(action: GameAction): action is ExchangePrivateOutOfTurn {
    return (
        action instanceof HydratedExchangePrivateOutOfTurn ||
        (action.type === 'ExchangePrivateOutOfTurn' && OutOfTurnValidator.Check(action))
    )
}
export function isPrivateExchangeAction(
    action: GameAction
): action is ExchangePrivate | ExchangePrivateOutOfTurn {
    return isExchangePrivate(action) || isExchangePrivateOutOfTurn(action)
}

function applyExchange(
    state: HydratedGameState & PrivateState,
    request: PrivateExchangeRequest,
    details: PrivateExchangeDetails,
    stockRules: StockRules
): void {
    applyPrivateShareExchange(
        state,
        request.privateCompanyId,
        request.certificateId,
        details.exemptOwnershipLimit,
        stockRules
    )
    if (state.machineState === 'StockRound' && details.stockAction === 'additional')
        recordStockAction(state, request.playerId, stockRules.round)
}

export class HydratedExchangePrivate
    extends HydratableAction<typeof ExchangePrivate>
    implements ExchangePrivate
{
    declare type: 'ExchangePrivate'
    declare playerId: string
    declare privateCompanyId: string
    declare certificateId: string
    declare metadata?: PrivateExchangeDetails
    readonly #rules: PrivateRules
    readonly #stockRules: StockRules
    constructor(data: ExchangePrivate, rules: PrivateRules, stockRules: StockRules) {
        super(data instanceof HydratedExchangePrivate ? data.dehydrate() : data, Validator)
        this.#rules = rules
        this.#stockRules = stockRules
    }
    apply(state: HydratedGameState & PrivateState): void {
        assert(
            this.source === ActionSource.User && state.activePlayerIds.includes(this.playerId),
            'Only an eligible player may exchange'
        )
        const result = evaluatePrivateExchange(state, this, this.#rules, this.#stockRules)
        assert(result.details, result.reason ?? 'Invalid private exchange')
        applyExchange(state, this, result.details, this.#stockRules)
        this.metadata = result.details
    }
}

export class HydratedExchangePrivateOutOfTurn
    extends HydratableAction<typeof ExchangePrivateOutOfTurn>
    implements ExchangePrivateOutOfTurn
{
    declare type: 'ExchangePrivateOutOfTurn'
    declare playerId: string
    declare privateCompanyId: string
    declare certificateId: string
    declare outOfTurn: true
    declare sequenced: true
    declare metadata?: PrivateExchangeDetails
    readonly #rules: PrivateRules
    readonly #stockRules: StockRules
    constructor(data: ExchangePrivateOutOfTurn, rules: PrivateRules, stockRules: StockRules) {
        super(
            data instanceof HydratedExchangePrivateOutOfTurn ? data.dehydrate() : data,
            OutOfTurnValidator
        )
        this.#rules = rules
        this.#stockRules = stockRules
    }
    apply(state: HydratedGameState & PrivateState): void {
        assert(
            this.source === ActionSource.User && !state.activePlayerIds.includes(this.playerId),
            'An out-of-turn exchange comes from a player the game is not waiting on'
        )
        const result = evaluatePrivateExchange(state, this, this.#rules, this.#stockRules)
        assert(result.details, result.reason ?? 'Invalid private exchange')
        assert(
            result.details.stockAction === 'none',
            'An out-of-turn exchange cannot record a stock action'
        )
        applyExchange(state, this, result.details, this.#stockRules)
        this.metadata = result.details
    }
}

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
    applyPrivateShareExchange
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
        applyPrivateShareExchange(
            state,
            this.privateCompanyId,
            this.certificateId,
            result.details.exemptOwnershipLimit,
            this.#stockRules
        )
        if (state.machineState === 'StockRound' && result.details.stockAction === 'additional')
            recordStockAction(state, this.playerId, this.#stockRules.round)
        this.metadata = result.details
    }
}

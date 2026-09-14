import type { MapStateData } from '../map/mapState.js'
import { PrivateEffect, type PrivateRules } from '../privates/privateRules.js'
import { applyPrivateEffects } from '../privates/privateLifecycle.js'
import type { StockRules } from '../stock/stockRules.js'
import type { StockState } from '../stock/stockState.js'
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
import { settleCashPayments } from '../finance/cashPayments.js'
import { getCompany } from '../finance/finance.js'
import { placeStockMarker } from '../stock/stockMarket.js'
import {
    EarningsChoice,
    EarningsDetails,
    EarningsDistribution,
    type EarningsRules,
    type DistributionState
} from './earningsDistribution.js'
export const DistributeEarnings = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('DistributeEarnings'),
        companyId: Type.String(),
        choice: EarningsChoice,
        metadata: Type.Optional(
            Type.Object(
                { ...EarningsDetails.properties, privateEffects: Type.Array(PrivateEffect) },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type DistributeEarnings = Type.Static<typeof DistributeEarnings>
const Validator = Compile(DistributeEarnings)
export function isDistributeEarnings(action: GameAction): action is DistributeEarnings {
    return (
        action instanceof HydratedDistributeEarnings ||
        (action.type === 'DistributeEarnings' && Validator.Check(action))
    )
}
export class HydratedDistributeEarnings
    extends HydratableAction<typeof DistributeEarnings>
    implements DistributeEarnings
{
    declare type: 'DistributeEarnings'
    declare playerId: string
    declare companyId: string
    declare choice: EarningsChoice
    declare metadata?: DistributeEarnings['metadata']
    readonly #rules: EarningsRules
    readonly #privateRules: PrivateRules
    readonly #stockRules: StockRules
    constructor(
        data: DistributeEarnings,
        rules: EarningsRules,
        privateRules: PrivateRules,
        stockRules: StockRules
    ) {
        super(data instanceof HydratedDistributeEarnings ? data.dehydrate() : data, Validator)
        this.#rules = rules
        this.#privateRules = privateRules
        this.#stockRules = stockRules
    }
    apply(state: HydratedGameState & DistributionState & StockState & MapStateData): void {
        const distribution = new EarningsDistribution(state, this.#rules)
        assert(
            (this.source === ActionSource.User ||
                (this.source === ActionSource.System &&
                    distribution.automaticChoice(this.companyId) === this.choice)) &&
                state.activePlayerIds.includes(this.playerId) &&
                distribution.canAct(this.playerId, this.companyId),
            'Only the operating company’s controlling owner may distribute earnings'
        )
        const result = distribution.evaluate(this.companyId, this.choice)
        assert(result.details, result.reason ?? 'Invalid distribution')
        settleCashPayments(state, result.details.payments)
        if (result.details.marketMove)
            placeStockMarker(
                state.stockMarket,
                this.companyId,
                result.details.marketMove.toMarketSpaceId
            )
        getCompany(state, this.companyId).operated = true
        state.earningsDistribution = result.details
        state.trainPurchaseStep = { companyId: this.companyId, purchasedTrainIds: [] }
        const privateEffects = this.#privateRules.operationEffects(state, this.companyId)
        applyPrivateEffects(state, privateEffects, this.#stockRules)
        this.metadata = { ...result.details, privateEffects }
    }
}

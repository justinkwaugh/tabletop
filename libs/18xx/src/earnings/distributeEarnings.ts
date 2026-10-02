import { OperatingRoundIdentity } from '../operating/operatingRoundSnapshot.js'
import type { MapStateData } from '../map/mapState.js'
import { PrivateEffect, type PrivateRules } from '../privates/privateRules.js'
import { applyPrivateEffects } from '../privates/privateLifecycle.js'
import type { StockRules } from '../stock/stockRules.js'
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
import { settleCashPayments, type CashPayment } from '../finance/cashPayments.js'
import { controllingOwner, getCompany } from '../finance/finance.js'
import { chargePlayers, type CashCrisisState, type Debt } from '../funding/cashCrisis.js'
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
                {
                    ...EarningsDetails.properties,
                    privateEffects: Type.Array(PrivateEffect),
                    round: Type.Optional(OperatingRoundIdentity),
                    companyName: Type.String()
                },
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
    readonly #nextState: string
    constructor(
        data: DistributeEarnings,
        rules: EarningsRules,
        privateRules: PrivateRules,
        stockRules: StockRules,
        nextState: string
    ) {
        super(data instanceof HydratedDistributeEarnings ? data.dehydrate() : data, Validator)
        this.#rules = rules
        this.#privateRules = privateRules
        this.#stockRules = stockRules
        this.#nextState = nextState
    }
    apply(state: HydratedGameState & DistributionState & CashCrisisState & MapStateData): void {
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
        if (result.details.charges)
            chargePlayers(
                state,
                this.chargesFromPresident(state, result.details.charges),
                this.#nextState
            )
        if (result.details.marketMove)
            placeStockMarker(
                state.stockMarket,
                this.companyId,
                result.details.marketMove.toMarketSpaceId
            )
        getCompany(state, this.companyId).operated = true
        state.earningsDistribution = result.details
        const privateEffects = this.#privateRules.operationEffects(state, this.companyId)
        applyPrivateEffects(state, privateEffects, this.#stockRules)
        this.metadata = {
            ...result.details,
            privateEffects,
            companyName: getCompany(state, this.companyId).name,
            ...(state.operatingSet
                ? {
                      round: {
                          number: state.operatingSet.number,
                          roundNumber: state.operatingSet.roundNumber
                      }
                  }
                : {})
        }
    }
    // Short holders are charged in turn order from the company's president.
    private chargesFromPresident(state: CashCrisisState, charges: readonly CashPayment[]): Debt[] {
        const president = controllingOwner(state, this.companyId)
        const order = state.turnManager.turnOrder
        const start = president ? order.indexOf(president.playerId) : 0
        const rotated = [...order.slice(start), ...order.slice(0, start)]
        return charges
            .map((charge) => {
                assert(charge.from.kind === 'player', 'Only players hold shorts')
                return { playerId: charge.from.playerId, amount: charge.amount }
            })
            .sort((a, b) => rotated.indexOf(a.playerId) - rotated.indexOf(b.playerId))
    }
}

import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    type GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import { EmergencyTrainFunding, type FundingState, type TrainFundingRules } from './trainFunding.js'
import type { StockRules } from '../stock/stockRules.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { TrainPurchaseRequest } from '../trains/trainPurchase.js'

export const FundTrain = Type.Object(
    {
        ...PlayerAction.properties,
        ...TrainPurchaseRequest.properties,
        type: Type.Literal('FundTrain'),
        expectedPrice: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type FundTrain = Type.Static<typeof FundTrain>
const FundTrainValidator = Compile(FundTrain)
export function isFundTrain(action: GameAction): action is FundTrain {
    return (
        action instanceof HydratedFundTrain ||
        (action.type === 'FundTrain' && FundTrainValidator.Check(action))
    )
}
export class HydratedFundTrain extends HydratableAction<typeof FundTrain> implements FundTrain {
    declare type: 'FundTrain'
    declare playerId: string
    declare companyId: string
    declare trainId: string
    declare definitionId: string
    declare exchangeTrainId?: string
    declare expectedPrice: number
    readonly #rules: TrainFundingRules
    readonly #stocks: StockRules
    readonly #trains: TrainRules
    constructor(data: FundTrain, rules: TrainFundingRules, stocks: StockRules, trains: TrainRules) {
        super(data instanceof HydratedFundTrain ? data.dehydrate() : data, FundTrainValidator)
        this.#rules = rules
        this.#stocks = stocks
        this.#trains = trains
    }
    isValid(state: FundingState): boolean {
        const funding = new EmergencyTrainFunding(state, this.#rules, this.#stocks, this.#trains)
        return (
            this.source === ActionSource.User &&
            state.machineState === 'BuyingTrains' &&
            !this.exchangeTrainId &&
            !state.trainFunding &&
            !state.purchaseOffer &&
            !state.privateTrackLay &&
            !state.trackConsent &&
            state.activePlayerIds.includes(this.playerId) &&
            funding
                .purchases()
                .some(
                    (purchase) =>
                        purchase.companyId === this.companyId &&
                        purchase.trainId === this.trainId &&
                        purchase.definitionId === this.definitionId &&
                        purchase.price === this.expectedPrice &&
                        funding.begin(purchase).playerId === this.playerId
                )
        )
    }
    apply(state: HydratedGameState & FundingState): void {
        assert(this.isValid(state), 'Invalid FundTrain action')
        const funding = new EmergencyTrainFunding(state, this.#rules, this.#stocks, this.#trains)
        const purchase = funding.purchases().find((purchase) => purchase.trainId === this.trainId)
        assert(purchase, 'Funding requires an eligible purchase')
        state.trainFunding = funding.begin(purchase)
    }
}

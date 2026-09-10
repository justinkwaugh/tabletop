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
import {
    TrainPurchase,
    TrainPurchaseRequest,
    TrainPurchaseDetails,
    type TrainRules
} from '../trains/trainPurchase.js'
import { applyTrainPurchase } from '../trains/buyTrain.js'
import { closePrivate } from './privateCompany.js'
import { pendingCompanyDecision, type CompanyDecisionState } from './companyDecision.js'
import type { PrivatePowerRules } from './privatePowers.js'
export function privateTrainPurchase(
    state: CompanyDecisionState,
    companyId: string,
    trains: TrainRules
): TrainPurchase {
    return new TrainPurchase(
        {
            ...state,
            trainPurchaseStep: state.trainPurchaseStep ?? { companyId, purchasedTrainIds: [] }
        },
        trains
    )
}
export const BuyPrivateTrain = Type.Object(
    {
        ...PlayerAction.properties,
        ...TrainPurchaseRequest.properties,
        type: Type.Literal('BuyPrivateTrain'),
        privateCompanyId: Type.String(),
        expectedPrice: Type.Integer({ minimum: 0 }),
        metadata: Type.Optional(TrainPurchaseDetails)
    },
    { additionalProperties: false }
)
export type BuyPrivateTrain = Type.Static<typeof BuyPrivateTrain>
const Validator = Compile(BuyPrivateTrain)
export class HydratedBuyPrivateTrain
    extends HydratableAction<typeof BuyPrivateTrain>
    implements BuyPrivateTrain
{
    declare type: 'BuyPrivateTrain'
    declare playerId: string
    declare companyId: string
    declare privateCompanyId: string
    declare trainId: string
    declare definitionId: string
    declare exchangeTrainId?: string
    declare expectedPrice: number
    declare metadata?: TrainPurchaseDetails
    readonly #powers: PrivatePowerRules
    readonly #trains: TrainRules
    constructor(data: BuyPrivateTrain, powers: PrivatePowerRules, trains: TrainRules) {
        super(data instanceof HydratedBuyPrivateTrain ? data.dehydrate() : data, Validator)
        this.#powers = powers
        this.#trains = trains
    }
    isValid(state: CompanyDecisionState): boolean {
        return (
            this.source === ActionSource.User &&
            !pendingCompanyDecision(state) &&
            state.activePlayerIds.includes(this.playerId) &&
            !this.exchangeTrainId &&
            this.#powers.earlyTrainCompany(state, this.privateCompanyId, this.playerId) ===
                this.companyId &&
            this.#trains.depot.nextTrain(state.trainInventory, this.definitionId)?.id ===
                this.trainId &&
            privateTrainPurchase(state, this.companyId, this.#trains).evaluate(this).details
                ?.price === this.expectedPrice
        )
    }
    apply(state: HydratedGameState & CompanyDecisionState): void {
        assert(this.isValid(state), 'Invalid private train purchase')
        const details = privateTrainPurchase(state, this.companyId, this.#trains).evaluate(
            this
        ).details!
        closePrivate(state, this.privateCompanyId)
        applyTrainPurchase(state, details, this.#trains)
        this.metadata = details
    }
}

export function isBuyPrivateTrain(action: GameAction): action is BuyPrivateTrain {
    return (
        action instanceof HydratedBuyPrivateTrain ||
        (action.type === 'BuyPrivateTrain' && Validator.Check(action))
    )
}

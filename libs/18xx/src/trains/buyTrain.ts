import { preparePhaseChange, type PhaseState } from '../phases/phaseChange.js'
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
import {
    TrainPurchase,
    TrainPurchaseRequest,
    TrainPurchaseDetails,
    type TrainRules
} from './trainPurchase.js'
import { unownedTrain, type TrainPurchaseState } from './train.js'
export const BuyTrain = Type.Object(
    {
        ...PlayerAction.properties,
        ...TrainPurchaseRequest.properties,
        type: Type.Literal('BuyTrain'),
        expectedPrice: Type.Integer({ minimum: 0 }),
        metadata: Type.Optional(TrainPurchaseDetails)
    },
    { additionalProperties: false }
)
export type BuyTrain = Type.Static<typeof BuyTrain>
const Validator = Compile(BuyTrain)
export function isBuyTrain(action: GameAction): action is BuyTrain {
    return (
        action instanceof HydratedBuyTrain ||
        (action.type === 'BuyTrain' && Validator.Check(action))
    )
}
export class HydratedBuyTrain extends HydratableAction<typeof BuyTrain> implements BuyTrain {
    declare type: 'BuyTrain'
    declare playerId: string
    declare companyId: string
    declare trainId: string
    declare definitionId: string
    declare exchangeTrainId?: string
    declare expectedPrice: number
    declare metadata?: TrainPurchaseDetails
    readonly #rules: TrainRules
    constructor(data: BuyTrain, rules: TrainRules) {
        super(data instanceof HydratedBuyTrain ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & TrainPurchaseState & PhaseState): void {
        const purchase = new TrainPurchase(state, this.#rules)
        assert(
            this.source === ActionSource.User &&
                state.activePlayerIds.includes(this.playerId) &&
                purchase.canAct(this.playerId, this.companyId),
            'Only the operating company’s controlling owner may buy trains'
        )
        const result = purchase.evaluate(this)
        assert(result.details, result.reason ?? 'Invalid train purchase')
        assert(result.details.price === this.expectedPrice, 'Train price has changed')
        settleCashPayments(state, [
            {
                from: { kind: 'company', companyId: this.companyId },
                to: { kind: 'bank' },
                amount: result.details.price
            }
        ])
        if (this.exchangeTrainId)
            state.trainInventory.trains = state.trainInventory.trains.map((train) =>
                train.id === this.exchangeTrainId ? unownedTrain(train, 'market') : train
            )
        const toPhaseId = this.#rules.phaseAfterPurchase(state, this.definitionId)
        this.#rules.depot.purchase(state.trainInventory, this.trainId, this.definitionId, {
            kind: 'company',
            companyId: this.companyId
        })
        state.trainPurchaseStep!.purchasedTrainIds.push(this.trainId)
        preparePhaseChange(state, this.trainId, this.definitionId, toPhaseId, {
            machineState: state.machineState,
            companyId: this.companyId
        })
        this.metadata = result.details
    }
}

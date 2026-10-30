import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import { DeparturePayments, discardTrainToMarket } from './trainDepartures.js'
import type { Train, TrainPurchaseState } from './train.js'
import { trainsCountingForLimit, type TrainRules } from './trainPurchase.js'

/** The trains a company over its train limit after a merger or takeover may discard. */
export type MergedTrainDiscards = { companyId: string; trains: readonly Train[] }

/**
 * A title's merger step: which company's president must discard now, and what follows once
 * the company is within its limit.
 */
export interface MergedTrainDiscardRules<State extends TrainPurchaseState = TrainPurchaseState> {
    /** The discard awaiting this player, if it is theirs to make. */
    discards(state: State, playerId: string): MergedTrainDiscards | undefined
    /** Called once a discard leaves the company within its train limit. */
    withinLimit?(state: State, companyId: string): void
}

export const DiscardMergedTrain = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('DiscardMergedTrain'),
        companyId: Type.String(),
        trainId: Type.String(),
        metadata: Type.Optional(
            Type.Object({ departurePayments: DeparturePayments }, { additionalProperties: false })
        )
    },
    { additionalProperties: false }
)
export type DiscardMergedTrain = Type.Static<typeof DiscardMergedTrain>
const Validator = Compile(DiscardMergedTrain)
export function isDiscardMergedTrain(action: GameAction): action is DiscardMergedTrain {
    return (
        action instanceof HydratedDiscardMergedTrain ||
        (action.type === 'DiscardMergedTrain' && Validator.Check(action))
    )
}

/** Whether a company holds more trains than its limit allows. */
export function overTrainLimit(
    state: TrainPurchaseState,
    rules: Pick<TrainRules, 'trainLimit' | 'countsForLimit'>,
    companyId: string
): boolean {
    return (
        trainsCountingForLimit(state, rules, companyId).length > rules.trainLimit(state, companyId)
    )
}

/**
 * A company over its train limit after a merger or takeover discards a train of its
 * president's choice to the open market, uncompensated.
 */
export class HydratedDiscardMergedTrain<State extends TrainPurchaseState = TrainPurchaseState>
    extends HydratableAction<typeof DiscardMergedTrain>
    implements DiscardMergedTrain
{
    declare type: 'DiscardMergedTrain'
    declare playerId: string
    declare companyId: string
    declare trainId: string
    declare metadata?: DiscardMergedTrain['metadata']
    readonly #trainRules: TrainRules
    readonly #rules: MergedTrainDiscardRules<State>
    constructor(
        data: DiscardMergedTrain,
        trainRules: TrainRules,
        rules: MergedTrainDiscardRules<State>
    ) {
        super(data instanceof HydratedDiscardMergedTrain ? data.dehydrate() : data, Validator)
        this.#trainRules = trainRules
        this.#rules = rules
    }
    isValid(state: State): boolean {
        const discards = this.#rules.discards(state, this.playerId)
        return (
            this.source === ActionSource.User &&
            discards?.companyId === this.companyId &&
            discards.trains.some((train) => train.id === this.trainId)
        )
    }
    apply(state: HydratedGameState & State): void {
        assert(this.isValid(state), 'This train cannot be discarded')
        const payments = discardTrainToMarket(state, this.#trainRules, this.companyId, this.trainId)
        if (!overTrainLimit(state, this.#trainRules, this.companyId))
            this.#rules.withinLimit?.(state, this.companyId)
        if (payments.length) this.metadata = { departurePayments: payments }
    }
}

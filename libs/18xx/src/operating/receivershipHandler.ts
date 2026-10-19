import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import type * as Type from 'typebox'
import { FinishTrack } from '../construction/finishTrack.js'
import { FinishStations } from '../stations/finishStations.js'
import type { EarningsRules } from '../earnings/earningsDistribution.js'
import { BuyTrain } from '../trains/buyTrain.js'
import {
    TrainPurchase,
    type TrainPurchaseDetails,
    type TrainRules
} from '../trains/trainPurchase.js'
import { trainsOwnedBy } from '../trains/train.js'
import { inReceivership } from '../finance/receivership.js'
import { FinishOperatingTurn, type OperatingTurnState } from './finishOperatingTurn.js'
import { nextOperatingCompany } from './operatingSet.js'
import type { OperatingStepState } from './operatingSteps.js'
import type { ConstructionState } from '../construction/trackConstruction.js'
import type { StationPlacementState } from '../stations/stationPlacement.js'
import type { DistributionState } from '../earnings/earningsDistribution.js'
import type { PhaseState } from '../phases/phaseChange.js'

type State = HydratedGameState &
    OperatingTurnState &
    ConstructionState &
    StationPlacementState &
    DistributionState &
    PhaseState
type Automatic = { schema: Type.TObject<{ type: Type.TLiteral<string> }>; fields: object }

/** The cheapest train a receiver buys when it needs one and can pay: from the depot or the market. */
export function receiverTrainPurchase(
    state: ConstructorParameters<typeof TrainPurchase>[0] &
        Parameters<TrainRules['requiresTrain']>[0],
    companyId: string,
    rules: TrainRules
): (Omit<TrainPurchaseDetails, 'price'> & { expectedPrice: number }) | undefined {
    const owner = { kind: 'company' as const, companyId }
    if (trainsOwnedBy(state, owner).length || !rules.requiresTrain(state, companyId))
        return undefined
    const purchase = new TrainPurchase(state, rules)
    const offers = [
        ...purchase.offers().map((offer) => offer.evaluation),
        ...purchase.marketOffers()
    ].flatMap((evaluation) => (evaluation.details ? [evaluation.details] : []))
    const cheapest = offers.toSorted((a, b) => a.price - b.price)[0]
    if (!cheapest) return undefined
    const { price, ...request } = cheapest
    return { ...request, expectedPrice: price }
}

/**
 * A company in receivership runs its operating step without a president: it lays nothing,
 * its receivers run its trains, its only earnings choice applies itself, and it buys the
 * cheapest train it can afford when it needs one. Every decision but the routes is a system
 * action.
 */
export class ReceivershipHandler<S extends State> implements MachineStateHandler<
    HydratedAction,
    S
> {
    constructor(
        private readonly step: OperatingStepState,
        private readonly handler: MachineStateHandler<HydratedAction, S>,
        private readonly rules: { earningsRules: EarningsRules; trainRules: TrainRules }
    ) {}
    private receiver(state: S): string | undefined {
        const companyId = nextOperatingCompany(state)
        return companyId && inReceivership(state, companyId) ? companyId : undefined
    }
    private automatic(state: S, companyId: string): Automatic | undefined {
        const playerId = state.activePlayerIds[0]
        switch (this.step) {
            case 'LayingTrack':
                return state.trackStep?.companyId === companyId && !state.trackStep.completed
                    ? { schema: FinishTrack, fields: { companyId, playerId } }
                    : undefined
            case 'PlacingStation':
                return state.stationStep?.companyId === companyId && !state.stationStep.completed
                    ? { schema: FinishStations, fields: { companyId, playerId } }
                    : undefined
            case 'RunningTrains':
                return undefined
            case 'DistributingEarnings':
                return undefined
            case 'BuyingTrains': {
                if (state.trainPurchaseStep?.companyId !== companyId) return undefined
                const purchase = receiverTrainPurchase(state, companyId, this.rules.trainRules)
                return purchase
                    ? { schema: BuyTrain, fields: { ...purchase, playerId } }
                    : { schema: FinishOperatingTurn, fields: { companyId, playerId } }
            }
        }
    }
    isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
        const companyId = this.receiver(context.gameState)
        if (companyId && action.source === ActionSource.System) {
            const automatic = this.automatic(context.gameState, companyId)
            if (automatic && action.type === automatic.schema.properties.type.const) return true
        }
        return this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<S>): string[] {
        if (this.receiver(context.gameState) && this.step !== 'RunningTrains') return []
        return this.handler.validActionsForPlayer(playerId, context)
    }
    enter(context: MachineContext<S>): void {
        this.handler.enter(context)
        const companyId = this.receiver(context.gameState)
        const automatic = companyId ? this.automatic(context.gameState, companyId) : undefined
        if (automatic) context.addSystemAction(automatic.schema, automatic.fields)
    }
    onAction(action: HydratedAction, context: MachineContext<S>): string {
        return this.handler.onAction(action, context)
    }
}

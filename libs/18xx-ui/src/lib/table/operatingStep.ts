import type { GameAction } from '@tabletop/common'
import { isOfferPurchase, isRespondToPurchaseOffer } from '@tabletop/18xx'

const indices: Readonly<Record<string, number>> = {
    LayingTrack: 0,
    PlacingStation: 1,
    RunningTrains: 2,
    RustingTrains: 2,
    DistributingEarnings: 3,
    BuyingTrains: 4,
    FundingTrain: 4
}

export function operatingStepIndex(machineState: string): number | undefined {
    return indices[machineState]
}

const actionIndices: Readonly<Record<string, number>> = {
    LayTile: 0, RequestTrackConsent: 0, RespondToTrackConsent: 0, FinishTrack: 0,
    PlaceStation: 1, FinishStations: 1,
    RunTrains: 2,
    DistributeEarnings: 3,
    BuyTrain: 4, BuyPrivateTrain: 4, FundTrain: 4, ContributeTrainFunds: 4, SellFundingShares: 4
}

export function historicalOperatingStepIndex(action: GameAction | undefined, machineState: string): number | undefined {
    if (action) {
        if ((isOfferPurchase(action) || isRespondToPurchaseOffer(action)) &&
            action.metadata?.offer.asset.kind === 'train') return 4
        const index = actionIndices[action.type]
        if (index !== undefined) return index
    }
    return operatingStepIndex(machineState)
}

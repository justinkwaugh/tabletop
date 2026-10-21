import type { GameAction } from '@tabletop/common'
import { isOfferPurchase, isRespondToPurchaseOffer } from '@tabletop/18xx'

const indices: Readonly<Record<string, number>> = {
    LayingTrack: 0,
    PlacingStation: 1,
    RunningTrains: 2,
    RustingTrains: 2,
    DistributingEarnings: 3,
    BuyingTrains: 4,
    FundingTrain: 4,
    RepayingLoans: 5,
    RaisingCash: 5
}

/** The step's place in the strip, after a share step first when the title has one. */
export function operatingStepIndex(machineState: string, shareStep = false): number | undefined {
    if (!shareStep) return indices[machineState]
    if (machineState === 'ManagingShares') return 0
    const index = indices[machineState]
    return index === undefined ? undefined : index + 1
}

const actionIndices: Readonly<Record<string, number>> = {
    LayTile: 0,
    RequestTrackConsent: 0,
    RespondToTrackConsent: 0,
    FinishTrack: 0,
    PlaceStation: 1,
    FinishStations: 1,
    RunTrains: 2,
    DistributeEarnings: 3,
    BuyTrain: 4,
    BuyPrivateTrain: 4,
    FundTrain: 4,
    ContributeTrainFunds: 4,
    SellFundingShares: 4,
    FinishTrains: 4,
    PayInterest: 5,
    RepayLoan: 5,
    SellSharesToPay: 5,
    GoBankrupt: 5
}

export function historicalOperatingStepIndex(
    action: GameAction | undefined,
    machineState: string,
    shareStep = false
): number | undefined {
    const offset = shareStep ? 1 : 0
    if (action) {
        if (
            shareStep &&
            (action.type === 'TradeTreasuryShares' || action.type === 'FinishTreasuryShares')
        )
            return 0
        if (
            (isOfferPurchase(action) || isRespondToPurchaseOffer(action)) &&
            action.metadata?.offer.asset.kind === 'train'
        )
            return 4 + offset
        const index = actionIndices[action.type]
        if (index !== undefined) return index + offset
    }
    return operatingStepIndex(machineState, shareStep)
}
